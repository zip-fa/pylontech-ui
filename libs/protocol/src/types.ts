export type CellState = 'Normal' | 'Alarm' | 'Protect' | string;
export type BaseState = 'Idle' | 'Charge' | 'Dischg' | 'Absent' | string;

export interface PackSummary {
  address: number;
  present: boolean;
  voltage: number;
  current: number;
  temperature: number;
  tempLow: number;
  tempLowId: number;
  tempHigh: number;
  tempHighId: number;
  cellLow: number;
  cellLowId: number;
  cellHigh: number;
  cellHighId: number;
  baseState: BaseState;
  voltState: CellState;
  currState: CellState;
  tempState: CellState;
  soc: number;
  timestamp: string;
  mosTemperature: number;
  systemAlarm: CellState;
}

export interface Cell {
  index: number;
  voltage: number;
  current: number;
  temperature: number;
  baseState: BaseState;
  voltState: CellState;
  currState: CellState;
  tempState: CellState;
  soc: number;
  coulomb: number;
  balancing: boolean;
}

export interface PackCells {
  address: number;
  cells: Cell[];
  spread: number;
  mean: number;
}

export interface PackInfo {
  address: number;
  manufacturer: string;
  deviceName: string;
  boardVersion: string;
  board: string;
  mainSoftVersion: string;
  softVersion: string;
  bootVersion: string;
  commVersion: string;
  releaseDate: string;
  barcode: string;
  deviceTestTime: string;
  specification: string;
  cellNumber: number;
  maxDischargeCurrent: number;
  maxChargeCurrent: number;
}

export interface PackStat {
  address: number;
  chargeTimes: number;
  idleTimes: number;
  resetTimes: number;
  shutTimes: number;
  cycleTimes: number;
  /** How many times the pack has recalculated its own state of health. */
  sohTimes: number;
  soh: number;
  powerPercent: number;
  /** Cumulative discharge over the pack's life, in mAh. */
  dischargeCapacity: number;
  /** Raw coulomb counter in mA·s. */
  powerCoulomb: number;
  /** The same counter as amp-hours currently held. */
  coulombAh: number;
  /** Rows in the onboard logger: `dataItems` live, `historyItems` archived. */
  dataItems: number;
  historyItems: number;
  lifeWarnTimes: number;
  lifeAlarmTimes: number;
  /** Operating-condition counters (`HT Cnt`, `LV Cnt`, …) — conditions seen, not trips. */
  counters: Record<string, number>;
  /** Protection trip counters (`COC`, `Bat OV`, …). Every one should read zero. */
  faults: Record<string, number>;
}

/**
 * Total across the stack. Every figure is derived from what the packs actually reported —
 * nothing about model, pack count or capacity is assumed.
 */
export interface StackTotals {
  /** Addresses the BMS enumerates, present or not. */
  packCount: number;
  presentCount: number;
  /** Summed from the per-pack cell readings, falling back to each pack's declared cell count. */
  cellCount: number;
  /** Distinct device names across the present packs; more than one means a mixed stack. */
  models: string[];
  manufacturer: string | null;
  /** How many present packs have a readable nameplate. Below `presentCount`, energy is partial. */
  ratedPackCount: number;
  /** Summed nameplate watt-hours, or null until at least one `info` record has been read. */
  energyNominal: number | null;
  voltage: number;
  current: number;
  power: number;
  soc: number;
  energyRemaining: number | null;
  worstSpread: number;
  tempMin: number;
  tempMax: number;
  alarm: boolean;
}

export interface Snapshot {
  connected: boolean;
  port: string | null;
  error: string | null;
  updatedAt: string | null;
  packs: PackSummary[];
  cells: Record<number, PackCells>;
  info: Record<number, PackInfo>;
  stats: Record<number, PackStat>;
  /** Only ever describes the pack the console cable is attached to. */
  euro: EuroStats | null;
  totals: StackTotals | null;
}

/**
 * `euro` output. Unlike every other command this one takes no address: it reports only the pack
 * whose console port the cable is plugged into, so it describes one pack, not the stack.
 *
 * `remainCapacity` is the figure that actually answers "how much has this pack degraded" — it is
 * a measured amp-hour capacity, where `PackStat.soh` is a firmware-computed percentage that some
 * builds never populate.
 */
export interface EuroStats {
  dateOfManufacture: string;
  dateInService: string;
  storageDays: string;
  /** Measured remaining capacity in Ah, against the pack's nameplate. */
  remainCapacity: number;
  remainCapacity2: number;
  remainPower: number;
  roundTripEfficiency: number;
  selfDischargeRate: number;
  resistanceMilliOhm: number;
  chargeEnergyThroughput: number;
  dischargeEnergyThroughput: number;
  chargeCapacityThroughput: number;
  dischargeCapacityThroughput: number;
  deepDischargeCount: number;
  extremeTempSeconds: number;
  extremeTempChargeSeconds: number;
  cycles: number;
  cycles2: number;
}
