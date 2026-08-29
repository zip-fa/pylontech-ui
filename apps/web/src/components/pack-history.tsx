import type { PackStat } from '@libs/protocol';
import type { ParseKeys, TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

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

/** Only the abbreviations. Rows whose label already reads as prose carry no explanation. */
const HINTS: Record<string, ParseKeys | undefined> = {
  'lifetime.sohRecalculations': 'hints.soh',
};

/** The `Cnt` family, spelled out. Firmware may report others; those fall back to the family text. */
const CONDITION_TERMS: Record<string, ParseKeys | undefined> = {
  HT: 'hints.condition.HT',
  LT: 'hints.condition.LT',
  HV: 'hints.condition.HV',
  LV: 'hints.condition.LV',
};

function conditionHint(t: TFunction, key: string): string {
  const term = CONDITION_TERMS[key.toUpperCase()];

  return term
    ? t('hints.condition.known', { term: t(term) })
    : t('hints.condition.unknown');
}

export function PackHistory({ addresses, stats }: PackHistoryProps) {
  const { t } = useTranslation();

  const present = addresses
    .map((address) => stats[address])
    .filter((stat): stat is PackStat => Boolean(stat));

  const row = (
    key: ParseKeys,
    unit: string | undefined,
    render: (stat: PackStat | undefined) => string,
    tone?: (stat: PackStat | undefined) => 'ok' | 'warn' | 'critical',
    group?: boolean,
  ): MetricRow => {
    const hint = HINTS[key];

    return {
      id: key,
      label: t(key),
      unit,
      group,
      hint: hint ? t(hint) : undefined,
      cells: addresses.map((address) => ({
        value: render(stats[address]),
        tone: tone?.(stats[address]),
      })),
    };
  };

  const rows: MetricRow[] = [
    row('lifetime.cycles', undefined, (s) => count(s?.cycleTimes)),
    // Some firmware never populates SOH and reports a flat zero; say so rather than show 0 %.
    row('lifetime.soh', '%', (s) =>
      s === undefined
        ? '—'
        : s.soh > 0
          ? num(s.soh, 0)
          : t('lifetime.notReported'),
    ),
    row('lifetime.chargeCounter', '%', (s) => int(s?.powerPercent)),
    row('lifetime.chargeHeld', 'Ah', (s) => num(s?.coulombAh, 1)),
    row('lifetime.dischargeTotal', 'Ah', (s) =>
      mahAsAh(s?.dischargeCapacity, 0),
    ),

    row(
      'lifetime.chargePeriods',
      undefined,
      (s) => count(s?.chargeTimes),
      undefined,
      true,
    ),
    row('lifetime.idlePeriods', undefined, (s) => count(s?.idleTimes)),
    row('lifetime.resets', undefined, (s) => count(s?.resetTimes)),
    row('lifetime.shutdowns', undefined, (s) => count(s?.shutTimes)),
    row('lifetime.sohRecalculations', undefined, (s) => count(s?.sohTimes)),

    row(
      'lifetime.warnings',
      undefined,
      (s) => count(s?.lifeWarnTimes),
      (s) => ((s?.lifeWarnTimes ?? 0) > 0 ? 'warn' : 'ok'),
      true,
    ),
    row(
      'lifetime.alarms',
      undefined,
      (s) => count(s?.lifeAlarmTimes),
      (s) => ((s?.lifeAlarmTimes ?? 0) > 0 ? 'critical' : 'ok'),
    ),

    row(
      'lifetime.logLive',
      undefined,
      (s) => count(s?.dataItems),
      undefined,
      true,
    ),
    row('lifetime.logArchived', undefined, (s) => count(s?.historyItems)),
  ];

  const conditions = keysAcross(present, (s) => s.counters);

  if (conditions.length > 0) {
    // The counter's own name is the firmware's, so only the sentence around it is translated.
    rows.push(
      ...conditions.map((key, index) => ({
        ...row(
          'lifetime.events',
          undefined,
          (s) => count(s?.counters[key] ?? 0),
          (s) => ((s?.counters[key] ?? 0) > 0 ? 'warn' : 'ok'),
          index === 0,
        ),
        id: `counter:${key}`,
        label: t('lifetime.events', { key }),
        hint: conditionHint(t, key),
      })),
    );
  }

  return (
    <MetricGrid
      corner={t('grid.lifetime')}
      columns={addresses.map((address) => t('grid.pack', { address }))}
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
const FAULT_TERMS: Record<string, ParseKeys | undefined> = {
  'BAT OV': 'hints.fault.BAT OV',
  'BAT UV': 'hints.fault.BAT UV',
  'CELL OV': 'hints.fault.CELL OV',
  'CELL UV': 'hints.fault.CELL UV',
  COC: 'hints.fault.COC',
  DOC: 'hints.fault.DOC',
  SC: 'hints.fault.SC',
  COTP: 'hints.fault.COTP',
  CUTP: 'hints.fault.CUTP',
  DOTP: 'hints.fault.DOTP',
  DUTP: 'hints.fault.DUTP',
  'MOS OTP': 'hints.fault.MOS OTP',
  'ENV OTP': 'hints.fault.ENV OTP',
  'ENV UTP': 'hints.fault.ENV UTP',
};

function faultHint(t: TFunction, key: string): string {
  const term = FAULT_TERMS[key.toUpperCase()];

  return term
    ? t('hints.fault.known', { term: t(term) })
    : t('hints.fault.unknown', { key });
}

/** Every protection counter the pack keeps. All zero is the answer you want here. */
export function PackFaultCounters({ addresses, stats }: PackFaultsProps) {
  const { t } = useTranslation();

  const present = addresses
    .map((address) => stats[address])
    .filter((stat): stat is PackStat => Boolean(stat));
  const keys = keysAcross(present, (s) => s.faults);

  if (keys.length === 0) {
    return null;
  }

  // The row label is the protection's console name — the same word in every language.
  const rows: MetricRow[] = keys.map((key) => ({
    label: key,
    hint: faultHint(t, key),
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
      corner={t('grid.protection')}
      columns={addresses.map((address) => t('grid.pack', { address }))}
      rows={rows}
    />
  );
}
