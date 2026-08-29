import type { PackStat } from '@libs/protocol';

import { MetricGrid, type MetricRow } from '@/components/metric-grid';
import { count, int, mahAsAh, num } from '@/lib/format';

export interface PackHistoryProps {
  addresses: number[];
  stats: Record<number, PackStat>;
}

/** Union of the counter keys across packs, so a pack on older firmware still lines up. */
function keysAcross(
  stats: PackStat[],
  pick: (stat: PackStat) => Record<string, number>,
): string[] {
  return [...new Set(stats.flatMap((stat) => Object.keys(pick(stat))))].sort();
}

/** Only the abbreviations. Rows whose label already reads as English carry no explanation. */
const HINTS: Record<string, string> = {
  'SOH recalculations':
    'How many times the pack has recalculated its own state of health. Zero here explains a state-of-health figure that never moves.',
};

/** The `Cnt` family, spelled out. Firmware may report others; those fall back to the family text. */
const CONDITION_TERMS: Record<string, string> = {
  HT: 'ran hotter than its normal band',
  LT: 'ran colder than its normal band',
  HV: 'sat above its normal voltage band',
  LV: 'sat below its normal voltage band',
};

function conditionHint(key: string): string {
  const term = CONDITION_TERMS[key.toUpperCase()];

  return `${term ? `How many times this pack has ${term}.` : 'A condition counter the firmware keeps under this name.'} It counts the condition being seen, not a disconnection — times the BMS actually cut the pack out are on the Protection tab.`;
}

export function PackHistory({ addresses, stats }: PackHistoryProps) {
  const present = addresses
    .map((address) => stats[address])
    .filter((stat): stat is PackStat => Boolean(stat));

  const row = (
    label: string,
    unit: string | undefined,
    render: (stat: PackStat | undefined) => string,
    tone?: (stat: PackStat | undefined) => 'ok' | 'warn' | 'critical',
    group?: boolean,
  ): MetricRow => ({
    label,
    unit,
    group,
    hint: HINTS[label],
    cells: addresses.map((address) => ({
      value: render(stats[address]),
      tone: tone?.(stats[address]),
    })),
  });

  const rows: MetricRow[] = [
    row('Charge cycles', undefined, (s) => count(s?.cycleTimes)),
    // Some firmware never populates SOH and reports a flat zero; say so rather than show 0 %.
    row('State of health', '%', (s) =>
      s === undefined ? '—' : s.soh > 0 ? num(s.soh, 0) : 'not reported',
    ),
    row('Charge counter', '%', (s) => int(s?.powerPercent)),
    row('Charge held', 'Ah', (s) => num(s?.coulombAh, 1)),
    row('Lifetime discharge', 'Ah', (s) => mahAsAh(s?.dischargeCapacity, 0)),

    row(
      'Charge periods',
      undefined,
      (s) => count(s?.chargeTimes),
      undefined,
      true,
    ),
    row('Idle periods', undefined, (s) => count(s?.idleTimes)),
    row('Resets', undefined, (s) => count(s?.resetTimes)),
    row('Shutdowns', undefined, (s) => count(s?.shutTimes)),
    row('SOH recalculations', undefined, (s) => count(s?.sohTimes)),

    row(
      'Life warnings',
      undefined,
      (s) => count(s?.lifeWarnTimes),
      (s) => ((s?.lifeWarnTimes ?? 0) > 0 ? 'warn' : 'ok'),
      true,
    ),
    row(
      'Life alarms',
      undefined,
      (s) => count(s?.lifeAlarmTimes),
      (s) => ((s?.lifeAlarmTimes ?? 0) > 0 ? 'critical' : 'ok'),
    ),

    row(
      'Log rows, live',
      undefined,
      (s) => count(s?.dataItems),
      undefined,
      true,
    ),
    row('Log rows, archived', undefined, (s) => count(s?.historyItems)),
  ];

  const conditions = keysAcross(present, (s) => s.counters);

  if (conditions.length > 0) {
    rows.push(
      ...conditions.map((key, index) => ({
        ...row(
          `${key} events`,
          undefined,
          (s) => count(s?.counters[key] ?? 0),
          (s) => ((s?.counters[key] ?? 0) > 0 ? 'warn' : 'ok'),
          index === 0,
        ),
        hint: conditionHint(key),
      })),
    );
  }

  return (
    <MetricGrid
      corner="Lifetime"
      columns={addresses.map((address) => `Pack ${address}`)}
      rows={rows}
    />
  );
}

export interface PackFaultsProps {
  addresses: number[];
  stats: Record<number, PackStat>;
}

/**
 * Standard BMS shorthand, as the console prints it. Anything the firmware reports under a name
 * that is not here still gets the family explanation rather than a guess at the abbreviation.
 */
const FAULT_TERMS: Record<string, string> = {
  'BAT OV': "the whole pack's voltage rose above its limit on charge",
  'BAT UV': "the whole pack's voltage fell below its limit on discharge",
  'CELL OV': 'a single cell rose above its voltage limit on charge',
  'CELL UV': 'a single cell fell below its voltage limit on discharge',
  COC: 'the charging current went over the limit',
  DOC: 'the discharging current went over the limit',
  SC: 'a short circuit was seen across the output',
  COTP: 'the cells were too hot to charge safely',
  CUTP: 'the cells were too cold to charge safely',
  DOTP: 'the cells were too hot to discharge safely',
  DUTP: 'the cells were too cold to discharge safely',
  'MOS OTP': 'the power switches ran too hot',
  'ENV OTP': 'the air around the pack was too hot',
  'ENV UTP': 'the air around the pack was too cold',
};

function faultHint(key: string): string {
  const term = FAULT_TERMS[key.toUpperCase()];

  return `${term ? `Times the BMS cut this pack out of the circuit because ${term}.` : `Times the BMS cut this pack out of the circuit, under the name the firmware gives this protection ("${key}").`} The count runs from the factory and never resets, so a figure above zero may be years old rather than a fault happening now.`;
}

/** Every protection counter the pack keeps. All zero is the answer you want here. */
export function PackFaultCounters({ addresses, stats }: PackFaultsProps) {
  const present = addresses
    .map((address) => stats[address])
    .filter((stat): stat is PackStat => Boolean(stat));
  const keys = keysAcross(present, (s) => s.faults);

  if (keys.length === 0) {
    return null;
  }

  const rows: MetricRow[] = keys.map((key) => ({
    label: key,
    hint: faultHint(key),
    cells: addresses.map((address) => {
      const value = stats[address]?.faults[key];

      return {
        value: value === undefined ? '—' : count(value),
        tone: (value ?? 0) > 0 ? ('critical' as const) : ('ok' as const),
      };
    }),
  }));

  return (
    <MetricGrid
      corner="Protection trips"
      columns={addresses.map((address) => `Pack ${address}`)}
      rows={rows}
    />
  );
}
