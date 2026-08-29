/**
 * The shape of the recorded series as it crosses the API. It is not console protocol, but it is
 * read by the daemon that writes it and the page that draws it, so it lives with the other
 * shared types rather than being declared twice.
 *
 * Every timestamp is epoch milliseconds and every energy figure is watt-hours. Power is signed the
 * way the stack reports it: positive is charging, negative is discharging.
 */
export interface StackPoint {
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
  /** Widest gap between any pack's highest and lowest cell, in millivolts. */
  spread: number;
  chargedWh: number;
  dischargedWh: number;
  alarm: boolean;
}

export interface PackPoint {
  at: number;
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
  alarm: boolean;
}

export interface HealthPoint {
  at: number;
  address: number;
  soh: number | null;
  cycles: number | null;
  dischargeCapacityAh: number | null;
  remainCapacityAh: number | null;
  resistanceMilliOhm: number | null;
  roundTripEfficiency: number | null;
  /**
   * Lifetime energy through the pack. The firmware prints these without a unit; they are watt-hours,
   * which the device's own numbers settle: the matching amp-hour counters divide into them at 50.8 V
   * charging and 49.7 V discharging, both of which are pack voltages.
   */
  chargeThroughputWh: number | null;
  dischargeThroughputWh: number | null;
  trips: number;
}

export interface EnergyDay {
  /** Local midnight, per the offset the caller asked for. */
  at: number;
  chargedWh: number;
  dischargedWh: number;
  samples: number;
}

/** How much history there actually is, so the page can say so instead of drawing an empty axis. */
export interface Coverage {
  first: number | null;
  last: number | null;
  rows: number;
  /** Bucket width the recorder writes at. */
  intervalMs: number;
  retentionDays: number;
}

export interface HistoryWindow {
  from: number;
  to: number;
  /** Width of one returned point. Larger than `intervalMs` when the window is wide. */
  bucketMs: number;
}

export interface StackSeries extends HistoryWindow {
  points: StackPoint[];
}

export interface PackSeries extends HistoryWindow {
  points: PackPoint[];
  addresses: number[];
}

/** The figures behind the dashboard cards, so a card is one number and not one query each. */
export interface HistorySummary {
  coverage: Coverage;
  today: { chargedWh: number; dischargedWh: number };
  week: { chargedWh: number; dischargedWh: number };
  /** Over the last 24 hours. */
  peak: {
    charge: number;
    discharge: number;
    tempMax: number | null;
    spreadMax: number | null;
  };
}
