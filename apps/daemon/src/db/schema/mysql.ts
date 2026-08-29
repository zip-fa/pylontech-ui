import {
  bigint,
  boolean,
  double,
  index,
  int,
  mysqlTable,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

/** The MySQL projection of the shape declared in `sqlite.ts`. Keep the three in step. */
export const stackSample = mysqlTable(
  'stack_sample',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    at: bigint('at', { mode: 'number' }).notNull(),
    samples: int('samples').notNull(),
    voltage: double('voltage').notNull(),
    current: double('current').notNull(),
    power: double('power').notNull(),
    powerMin: double('power_min').notNull(),
    powerMax: double('power_max').notNull(),
    soc: double('soc').notNull(),
    energyRemaining: double('energy_remaining'),
    tempMin: double('temp_min').notNull(),
    tempMax: double('temp_max').notNull(),
    spread: double('spread').notNull(),
    chargedWh: double('charged_wh').notNull().default(0),
    dischargedWh: double('discharged_wh').notNull().default(0),
    presentCount: int('present_count').notNull(),
    packCount: int('pack_count').notNull(),
    alarm: boolean('alarm').notNull().default(false),
  },
  (table) => [uniqueIndex('stack_sample_at').on(table.at)],
);

export const packSample = mysqlTable(
  'pack_sample',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    at: bigint('at', { mode: 'number' }).notNull(),
    address: int('address').notNull(),
    samples: int('samples').notNull(),
    voltage: double('voltage').notNull(),
    current: double('current').notNull(),
    power: double('power').notNull(),
    soc: double('soc').notNull(),
    temperature: double('temperature').notNull(),
    tempMin: double('temp_min').notNull(),
    tempMax: double('temp_max').notNull(),
    mosTemperature: double('mos_temperature'),
    cellLow: double('cell_low').notNull(),
    cellHigh: double('cell_high').notNull(),
    spread: double('spread'),
    baseState: varchar('base_state', { length: 32 }).notNull(),
    alarm: boolean('alarm').notNull().default(false),
  },
  (table) => [
    uniqueIndex('pack_sample_at_address').on(table.at, table.address),
  ],
);

export const packHealth = mysqlTable(
  'pack_health',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    at: bigint('at', { mode: 'number' }).notNull(),
    address: int('address').notNull(),
    soh: double('soh'),
    cycles: int('cycles'),
    dischargeCapacityAh: double('discharge_capacity_ah'),
    remainCapacityAh: double('remain_capacity_ah'),
    resistanceMilliOhm: double('resistance_milli_ohm'),
    roundTripEfficiency: double('round_trip_efficiency'),
    chargeThroughputWh: double('charge_throughput_wh'),
    dischargeThroughputWh: double('discharge_throughput_wh'),
    trips: int('trips').notNull().default(0),
  },
  (table) => [index('pack_health_address_at').on(table.address, table.at)],
);
