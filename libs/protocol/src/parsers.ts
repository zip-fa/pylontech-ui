import type {
  Cell,
  EuroStats,
  PackCells,
  PackInfo,
  PackStat,
  PackSummary,
  StackTotals,
} from './types.ts';

/**
 * First numeric token, not every digit on the line. Several `euro` rows carry two figures — the
 * value in its stated unit followed by the sub-unit remainder ("14620 Wh   407761 mWs") — and
 * stripping non-digits wholesale splices those into one nonsense number.
 */
const num = (v: string | undefined): number => {
  const match = /-?\d+(?:\.\d+)?/.exec(String(v ?? ''));

  return match ? Number(match[0]) : 0;
};

/** Console reports temperature in milli-degrees and voltage/current in milli-units. */
const milli = (v: string | undefined): number => num(v) / 1000;

function keyValues(text: string): Map<string, string> {
  const map = new Map<string, string>();

  for (const line of text.split('\n')) {
    const idx = line.indexOf(':');

    if (idx < 0) {
      continue;
    }

    const key = line.slice(0, idx).trim();

    if (!key) {
      continue;
    }

    map.set(key, line.slice(idx + 1).trim());
  }

  return map;
}

export function parsePwr(text: string): PackSummary[] {
  const packs: PackSummary[] = [];

  for (const line of text.split('\n')) {
    const f = line.trim().split(/\s+/);

    if (!/^\d+$/.test(f[0] ?? '')) {
      continue;
    }

    const address = num(f[0]);

    if (line.includes('Absent')) {
      packs.push({
        address,
        present: false,
        voltage: 0,
        current: 0,
        temperature: 0,
        tempLow: 0,
        tempLowId: 0,
        tempHigh: 0,
        tempHighId: 0,
        cellLow: 0,
        cellLowId: 0,
        cellHigh: 0,
        cellHighId: 0,
        baseState: 'Absent',
        voltState: '-',
        currState: '-',
        tempState: '-',
        soc: 0,
        timestamp: '',
        mosTemperature: 0,
        systemAlarm: '-',
      });
      continue;
    }

    if (f.length < 23) {
      continue;
    }

    packs.push({
      address,
      present: true,
      voltage: milli(f[1]),
      current: milli(f[2]),
      temperature: milli(f[3]),
      tempLow: milli(f[4]),
      tempLowId: num(f[5]),
      tempHigh: milli(f[6]),
      tempHighId: num(f[7]),
      cellLow: num(f[8]),
      cellLowId: num(f[9]),
      cellHigh: num(f[10]),
      cellHighId: num(f[11]),
      baseState: f[12] ?? '',
      voltState: f[13] ?? '',
      currState: f[14] ?? '',
      tempState: f[15] ?? '',
      soc: num(f[16]),
      timestamp: `${f[17] ?? ''} ${f[18] ?? ''}`.trim(),
      mosTemperature: milli(f[21]),
      systemAlarm: f[23] ?? f[22] ?? '',
    });
  }

  return packs;
}

export function parseBat(text: string, address: number): PackCells {
  const cells: Cell[] = [];

  for (const line of text.split('\n')) {
    const f = line.trim().split(/\s+/);

    if (!/^\d+$/.test(f[0] ?? '') || f.length < 11) {
      continue;
    }

    cells.push({
      index: num(f[0]),
      voltage: num(f[1]),
      current: num(f[2]),
      temperature: milli(f[3]),
      baseState: f[4] ?? '',
      voltState: f[5] ?? '',
      currState: f[6] ?? '',
      tempState: f[7] ?? '',
      soc: num(f[8]),
      coulomb: num(f[9]),
      balancing: (f[11] ?? f[10] ?? 'N').toUpperCase() === 'Y',
    });
  }

  const volts = cells.map((c) => c.voltage).filter((v) => v > 0);
  const spread = volts.length ? Math.max(...volts) - Math.min(...volts) : 0;
  const mean = volts.length
    ? volts.reduce((a, b) => a + b, 0) / volts.length
    : 0;

  return { address, cells, spread, mean };
}

