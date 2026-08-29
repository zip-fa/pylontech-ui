import type {
  Coverage,
  EnergyDay,
  HealthPoint,
  HistorySummary,
  PackPoint,
  StackPoint,
} from '@libs/protocol';
import { sql, type SQL } from 'drizzle-orm';

import type { Dialect } from '../db/dsn.ts';
import type { Store } from '../db/client.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Identifiers are interpolated as text, so they have to be quoted the way each engine expects. */
const quoted =
  (dialect: Dialect) =>
  (name: string): SQL =>
    sql.raw(dialect === 'mysql' ? `\`${name}\`` : `"${name}"`);

/**
 * Truncate a millisecond timestamp to a bucket. Integer division already truncates in SQLite and
 * Postgres; MySQL's `/` yields a decimal, so it needs the explicit floor.
 */
function bucket(dialect: Dialect, column: SQL, size: number, shift = 0): SQL {
  const width = sql.raw(String(Math.round(size)));
  const offset = sql.raw(String(Math.round(shift)));
  const shifted = shift === 0 ? column : sql`(${column} + ${offset})`;
  const truncated =
    dialect === 'mysql'
      ? sql`floor(${shifted} / ${width}) * ${width}`
      : sql`(${shifted} / ${width}) * ${width}`;

  return shift === 0 ? truncated : sql`(${truncated} - ${offset})`;
}

/**
 * "Did anything alarm inside this bucket?" SQLite and MySQL store booleans as integers, so `max`
 * answers it; Postgres has a real boolean type and no `max(boolean)` to go with it.
 */
function anyTrue(dialect: Dialect, column: SQL): SQL {
  return dialect === 'postgres' ? sql`bool_or(${column})` : sql`max(${column})`;
}

/** Wide windows are drawn at a coarser bucket than they are stored; never finer. */
export function bucketFor(
  from: number,
  to: number,
  points: number,
  intervalMs: number,
): number {
  const span = Math.max(1, to - from);
  const wanted = Math.ceil(span / Math.max(1, points));

  return Math.max(intervalMs, Math.ceil(wanted / intervalMs) * intervalMs);
}

// Postgres hands back `bigint` and `numeric` as strings, and the three engines disagree about
// booleans. Every column is pushed through these on the way out rather than trusting the driver.
const n = (value: unknown): number => Number(value ?? 0);
const maybe = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);
const bool = (value: unknown): boolean =>
  value === true || value === 1 || value === '1' || value === 't';

export async function stackSeries(
  store: Store,
  window: { from: number; to: number; bucketMs: number },
): Promise<StackPoint[]> {
  const q = quoted(store.dialect);
  const at = bucket(store.dialect, q('at'), window.bucketMs);
  const rows = await store.rows<Record<string, unknown>>(sql`
    select ${at} as bucket,
           sum(${q('samples')}) as samples,
           avg(${q('voltage')}) as voltage,
           avg(${q('current')}) as current,
           avg(${q('power')}) as power,
           min(${q('power_min')}) as power_min,
           max(${q('power_max')}) as power_max,
           avg(${q('soc')}) as soc,
           avg(${q('energy_remaining')}) as energy_remaining,
           min(${q('temp_min')}) as temp_min,
           max(${q('temp_max')}) as temp_max,
           max(${q('spread')}) as spread,
           sum(${q('charged_wh')}) as charged_wh,
           sum(${q('discharged_wh')}) as discharged_wh,
           ${anyTrue(store.dialect, q('alarm'))} as alarm
    from ${q('stack_sample')}
    where ${q('at')} >= ${window.from} and ${q('at')} < ${window.to}
    group by ${at}
    order by ${at}
  `);

  return rows.map((row) => ({
    at: n(row['bucket']),
    samples: n(row['samples']),
    voltage: n(row['voltage']),
    current: n(row['current']),
    power: n(row['power']),
    powerMin: n(row['power_min']),
    powerMax: n(row['power_max']),
    soc: n(row['soc']),
    energyRemaining: maybe(row['energy_remaining']),
    tempMin: n(row['temp_min']),
    tempMax: n(row['temp_max']),
    spread: n(row['spread']),
    chargedWh: n(row['charged_wh']),
    dischargedWh: n(row['discharged_wh']),
    alarm: bool(row['alarm']),
  }));
}

export async function packSeries(
  store: Store,
  window: { from: number; to: number; bucketMs: number },
): Promise<PackPoint[]> {
  const q = quoted(store.dialect);
  const at = bucket(store.dialect, q('at'), window.bucketMs);
  const rows = await store.rows<Record<string, unknown>>(sql`
    select ${at} as bucket,
           ${q('address')} as address,
           sum(${q('samples')}) as samples,
           avg(${q('voltage')}) as voltage,
           avg(${q('current')}) as current,
           avg(${q('power')}) as power,
           avg(${q('soc')}) as soc,
           avg(${q('temperature')}) as temperature,
           min(${q('temp_min')}) as temp_min,
           max(${q('temp_max')}) as temp_max,
           max(${q('mos_temperature')}) as mos_temperature,
           min(${q('cell_low')}) as cell_low,
           max(${q('cell_high')}) as cell_high,
           max(${q('spread')}) as spread,
           ${anyTrue(store.dialect, q('alarm'))} as alarm
    from ${q('pack_sample')}
    where ${q('at')} >= ${window.from} and ${q('at')} < ${window.to}
    group by ${at}, ${q('address')}
    order by ${at}, ${q('address')}
  `);

  return rows.map((row) => ({
    at: n(row['bucket']),
    address: n(row['address']),
    samples: n(row['samples']),
    voltage: n(row['voltage']),
    current: n(row['current']),
    power: n(row['power']),
    soc: n(row['soc']),
    temperature: n(row['temperature']),
    tempMin: n(row['temp_min']),
    tempMax: n(row['temp_max']),
    mosTemperature: maybe(row['mos_temperature']),
    cellLow: n(row['cell_low']),
    cellHigh: n(row['cell_high']),
    spread: maybe(row['spread']),
    alarm: bool(row['alarm']),
  }));
}

