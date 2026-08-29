import type {
  EuroStats,
  PackCells,
  PackInfo,
  PackStat,
  PackSummary,
  Snapshot,
  StackTotals,
} from '@libs/protocol';

/** Prometheus refuses a scrape served as anything but the 0.0.4 text exposition format. */
export const METRICS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

type MetricType = 'counter' | 'gauge';

type Labels = Record<string, string | number>;

interface Sample {
  labels: Labels;
  value: number;
}

interface Family {
  type: MetricType;
  help: string;
  samples: Sample[];
}

const MILLI = 1000;
const PERCENT = 100;

const escapeText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');

const escapeLabel = (value: string): string =>
  escapeText(value).replace(/"/g, '\\"');

/** Float64 either way; the rounding only stops 52.4 * -1.2 printing its binary tail. */
const formatValue = (value: number): string => String(Number(value.toFixed(6)));

function renderLabels(labels: Labels): string {
  const pairs = Object.entries(labels)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}="${escapeLabel(String(value))}"`);

  return pairs.length ? `{${pairs.join(',')}}` : '';
}

/**
 * Samples are grouped under the name they were first added with: the exposition format requires
 * every series of a family to sit together beneath one HELP and TYPE pair.
 */
class Registry {
  private readonly families = new Map<string, Family>();

  add(
    name: string,
    type: MetricType,
    help: string,
    value: number | null | undefined,
    labels: Labels = {},
  ): void {
    // A figure the console has not returned yet leaves a gap; a zero would read as a measurement.
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return;
    }

    const family = this.families.get(name) ?? { type, help, samples: [] };

    family.samples.push({ labels, value });
    this.families.set(name, family);
  }

  render(): string {
    const lines: string[] = [];

    for (const [name, family] of this.families) {
      lines.push(`# HELP ${name} ${escapeText(family.help)}`);
      lines.push(`# TYPE ${name} ${family.type}`);

      for (const sample of family.samples) {
        lines.push(
          `${name}${renderLabels(sample.labels)} ${formatValue(sample.value)}`,
        );
      }
    }

    return `${lines.join('\n')}\n`;
  }
}

function collectTotals(registry: Registry, totals: StackTotals): void {
  registry.add(
    'pylontech_stack_packs',
    'gauge',
    'Pack addresses the BMS enumerates, present or not.',
    totals.packCount,
  );
  registry.add(
    'pylontech_stack_packs_present',
    'gauge',
    'Enumerated packs that answered as populated.',
    totals.presentCount,
  );
  registry.add(
    'pylontech_stack_packs_rated',
    'gauge',
    'Present packs with a readable nameplate; below the present count, stack energy is partial.',
    totals.ratedPackCount,
  );
  registry.add(
    'pylontech_stack_cells',
    'gauge',
    'Cells across every present pack.',
    totals.cellCount,
  );
  registry.add(
    'pylontech_stack_alarm',
    'gauge',
    'Whether any present pack reports a state other than normal.',
    totals.alarm ? 1 : 0,
  );

  if (totals.manufacturer || totals.models.length) {
    registry.add(
      'pylontech_stack_info',
      'gauge',
      'Nameplate identity of the stack; more than one model means a mixed stack.',
      1,
      {
        manufacturer: totals.manufacturer ?? '',
        models: totals.models.join(','),
      },
    );
  }

  if (!totals.presentCount) {
    return;
  }

  registry.add(
    'pylontech_stack_voltage_volts',
    'gauge',
    'Bus voltage, averaged over the present packs.',
    totals.voltage,
  );
  registry.add(
    'pylontech_stack_current_amperes',
    'gauge',
    'Stack current, summed over the present packs; positive charges.',
    totals.current,
  );
  registry.add(
    'pylontech_stack_power_watts',
    'gauge',
    'Stack power; positive charges.',
    totals.power,
  );
  registry.add(
    'pylontech_stack_state_of_charge_ratio',
    'gauge',
    'State of charge across the stack, 0 to 1.',
    totals.soc / PERCENT,
  );
  registry.add(
    'pylontech_stack_energy_nominal_watt_hours',
    'gauge',
    'Summed nameplate energy of the packs with a readable specification.',
    totals.energyNominal,
  );
  registry.add(
    'pylontech_stack_energy_remaining_watt_hours',
    'gauge',
    'Nameplate energy scaled by the state of charge.',
    totals.energyRemaining,
  );
  registry.add(
    'pylontech_stack_cell_spread_volts',
    'gauge',
    'Widest cell spread of any pack in the stack.',
    totals.worstSpread / MILLI,
  );
  registry.add(
    'pylontech_stack_temperature_min_celsius',
    'gauge',
    'Coldest cell temperature reported across the stack.',
    totals.tempMin,
  );
  registry.add(
    'pylontech_stack_temperature_max_celsius',
    'gauge',
    'Hottest cell temperature reported across the stack.',
    totals.tempMax,
  );
}

