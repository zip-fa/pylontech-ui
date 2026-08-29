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
      ...conditions.map((key, index) =>
        row(
          `${key} events`,
          undefined,
          (s) => count(s?.counters[key] ?? 0),
          (s) => ((s?.counters[key] ?? 0) > 0 ? 'warn' : 'ok'),
          index === 0,
        ),
      ),
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

/** Every protection counter the pack keeps. All zero is the answer you want here. */
export function PackFaultCounters({ addresses, stats }: PackFaultsProps) {
  const present = addresses
    .map((address) => stats[address])
    .filter((stat): stat is PackStat => Boolean(stat));
  const keys = keysAcross(present, (s) => s.faults);

  if (keys.length === 0) return null;

  const rows: MetricRow[] = keys.map((key) => ({
    label: key,
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
