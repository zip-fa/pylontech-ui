import type { EuroStats, PackStat, Snapshot } from '@libs/protocol';

import type { HealthRow, PackRow, StackRow, Store } from '../db/client.ts';

interface StackBucket {
  at: number;
  samples: number;
  voltage: number;
  current: number;
  power: number;
  powerMin: number;
  powerMax: number;
  soc: number;
  energyRemaining: number | null;
  tempMin: number;
  tempMax: number;
  spread: number;
  chargedWh: number;
  dischargedWh: number;
  presentCount: number;
  packCount: number;
  alarm: boolean;
}

interface PackBucket {
  address: number;
  samples: number;
  voltage: number;
  current: number;
  power: number;
  soc: number;
  temperature: number;
  tempMin: number;
  tempMax: number;
  mosTemperature: number | null;
  cellLow: number;
  cellHigh: number;
  spread: number | null;
  baseState: string;
  alarm: boolean;
}

export interface RecorderOptions {
  /** Bucket width. The console is polled far faster than this; a bucket is the unit that is kept. */
  intervalMs: number;
  retentionDays: number;
  /** A gap longer than this is treated as downtime rather than integrated into the energy total. */
  maxGapMs: number;
}

/**
 * Folds the poll stream into one row per pack per interval. The point of bucketing at the writer
 * rather than storing every poll is that a year of five-second samples is millions of rows nobody
 * ever reads at that resolution, while min/max within the bucket keeps the peaks that would
 * otherwise be averaged away.
 *
 * Energy is integrated here, not derived at read time: summing a column is portable across all
 * three engines, where integrating an irregular series in SQL is not.
 */
export class Recorder {
  private stack: StackBucket | null = null;
  private packs = new Map<number, PackBucket>();
  private lastAt: number | null = null;
  private lastPower = 0;
  private health = new Map<number, string>();
  private timers: NodeJS.Timeout[] = [];

  private readonly store: Store;
  private readonly options: RecorderOptions;

  constructor(store: Store, options: RecorderOptions) {
    this.store = store;
    this.options = options;
  }

  start(): void {
    // A bucket rolls when the next reading arrives. If readings stop — serial unplugged, console
    // wedged — this is what still writes the last one out.
    this.timers.push(
      setInterval(() => void this.flushStale(), this.options.intervalMs),
    );
    this.timers.push(setInterval(() => void this.prune(), 60 * 60 * 1000));
    void this.prune();
  }

  async stop(): Promise<void> {
    for (const timer of this.timers.splice(0)) {
      clearInterval(timer);
    }

    await this.flush();
  }

  /** Called after every `pwr` sweep. */
  observe(snapshot: Snapshot, now = Date.now()): void {
    const totals = snapshot.totals;

    if (!snapshot.connected || !totals || totals.presentCount === 0) {
      // Nothing was read, so nothing is recorded: a gap in the series is the honest answer.
      this.lastAt = null;

      return;
    }

    this.integrate(totals.power, now);

    const bucket =
      Math.floor(now / this.options.intervalMs) * this.options.intervalMs;

    if (this.stack && this.stack.at !== bucket) {
      void this.flush();
    }

    this.stack = this.foldStack(this.stack, bucket, totals);

    for (const pack of snapshot.packs) {
      if (!pack.present) {
        continue;
      }

      const spread = snapshot.cells[pack.address]?.spread ?? null;

      this.packs.set(
        pack.address,
        this.foldPack(this.packs.get(pack.address), pack, spread),
      );
    }
  }

  /** Called after `stat` and `euro` sweeps, which run on the order of once an hour. */
  observeHealth(snapshot: Snapshot, now = Date.now()): void {
    for (const [key, stat] of Object.entries(snapshot.stats)) {
      const address = Number(key);
      // `euro` answers only for the pack holding the console cable, so it decorates one address.
      const euro =
        snapshot.euro && address === this.euroAddress(snapshot)
          ? snapshot.euro
          : null;
      const row = this.healthRow(address, stat, euro, now);
      const fingerprint = JSON.stringify({ ...row, at: 0 });

      if (this.health.get(address) === fingerprint) {
        continue;
      }

      this.health.set(address, fingerprint);
      void this.store.insertHealth(row).catch(reportOnce('health'));
    }
  }

  /**
   * `euro` carries no address. The lowest present address is the cable end on every stack we can
   * observe, so that is what the row is attributed to — and it is why only one pack ever gets
   * measured-capacity figures.
   */
  private euroAddress(snapshot: Snapshot): number | null {
    const present = snapshot.packs.filter((pack) => pack.present);

    return present.length
      ? Math.min(...present.map((pack) => pack.address))
      : null;
  }

  private healthRow(
    address: number,
    stat: PackStat,
    euro: EuroStats | null,
    now: number,
  ): HealthRow {
    return {
      at: now,
      address,
      soh: finite(stat.soh),
      cycles: finite(stat.cycleTimes),
      dischargeCapacityAh: finite(stat.dischargeCapacity / 1000),
      remainCapacityAh: euro ? finite(euro.remainCapacity) : null,
      resistanceMilliOhm: euro ? finite(euro.resistanceMilliOhm) : null,
      roundTripEfficiency: euro ? finite(euro.roundTripEfficiency) : null,
      chargeThroughputWh: euro ? finite(euro.chargeEnergyThroughput) : null,
      dischargeThroughputWh: euro
        ? finite(euro.dischargeEnergyThroughput)
        : null,
      trips: Object.values(stat.faults).filter((value) => value > 0).length,
    };
  }