function collectPack(registry: Registry, pack: PackSummary): void {
  const labels = { pack: pack.address };

  registry.add(
    'pylontech_pack_present',
    'gauge',
    'Whether the pack at this address answered as populated.',
    pack.present ? 1 : 0,
    labels,
  );

  if (!pack.present) {
    return;
  }

  registry.add(
    'pylontech_pack_voltage_volts',
    'gauge',
    'Pack terminal voltage.',
    pack.voltage,
    labels,
  );
  registry.add(
    'pylontech_pack_current_amperes',
    'gauge',
    'Pack current; positive charges.',
    pack.current,
    labels,
  );
  registry.add(
    'pylontech_pack_power_watts',
    'gauge',
    'Pack power; positive charges.',
    pack.voltage * pack.current,
    labels,
  );
  registry.add(
    'pylontech_pack_state_of_charge_ratio',
    'gauge',
    'Pack state of charge, 0 to 1.',
    pack.soc / PERCENT,
    labels,
  );
  registry.add(
    'pylontech_pack_temperature_celsius',
    'gauge',
    'Pack ambient temperature.',
    pack.temperature,
    labels,
  );
  registry.add(
    'pylontech_pack_temperature_min_celsius',
    'gauge',
    'Coldest cell temperature in the pack.',
    pack.tempLow,
    labels,
  );
  registry.add(
    'pylontech_pack_temperature_max_celsius',
    'gauge',
    'Hottest cell temperature in the pack.',
    pack.tempHigh,
    labels,
  );
  registry.add(
    'pylontech_pack_mosfet_temperature_celsius',
    'gauge',
    'Temperature of the pack switching MOSFETs.',
    pack.mosTemperature,
    labels,
  );
  registry.add(
    'pylontech_pack_cell_voltage_min_volts',
    'gauge',
    'Lowest cell voltage in the pack.',
    pack.cellLow / MILLI,
    labels,
  );
  registry.add(
    'pylontech_pack_cell_voltage_max_volts',
    'gauge',
    'Highest cell voltage in the pack.',
    pack.cellHigh / MILLI,
    labels,
  );
  registry.add(
    'pylontech_pack_alarm',
    'gauge',
    'Whether the pack reports any state other than normal.',
    pack.systemAlarm !== 'Normal' ||
      pack.voltState !== 'Normal' ||
      pack.currState !== 'Normal' ||
      pack.tempState !== 'Normal'
      ? 1
      : 0,
    labels,
  );
  registry.add(
    'pylontech_pack_state_info',
    'gauge',
    'The states the pack reports, verbatim.',
    1,
    {
      ...labels,
      base: pack.baseState,
      voltage: pack.voltState,
      current: pack.currState,
      temperature: pack.tempState,
      alarm: pack.systemAlarm,
    },
  );
}

function collectCells(registry: Registry, pack: PackCells): void {
  const labels = { pack: pack.address };

  registry.add(
    'pylontech_pack_cells',
    'gauge',
    'Cells the pack reported in its last per-cell sweep.',
    pack.cells.length,
    labels,
  );
  registry.add(
    'pylontech_pack_cells_balancing',
    'gauge',
    'Cells the pack is currently balancing.',
    pack.cells.filter((cell) => cell.balancing).length,
    labels,
  );

  if (!pack.cells.length) {
    return;
  }

  registry.add(
    'pylontech_pack_cell_spread_volts',
    'gauge',
    'Difference between the highest and lowest cell in the pack.',
    pack.spread / MILLI,
    labels,
  );
  registry.add(
    'pylontech_pack_cell_mean_volts',
    'gauge',
    'Mean cell voltage across the pack.',
    pack.mean / MILLI,
    labels,
  );

  for (const cell of pack.cells) {
    const cellLabels = { ...labels, cell: cell.index };

    registry.add(
      'pylontech_cell_voltage_volts',
      'gauge',
      'Voltage of a single cell.',
      cell.voltage / MILLI,
      cellLabels,
    );
    registry.add(
      'pylontech_cell_temperature_celsius',
      'gauge',
      'Temperature reported for a single cell.',
      cell.temperature,
      cellLabels,
    );
    registry.add(
      'pylontech_cell_state_of_charge_ratio',
      'gauge',
      'State of charge of a single cell, 0 to 1.',
      cell.soc / PERCENT,
      cellLabels,
    );
    registry.add(
      'pylontech_cell_balancing',
      'gauge',
      'Whether the pack is bleeding charge off this cell.',
      cell.balancing ? 1 : 0,
      cellLabels,
    );
  }
}

