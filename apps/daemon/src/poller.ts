import {
  computeTotals,
  parseBat,
  parseEuro,
  parseInfo,
  parsePwr,
  parseStat,
  type EuroStats,
  type PackCells,
  type PackInfo,
  type PackStat,
  type Snapshot,
} from '@libs/protocol';

import type { ConsolePort } from './console-port.ts';
import { config } from './config.ts';

export type PollEvent = 'sample' | 'health';
export type PollListener = (event: PollEvent, snapshot: Snapshot) => void;

/**
 * Holds the latest reading of every pack. Schedules are staggered rather than run on one
 * tick so the slow `stat` sweep never lands on the same beat as the fast `pwr` poll.
 */
export class Poller {
  private snapshot: Snapshot = {
    connected: false,
    port: null,
    error: null,
    updatedAt: null,
    packs: [],
    cells: {},
    info: {},
    stats: {},
    euro: null,
    totals: null,
  };

  private timers: NodeJS.Timeout[] = [];
  private running = new Set<string>();
  private listeners: PollListener[] = [];

  private readonly console: ConsolePort;

  constructor(consolePort: ConsolePort) {
    this.console = consolePort;
  }

  get current(): Snapshot {
    return {
      ...this.snapshot,
      connected: this.console.connected,
      port: this.console.path,
      error: this.console.lastError,
    };
  }

  /** The recorder is the only listener today; the poller stays unaware of what it feeds. */
  on(listener: PollListener): void {
    this.listeners.push(listener);
  }

  private announce(event: PollEvent): void {
    for (const listener of this.listeners) {
      listener(event, this.current);
    }
  }

  start(): void {
    // `info` needs an address list, and only `pwr` knows which slots are populated, so the
    // first identity sweep is chained onto the first power sweep rather than run beside it.
    void this.once('pwr', async () => {
      await this.pollPwr();
      await this.once('info', () => this.pollIdentity());
    });

    this.timers.push(
      setInterval(
        () => void this.once('pwr', () => this.pollPwr()),
        config.pollPwrMs,
      ),
    );
    this.timers.push(
      setInterval(
        () => void this.once('cells', () => this.pollCells()),
        config.pollCellsMs,
      ),
    );
    this.timers.push(
      setInterval(
        () => void this.once('stats', () => this.pollStats()),
        config.pollStatMs,
      ),
    );

    setTimeout(() => void this.once('cells', () => this.pollCells()), 2000);
    setTimeout(() => void this.once('stats', () => this.pollStats()), 6000);
    setTimeout(() => void this.once('euro', () => this.pollEuro()), 10000);

    this.timers.push(
      setInterval(
        () => void this.once('euro', () => this.pollEuro()),
        config.pollStatMs,
      ),
    );

    // A pack added to the stack later gets identified without a daemon restart.
    this.timers.push(
      setInterval(
        () => void this.once('info', () => this.pollIdentity()),
        config.pollIdentityMs,
      ),
    );
  }

  /** One console at seconds per command: a sweep that overruns its interval must not stack on itself. */
  private async once(key: string, run: () => Promise<void>): Promise<void> {
    if (this.running.has(key)) {
      return;
    }

    this.running.add(key);
    try {
      await run();
    } finally {
      this.running.delete(key);
    }
  }

  stop(): void {
    for (const timer of this.timers.splice(0)) {
      clearInterval(timer);
    }
  }

  private async pollPwr(): Promise<void> {
    try {
      const packs = parsePwr(await this.console.send('pwr'));

      this.snapshot = {
        ...this.snapshot,
        packs,
        totals: computeTotals(packs, this.snapshot.cells, this.snapshot.info),
        updatedAt: new Date().toISOString(),
      };

      this.announce('sample');
    } catch {
      // Transient read failures are surfaced through `console.lastError`, not thrown here.
    }
  }

  /** Whatever `pwr` last reported as populated. Empty until the first sweep lands. */
  private get presentAddresses(): number[] {
    if (config.addresses) {
      return config.addresses;
    }

    return this.snapshot.packs.filter((p) => p.present).map((p) => p.address);
  }

  private async pollCells(): Promise<void> {
    const cells: Record<number, PackCells> = { ...this.snapshot.cells };

    for (const address of this.presentAddresses) {
      try {
        cells[address] = parseBat(
          await this.console.send(`bat ${address}`),
          address,
        );
      } catch {
        continue;
      }
    }

    this.snapshot = {
      ...this.snapshot,
      cells,
      totals: computeTotals(this.snapshot.packs, cells, this.snapshot.info),
    };
  }

  private async pollIdentity(): Promise<void> {
    const info: Record<number, PackInfo> = { ...this.snapshot.info };

    for (const address of this.presentAddresses) {
      if (info[address]) {
        continue;
      }

      try {
        info[address] = parseInfo(
          await this.console.send(`info ${address}`),
          address,
        );
      } catch {
        continue;
      }
    }

    this.snapshot = {
      ...this.snapshot,
      info,
      totals: computeTotals(this.snapshot.packs, this.snapshot.cells, info),
    };
  }

  /** No address: `euro` only ever answers for the pack holding the console cable. */
  private async pollEuro(): Promise<void> {
    try {
      const euro: EuroStats = parseEuro(await this.console.send('euro'));

      this.snapshot = { ...this.snapshot, euro };
      this.announce('health');
    } catch {
      // Older firmware does not implement `euro`; the rest of the snapshot is unaffected.
    }
  }

  private async pollStats(): Promise<void> {
    const stats: Record<number, PackStat> = { ...this.snapshot.stats };

    for (const address of this.presentAddresses) {
      try {
        stats[address] = parseStat(
          await this.console.send(`stat ${address}`),
          address,
        );
      } catch {
        continue;
      }
    }

    this.snapshot = { ...this.snapshot, stats };
    this.announce('health');
  }
}