  /** Trapezoid between the last reading and this one, so a ramp is not counted at either end. */
  private integrate(power: number, now: number): void {
    const previous = this.lastAt;

    this.lastAt = now;

    if (previous === null || !this.stack) {
      this.lastPower = power;

      return;
    }

    const elapsed = now - previous;

    if (elapsed > 0 && elapsed <= this.options.maxGapMs) {
      const wh = (((this.lastPower + power) / 2) * elapsed) / 3_600_000;

      if (wh >= 0) {
        this.stack.chargedWh += wh;
      } else {
        this.stack.dischargedWh -= wh;
      }
    }

    this.lastPower = power;
  }

  private foldStack(
    previous: StackBucket | null,
    at: number,
    totals: NonNullable<Snapshot['totals']>,
  ): StackBucket {
    const open = previous?.at === at ? previous : null;
    const n = (open?.samples ?? 0) + 1;
    const mean = (was: number | undefined, value: number) =>
      was === undefined ? value : was + (value - was) / n;

    return {
      at,
      samples: n,
      voltage: mean(open?.voltage, totals.voltage),
      current: mean(open?.current, totals.current),
      power: mean(open?.power, totals.power),
      powerMin: Math.min(open?.powerMin ?? totals.power, totals.power),
      powerMax: Math.max(open?.powerMax ?? totals.power, totals.power),
      soc: totals.soc,
      energyRemaining: finite(totals.energyRemaining),
      tempMin: Math.min(open?.tempMin ?? totals.tempMin, totals.tempMin),
      tempMax: Math.max(open?.tempMax ?? totals.tempMax, totals.tempMax),
      spread: Math.max(open?.spread ?? 0, totals.worstSpread),
      chargedWh: open?.chargedWh ?? 0,
      dischargedWh: open?.dischargedWh ?? 0,
      presentCount: totals.presentCount,
      packCount: totals.packCount,
      alarm: (open?.alarm ?? false) || totals.alarm,
    };
  }

  private foldPack(
    open: PackBucket | undefined,
    pack: Snapshot['packs'][number],
    spread: number | null,
  ): PackBucket {
    const n = (open?.samples ?? 0) + 1;
    const mean = (was: number | undefined, value: number) =>
      was === undefined ? value : was + (value - was) / n;
    const power = pack.voltage * pack.current;

    return {
      address: pack.address,
      samples: n,
      voltage: mean(open?.voltage, pack.voltage),
      current: mean(open?.current, pack.current),
      power: mean(open?.power, power),
      soc: pack.soc,
      temperature: mean(open?.temperature, pack.temperature),
      tempMin: Math.min(open?.tempMin ?? pack.tempLow, pack.tempLow),
      tempMax: Math.max(open?.tempMax ?? pack.tempHigh, pack.tempHigh),
      mosTemperature: maxOrNull(
        open?.mosTemperature,
        finite(pack.mosTemperature),
      ),
      cellLow: Math.min(open?.cellLow ?? pack.cellLow, pack.cellLow),
      cellHigh: Math.max(open?.cellHigh ?? pack.cellHigh, pack.cellHigh),
      spread: maxOrNull(open?.spread, spread),
      baseState: pack.baseState,
      alarm:
        (open?.alarm ?? false) ||
        pack.systemAlarm !== 'Normal' ||
        pack.voltState !== 'Normal' ||
        pack.currState !== 'Normal' ||
        pack.tempState !== 'Normal',
    };
  }

  private async flushStale(): Promise<void> {
    const current =
      Math.floor(Date.now() / this.options.intervalMs) *
      this.options.intervalMs;

    if (this.stack && this.stack.at < current) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    const stack = this.stack;
    const packs = [...this.packs.values()];

    this.stack = null;
    this.packs.clear();

    if (!stack) {
      return;
    }

    const row: StackRow = { ...stack };
    const packRows: PackRow[] = packs.map((pack) => ({
      ...pack,
      at: stack.at,
    }));

    try {
      await this.store.insertStack(row);
      await this.store.insertPacks(packRows);
    } catch (error) {
      reportOnce('samples')(error);
    }
  }

  private async prune(): Promise<void> {
    if (this.options.retentionDays <= 0) {
      return;
    }

    const before =
      Date.now() - this.options.retentionDays * 24 * 60 * 60 * 1000;

    try {
      await this.store.prune(before);
    } catch (error) {
      reportOnce('prune')(error);
    }
  }
}

const finite = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const maxOrNull = (
  was: number | null | undefined,
  value: number | null,
): number | null => {
  if (value === null) {
    return was ?? null;
  }

  return was === null || was === undefined ? value : Math.max(was, value);
};

/** History is a nicety; a database that has gone away must not take the live readings with it. */
const reported = new Set<string>();
const reportOnce =
  (scope: string) =>
  (error: unknown): void => {
    if (reported.has(scope)) {
      return;
    }

    reported.add(scope);
    console.error(`history ${scope}: ${(error as Error).message}`);
  };