function collectInfo(registry: Registry, info: PackInfo): void {
  const labels = { pack: info.address };

  registry.add(
    'pylontech_pack_info',
    'gauge',
    'Nameplate and firmware identity of the pack.',
    1,
    {
      ...labels,
      manufacturer: info.manufacturer,
      device_name: info.deviceName,
      specification: info.specification,
      barcode: info.barcode,
      board_version: info.boardVersion,
      main_soft_version: info.mainSoftVersion,
      soft_version: info.softVersion,
      release_date: info.releaseDate,
    },
  );
  registry.add(
    'pylontech_pack_rated_cells',
    'gauge',
    'Cells the pack declares on its nameplate.',
    info.cellNumber,
    labels,
  );
  registry.add(
    'pylontech_pack_max_charge_current_amperes',
    'gauge',
    'Charge current the pack declares as its limit.',
    info.maxChargeCurrent,
    labels,
  );
  registry.add(
    'pylontech_pack_max_discharge_current_amperes',
    'gauge',
    'Discharge current the pack declares as its limit.',
    info.maxDischargeCurrent,
    labels,
  );
}

function collectStat(registry: Registry, stat: PackStat): void {
  const labels = { pack: stat.address };

  registry.add(
    'pylontech_pack_state_of_health_ratio',
    'gauge',
    'Firmware-computed state of health, 0 to 1; some builds never populate it.',
    stat.soh / PERCENT,
    labels,
  );
  registry.add(
    'pylontech_pack_power_ratio',
    'gauge',
    'Power percentage the pack reports for itself, 0 to 1.',
    stat.powerPercent / PERCENT,
    labels,
  );
  registry.add(
    'pylontech_pack_charge_amp_hours',
    'gauge',
    'Coulomb counter the pack currently holds.',
    stat.coulombAh,
    labels,
  );
  registry.add(
    'pylontech_pack_log_data_items',
    'gauge',
    'Rows the pack holds in its live onboard log.',
    stat.dataItems,
    labels,
  );
  registry.add(
    'pylontech_pack_log_history_items',
    'gauge',
    'Rows the pack holds in its archived onboard log.',
    stat.historyItems,
    labels,
  );
  registry.add(
    'pylontech_pack_cycles_total',
    'counter',
    'Charge and discharge cycles over the life of the pack.',
    stat.cycleTimes,
    labels,
  );
  registry.add(
    'pylontech_pack_charge_events_total',
    'counter',
    'Times the pack has entered charge over its life.',
    stat.chargeTimes,
    labels,
  );
  registry.add(
    'pylontech_pack_idle_events_total',
    'counter',
    'Times the pack has entered idle over its life.',
    stat.idleTimes,
    labels,
  );
  registry.add(
    'pylontech_pack_shutdowns_total',
    'counter',
    'Times the pack has powered itself down over its life.',
    stat.shutTimes,
    labels,
  );
  registry.add(
    'pylontech_pack_resets_total',
    'counter',
    'Times the pack controller has restarted.',
    stat.resetTimes,
    labels,
  );
  registry.add(
    'pylontech_pack_health_recalculations_total',
    'counter',
    'Times the pack has recalculated its own state of health.',
    stat.sohTimes,
    labels,
  );
  registry.add(
    'pylontech_pack_life_warnings_total',
    'counter',
    'Life warnings raised over the life of the pack.',
    stat.lifeWarnTimes,
    labels,
  );
  registry.add(
    'pylontech_pack_life_alarms_total',
    'counter',
    'Life alarms raised over the life of the pack.',
    stat.lifeAlarmTimes,
    labels,
  );
  registry.add(
    'pylontech_pack_discharged_amp_hours_total',
    'counter',
    'Cumulative discharge over the life of the pack.',
    stat.dischargeCapacity / MILLI,
    labels,
  );

  for (const [condition, value] of Object.entries(stat.counters)) {
    registry.add(
      'pylontech_pack_condition_events_total',
      'counter',
      'Operating conditions the pack has counted; conditions seen, not protection trips.',
      value,
      { ...labels, condition },
    );
  }

  for (const [protection, value] of Object.entries(stat.faults)) {
    registry.add(
      'pylontech_pack_protection_events_total',
      'counter',
      'Protection trips the pack has counted; every one of these should read zero.',
      value,
      { ...labels, protection },
    );
  }
}