/** The console pads some labels with a double space; look under both spellings. */
const get = (kv: Map<string, string>, ...keys: string[]): string => {
  for (const key of keys) {
    const value = kv.get(key);

    if (value !== undefined) {
      return value;
    }
  }

  return '';
};

export function parseInfo(text: string, address: number): PackInfo {
  const kv = keyValues(text);

  return {
    address,
    manufacturer: get(kv, 'Manufacturer'),
    deviceName: get(kv, 'Device name'),
    boardVersion: get(kv, 'Board version'),
    board: get(kv, 'Board'),
    mainSoftVersion: get(kv, 'Main Soft version'),
    softVersion: get(kv, 'Soft  version', 'Soft version'),
    bootVersion: get(kv, 'Boot  version', 'Boot version'),
    commVersion: get(kv, 'Comm version'),
    releaseDate: get(kv, 'Release Date'),
    barcode: get(kv, 'Barcode'),
    deviceTestTime: get(kv, 'Device Test Time'),
    specification: get(kv, 'Specification'),
    cellNumber: num(get(kv, 'Cell Number')),
    maxDischargeCurrent: milli(get(kv, 'Max Dischg Curr')),
    maxChargeCurrent: milli(get(kv, 'Max Charge Curr')),
  };
}

/**
 * `stat` counters that are operating history rather than protection events. Everything else
 * ending in `Times` is a protection trip, so the fault list stays correct as firmware adds rows.
 */
const NOT_A_FAULT = new Set([
  'Charge Times',
  'Idle Times',
  'Reset Times',
  'CYCLE Times',
  'SOH Times',
  'Shut Times',
  'LifeWarn Times',
  'LifeAlarm Times',
]);

/** Cumulative charge is reported in mA·s; divide to get the amp-hours a reader expects. */
const MAS_PER_AH = 3_600_000;

export function parseStat(text: string, address: number): PackStat {
  const kv = keyValues(text);
  const faults: Record<string, number> = {};
  const counters: Record<string, number> = {};

  for (const [key, value] of kv) {
    if (key.endsWith('Times') && !NOT_A_FAULT.has(key)) {
      faults[key.replace(/ Times$/, '')] = num(value);
      continue;
    }

    // The `Cnt` family counts operating conditions (hot, cold, low voltage), not trips.
    if (/(^|\s)Cnt\.?$/.test(key)) {
      counters[key.replace(/\s*Cnt\.?$/, '')] = num(value);
    }
  }

  return {
    address,
    chargeTimes: num(get(kv, 'Charge Times')),
    idleTimes: num(get(kv, 'Idle Times')),
    resetTimes: num(get(kv, 'Reset Times')),
    shutTimes: num(get(kv, 'Shut Times')),
    cycleTimes: num(get(kv, 'CYCLE Times')),
    sohTimes: num(get(kv, 'SOH Times')),
    soh: num(get(kv, 'SOH')),
    powerPercent: num(get(kv, 'Pwr Percent')),
    /** mAh, cumulative over the pack's life. */
    dischargeCapacity: num(get(kv, 'Dsg Cap')),
    powerCoulomb: num(get(kv, 'Pwr Coulomb')),
    coulombAh: num(get(kv, 'Pwr Coulomb')) / MAS_PER_AH,
    dataItems: num(get(kv, 'Data Items')),
    historyItems: num(get(kv, 'HisData Items')),
    lifeWarnTimes: num(get(kv, 'LifeWarn Times')),
    lifeAlarmTimes: num(get(kv, 'LifeAlarm Times')),
    counters,
    faults,
  };
}

/**
 * `info` reports the nameplate as a string like `48V/100AH`. Nothing about the pack size is
 * assumed: a stack of a different model reports its own figure and the totals follow it.
 */
export function parseSpecification(
  specification: string | undefined,
): { volts: number; ampHours: number; wattHours: number } | null {
  const match = /([\d.]+)\s*V\s*\/\s*([\d.]+)\s*AH/i.exec(specification ?? '');

  if (!match) {
    return null;
  }

  const volts = Number(match[1]);
  const ampHours = Number(match[2]);

  if (!Number.isFinite(volts) || !Number.isFinite(ampHours)) {
    return null;
  }

  return { volts, ampHours, wattHours: volts * ampHours };
}