/**
 * Days are cut at the caller's local midnight, not UTC's: "yesterday" on a dashboard means the day
 * the reader lived through, and the daemon may well be running in a different zone than the browser.
 */
export async function energyDays(
  store: Store,
  options: { days: number; offsetMinutes: number },
): Promise<EnergyDay[]> {
  const q = quoted(store.dialect);
  const shift = options.offsetMinutes * 60 * 1000;
  const at = bucket(store.dialect, q('at'), DAY_MS, shift);
  const from = Date.now() - options.days * DAY_MS;
  const rows = await store.rows<Record<string, unknown>>(sql`
    select ${at} as bucket,
           sum(${q('charged_wh')}) as charged_wh,
           sum(${q('discharged_wh')}) as discharged_wh,
           sum(${q('samples')}) as samples
    from ${q('stack_sample')}
    where ${q('at')} >= ${from}
    group by ${at}
    order by ${at}
  `);

  return rows.map((row) => ({
    at: n(row['bucket']),
    chargedWh: n(row['charged_wh']),
    dischargedWh: n(row['discharged_wh']),
    samples: n(row['samples']),
  }));
}

export async function healthSeries(
  store: Store,
  options: { from: number; to: number },
): Promise<HealthPoint[]> {
  const q = quoted(store.dialect);
  const rows = await store.rows<Record<string, unknown>>(sql`
    select * from ${q('pack_health')}
    where ${q('at')} >= ${options.from} and ${q('at')} < ${options.to}
    order by ${q('at')}, ${q('address')}
  `);

  return rows.map((row) => ({
    at: n(row['at']),
    address: n(row['address']),
    soh: maybe(row['soh']),
    cycles: maybe(row['cycles']),
    dischargeCapacityAh: maybe(row['discharge_capacity_ah']),
    remainCapacityAh: maybe(row['remain_capacity_ah']),
    resistanceMilliOhm: maybe(row['resistance_milli_ohm']),
    roundTripEfficiency: maybe(row['round_trip_efficiency']),
    chargeThroughputWh: maybe(row['charge_throughput_wh']),
    dischargeThroughputWh: maybe(row['discharge_throughput_wh']),
    trips: n(row['trips']),
  }));
}

/**
 * Aliases are quoted here because `rows` is a reserved word in MySQL 8. The other queries alias to
 * column names that are already reserved-word-free; anything new should be checked or quoted.
 */
export async function coverage(
  store: Store,
  options: { intervalMs: number; retentionDays: number },
): Promise<Coverage> {
  const q = quoted(store.dialect);
  const [row] = await store.rows<Record<string, unknown>>(sql`
    select min(${q('at')}) as ${q('first')},
           max(${q('at')}) as ${q('last')},
           count(*) as ${q('rows')}
    from ${q('stack_sample')}
  `);

  return {
    first: maybe(row?.['first']),
    last: maybe(row?.['last']),
    rows: n(row?.['rows']),
    intervalMs: options.intervalMs,
    retentionDays: options.retentionDays,
  };
}

export async function summary(
  store: Store,
  options: {
    offsetMinutes: number;
    intervalMs: number;
    retentionDays: number;
  },
): Promise<HistorySummary> {
  const q = quoted(store.dialect);
  const now = Date.now();
  const shift = options.offsetMinutes * 60 * 1000;
  const midnight = Math.floor((now + shift) / DAY_MS) * DAY_MS - shift;

  const energy = async (from: number): Promise<[number, number]> => {
    const [row] = await store.rows<Record<string, unknown>>(sql`
      select sum(${q('charged_wh')}) as charged_wh,
             sum(${q('discharged_wh')}) as discharged_wh
      from ${q('stack_sample')}
      where ${q('at')} >= ${from}
    `);

    return [n(row?.['charged_wh']), n(row?.['discharged_wh'])];
  };

  const [today, week, [peak], cover] = await Promise.all([
    energy(midnight),
    energy(now - 7 * DAY_MS),
    store.rows<Record<string, unknown>>(sql`
      select max(${q('power_max')}) as charge,
             min(${q('power_min')}) as discharge,
             max(${q('temp_max')}) as temp_max,
             max(${q('spread')}) as spread_max
      from ${q('stack_sample')}
      where ${q('at')} >= ${now - DAY_MS}
    `),
    coverage(store, options),
  ]);

  return {
    coverage: cover,
    today: { chargedWh: today[0], dischargedWh: today[1] },
    week: { chargedWh: week[0], dischargedWh: week[1] },
    peak: {
      charge: Math.max(0, n(peak?.['charge'])),
      discharge: Math.abs(Math.min(0, n(peak?.['discharge']))),
      tempMax: maybe(peak?.['temp_max']),
      spreadMax: maybe(peak?.['spread_max']),
    },
  };
}
