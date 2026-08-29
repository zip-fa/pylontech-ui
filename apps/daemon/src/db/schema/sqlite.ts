import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * Three dialects, one shape. The tables are declared once per dialect because Drizzle's column
 * builders are dialect-specific; the column names, order and nullability are what must match, and
 * `libs/protocol` holds no opinion about any of it.
 *
 * `at` is epoch milliseconds rather than a timestamp column: it is the only representation that
 * means exactly the same thing in SQLite, MySQL and Postgres, and bucketing is then integer
 * arithmetic instead of three different date functions.
 */
export const stackSample = sqliteTable(
  'stack_sample',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    at: integer('at').notNull(),
    samples: integer('samples').notNull(),
    voltage: real('voltage').notNull(),
    current: real('current').notNull(),
    power: real('power').notNull(),
    powerMin: real('power_min').notNull(),
    powerMax: real('power_max').notNull(),
    soc: real('soc').notNull(),
    energyRemaining: real('energy_remaining'),
    tempMin: real('temp_min').notNull(),
    tempMax: real('temp_max').notNull(),
    spread: real('spread').notNull(),
    chargedWh: real('charged_wh').notNull().default(0),
    dischargedWh: real('discharged_wh').notNull().default(0),
    presentCount: integer('present_count').notNull(),
    packCount: integer('pack_count').notNull(),
    alarm: integer('alarm', { mode: 'boolean' })
      .notNull()
      .default(sql`0`),
  },
  (table) => [uniqueIndex('stack_sample_at').on(table.at)],
);

export const packSample = sqliteTable(
  'pack_sample',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    at: integer('at').notNull(),
    address: integer('address').notNull(),
    samples: integer('samples').notNull(),
    voltage: real('voltage').notNull(),
    current: real('current').notNull(),
    power: real('power').notNull(),
    soc: real('soc').notNull(),
    temperature: real('temperature').notNull(),
    tempMin: real('temp_min').notNull(),
    tempMax: real('temp_max').notNull(),
    mosTemperature: real('mos_temperature'),
    cellLow: real('cell_low').notNull(),
    cellHigh: real('cell_high').notNull(),
    spread: real('spread'),
    baseState: text('base_state').notNull(),
    alarm: integer('alarm', { mode: 'boolean' })
      .notNull()
      .default(sql`0`),
  },
  (table) => [
    uniqueIndex('pack_sample_at_address').on(table.at, table.address),
  ],
);

export const packHealth = sqliteTable(
  'pack_health',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    at: integer('at').notNull(),
    address: integer('address').notNull(),
    soh: real('soh'),
    cycles: integer('cycles'),
    dischargeCapacityAh: real('discharge_capacity_ah'),
    remainCapacityAh: real('remain_capacity_ah'),
    resistanceMilliOhm: real('resistance_milli_ohm'),
    roundTripEfficiency: real('round_trip_efficiency'),
    chargeThroughputWh: real('charge_throughput_wh'),
    dischargeThroughputWh: real('discharge_throughput_wh'),
    trips: integer('trips').notNull().default(0),
  },
  (table) => [index('pack_health_address_at').on(table.address, table.at)],
);