export function computeTotals(
  packs: PackSummary[],
  cells: Record<number, PackCells>,
  info: Record<number, PackInfo> = {},
): StackTotals {
  const present = packs.filter((p) => p.present);
  const temps = present
    .flatMap((p) => [p.tempLow, p.tempHigh])
    .filter((t) => t > 0);
  const spreads = Object.values(cells).map((c) => c.spread);
  const soc = present.length
    ? present.reduce((a, p) => a + p.soc, 0) / present.length
    : 0;
  // Packs sit in parallel on one bus: voltage is the mean, current is the sum.
  const voltage = present.length
    ? present.reduce((a, p) => a + p.voltage, 0) / present.length
    : 0;
  const current = present.reduce((a, p) => a + p.current, 0);
  // Capacity is summed per pack from each pack's own nameplate, so a mixed stack still totals
  // correctly. A pack whose `info` has not been read yet contributes nothing rather than a guess.
  const nameplates = present.map((p) =>
    parseSpecification(info[p.address]?.specification),
  );
  const rated = nameplates.filter((n) => n !== null);
  const energyNominal = rated.length
    ? rated.reduce((a, n) => a + n.wattHours, 0)
    : null;
  const cellCount = present.reduce(
    (a, p) =>
      a + (cells[p.address]?.cells.length ?? info[p.address]?.cellNumber ?? 0),
    0,
  );
  const models = [
    ...new Set(present.map((p) => info[p.address]?.deviceName).filter(Boolean)),
  ] as string[];

  return {
    packCount: packs.length,
    presentCount: present.length,
    cellCount,
    models,
    manufacturer:
      present.map((p) => info[p.address]?.manufacturer).find(Boolean) ?? null,
    ratedPackCount: rated.length,
    energyNominal,
    voltage,
    current,
    power: voltage * current,
    soc,
    energyRemaining:
      energyNominal === null ? null : (energyNominal * soc) / 100,
    worstSpread: spreads.length ? Math.max(...spreads) : 0,
    tempMin: temps.length ? Math.min(...temps) : 0,
    tempMax: temps.length ? Math.max(...temps) : 0,
    alarm: present.some(
      (p) =>
        p.systemAlarm !== 'Normal' ||
        p.voltState !== 'Normal' ||
        p.currState !== 'Normal' ||
        p.tempState !== 'Normal',
    ),
  };
}

/**
 * `euro` reports one pack — whichever the console cable is plugged into — and is the only command
 * that gives a *measured* capacity rather than a firmware-computed health percentage.
 */
export function parseEuro(text: string): EuroStats {
  const kv = keyValues(text);

  return {
    dateOfManufacture: get(kv, 'Date of manufacture'),
    dateInService: get(kv, 'Date of putting into service'),
    storageDays: get(kv, 'Storage'),
    remainCapacity: num(get(kv, 'Remain Cap. 1')),
    remainCapacity2: num(get(kv, 'Remain Cap. 2')),
    remainPower: num(get(kv, 'Remain Power')),
    roundTripEfficiency: num(get(kv, 'Round Trip Eff.')),
    selfDischargeRate: num(get(kv, 'Self Dsg Rate')),
    resistanceMilliOhm: num(get(kv, 'Resistence', 'Resistance')),
    chargeEnergyThroughput: num(get(kv, 'Chg. Energy Thro.')),
    dischargeEnergyThroughput: num(get(kv, 'Dsg. Energy Thro.')),
    chargeCapacityThroughput: num(get(kv, 'Chg. Capac. Thro.')),
    dischargeCapacityThroughput: num(get(kv, 'Dsg. Capac. Thro.')),
    deepDischargeCount: num(get(kv, 'Deep Dsg. Count')),
    extremeTempSeconds: num(get(kv, 'Extr. Tempr Total')),
    extremeTempChargeSeconds: num(get(kv, 'Extr. Tempr Chg.')),
    cycles: num(get(kv, 'Chg. Dsg. Cycle')),
    cycles2: num(get(kv, 'Chg. Dsg. Cycle2')),
  };
}