/** Carries no pack label: this command answers only for the pack holding the console cable. */
function collectEuro(registry: Registry, euro: EuroStats): void {
  registry.add(
    'pylontech_euro_info',
    'gauge',
    'Manufacture and service dates of the pack holding the console cable.',
    1,
    {
      date_of_manufacture: euro.dateOfManufacture,
      date_in_service: euro.dateInService,
      storage: euro.storageDays,
    },
  );
  registry.add(
    'pylontech_euro_remaining_capacity_amp_hours',
    'gauge',
    'Measured remaining capacity, against the nameplate rather than a computed percentage.',
    euro.remainCapacity,
    { index: 1 },
  );
  registry.add(
    'pylontech_euro_remaining_capacity_amp_hours',
    'gauge',
    'Measured remaining capacity, against the nameplate rather than a computed percentage.',
    euro.remainCapacity2,
    { index: 2 },
  );
  registry.add(
    'pylontech_euro_remaining_energy_watt_hours',
    'gauge',
    'Measured remaining energy.',
    euro.remainPower,
  );
  registry.add(
    'pylontech_euro_round_trip_efficiency_ratio',
    'gauge',
    'Measured round trip efficiency, 0 to 1.',
    euro.roundTripEfficiency / PERCENT,
  );
  registry.add(
    'pylontech_euro_self_discharge_rate_ratio',
    'gauge',
    'Measured self discharge rate, 0 to 1.',
    euro.selfDischargeRate / PERCENT,
  );
  registry.add(
    'pylontech_euro_internal_resistance_ohms',
    'gauge',
    'Measured internal resistance.',
    euro.resistanceMilliOhm / MILLI,
  );
  registry.add(
    'pylontech_euro_charge_energy_watt_hours_total',
    'counter',
    'Cumulative energy taken in over the life of the pack.',
    euro.chargeEnergyThroughput,
  );
  registry.add(
    'pylontech_euro_discharge_energy_watt_hours_total',
    'counter',
    'Cumulative energy given out over the life of the pack.',
    euro.dischargeEnergyThroughput,
  );
  registry.add(
    'pylontech_euro_charge_capacity_amp_hours_total',
    'counter',
    'Cumulative charge taken in over the life of the pack.',
    euro.chargeCapacityThroughput,
  );
  registry.add(
    'pylontech_euro_discharge_capacity_amp_hours_total',
    'counter',
    'Cumulative charge given out over the life of the pack.',
    euro.dischargeCapacityThroughput,
  );
  registry.add(
    'pylontech_euro_deep_discharges_total',
    'counter',
    'Deep discharges over the life of the pack.',
    euro.deepDischargeCount,
  );
  registry.add(
    'pylontech_euro_extreme_temperature_seconds_total',
    'counter',
    'Time the pack has spent outside its temperature window.',
    euro.extremeTempSeconds,
  );
  registry.add(
    'pylontech_euro_extreme_temperature_charge_seconds_total',
    'counter',
    'Time the pack has spent charging outside its temperature window.',
    euro.extremeTempChargeSeconds,
  );
  registry.add(
    'pylontech_euro_cycles_total',
    'counter',
    'Charge and discharge cycles measured over the life of the pack.',
    euro.cycles,
    { index: 1 },
  );
  registry.add(
    'pylontech_euro_cycles_total',
    'counter',
    'Charge and discharge cycles measured over the life of the pack.',
    euro.cycles2,
    { index: 2 },
  );
}

/**
 * Renders the snapshot the API already serves as one scrape. Nothing here reads the console: an
 * absent pack, a dead link or a snapshot from before the first sweep each yield fewer series,
 * never a malformed page.
 */
export function renderMetrics(
  snapshot: Snapshot,
  now: number = Date.now(),
): string {
  const registry = new Registry();
  const polledAt = snapshot.updatedAt ? Date.parse(snapshot.updatedAt) : NaN;

  registry.add(
    'pylontech_up',
    'gauge',
    'Always 1: the daemon answered this scrape.',
    1,
  );
  registry.add(
    'pylontech_serial_connected',
    'gauge',
    'Whether the daemon currently holds the console serial port open.',
    snapshot.connected ? 1 : 0,
  );

  if (snapshot.port) {
    registry.add(
      'pylontech_serial_info',
      'gauge',
      'The serial device the console is read through.',
      1,
      { port: snapshot.port },
    );
  }

  registry.add(
    'pylontech_last_poll_timestamp_seconds',
    'gauge',
    'When the last power sweep that returned data landed.',
    polledAt / MILLI,
  );
  registry.add(
    'pylontech_last_poll_age_seconds',
    'gauge',
    'Age of the last power sweep that returned data.',
    (now - polledAt) / MILLI,
  );

  if (snapshot.totals) {
    collectTotals(registry, snapshot.totals);
  }

  for (const pack of snapshot.packs) {
    collectPack(registry, pack);
  }

  for (const cells of Object.values(snapshot.cells)) {
    collectCells(registry, cells);
  }

  for (const info of Object.values(snapshot.info)) {
    collectInfo(registry, info);
  }

  for (const stat of Object.values(snapshot.stats)) {
    collectStat(registry, stat);
  }

  if (snapshot.euro) {
    collectEuro(registry, snapshot.euro);
  }

  return registry.render();
}
