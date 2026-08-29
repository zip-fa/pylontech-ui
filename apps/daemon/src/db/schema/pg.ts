import {
  bigint,
  bigserial,
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

/** The Postgres projection of the shape declared in `sqlite.ts`. Keep the three in step. */
export const stackSample = pgTable(
  'stack_sample',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    at: bigint('at', { mode: 'number' }).notNull(),
    samples: integer('samples').notNull(),
    voltage: doublePrecision('voltage').notNull(),
    current: doublePrecision('current').notNull(),
    power: doublePrecision('power').notNull(),
    powerMin: doublePrecision('power_min').notNull(),
    powerMax: doublePrecision('power_max').notNull(),
    soc: doublePrecision('soc').notNull(),
    energyRemaining: doublePrecision('energy_remaining'),
    tempMin: doublePrecision('temp_min').notNull(),
    tempMax: doublePrecision('temp_max').notNull(),
    spread: doublePrecision('spread').notNull(),
    chargedWh: doublePrecision('charged_wh').notNull().default(0),
    dischargedWh: doublePrecision('discharged_wh').notNull().default(0),
    presentCount: integer('present_count').notNull(),
    packCount: integer('pack_count').notNull(),
    alarm: boolean('alarm').notNull().default(false),
  },
  (table) => [uniqueIndex('stack_sample_at').on(table.at)],
);

export const packSample = pgTable(
  'pack_sample',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    at: bigint('at', { mode: 'number' }).notNull(),
    address: integer('address').notNull(),
    samples: integer('samples').notNull(),
    voltage: doublePrecision('voltage').notNull(),
    current: doublePrecision('current').notNull(),
    power: doublePrecision('power').notNull(),
    soc: doublePrecision('soc').notNull(),
    temperature: doublePrecision('temperature').notNull(),
    tempMin: doublePrecision('temp_min').notNull(),
    tempMax: doublePrecision('temp_max').notNull(),
    mosTemperature: doublePrecision('mos_temperature'),
    cellLow: doublePrecision('cell_low').notNull(),
    cellHigh: doublePrecision('cell_high').notNull(),
    spread: doublePrecision('spread'),
    baseState: varchar('base_state', { length: 32 }).notNull(),
    alarm: boolean('alarm').notNull().default(false),
  },
  (table) => [
    uniqueIndex('pack_sample_at_address').on(table.at, table.address),
  ],
);

export const packHealth = pgTable(
  'pack_health',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    at: bigint('at', { mode: 'number' }).notNull(),
    address: integer('address').notNull(),
    soh: doublePrecision('soh'),
    cycles: integer('cycles'),
    dischargeCapacityAh: doublePrecision('discharge_capacity_ah'),
    remainCapacityAh: doublePrecision('remain_capacity_ah'),
    resistanceMilliOhm: doublePrecision('resistance_milli_ohm'),
    roundTripEfficiency: doublePrecision('round_trip_efficiency'),
    chargeThroughputWh: doublePrecision('charge_throughput_wh'),
    dischargeThroughputWh: doublePrecision('discharge_throughput_wh'),
    trips: integer('trips').notNull().default(0),
  },
  (table) => [index('pack_health_address_at').on(table.address, table.at)],
);
