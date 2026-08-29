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

/**
 * The `Cnt` family, spelled out, keyed exactly as the console prints it. Uppercasing the key
 * first would turn `HT@0.5C` into a row this table cannot name, and there is nothing to gain:
 * the firmware spells these the same way every time. `HT@0.5C` and `LT@0.5C` keep the decimal
 * point out of their translation keys because i18next splits keys on dots.
 */
const CONDITION_TERMS: Record<string, ParseKeys | undefined> = {
  Charge: 'hints.condition.Charge',
  Discharge: 'hints.condition.Discharge',
  Status: 'hints.condition.Status',
  'HT@0.5C': 'hints.condition.HTat05C',
  'LT@0.5C': 'hints.condition.LTat05C',
  HT: 'hints.condition.HT',
  LT: 'hints.condition.LT',
  LV: 'hints.condition.LV',
};

/**
 * Rows the firmware files under `Cnt` that count no condition at all — `Status` reads in the
 * thousands on a healthy pack. Saying they are not a disconnection would imply they are a fault,
 * so their text stands alone instead of taking the family sentence.
 */
const NOT_A_CONDITION = new Set(['Charge', 'Discharge', 'Status']);

function conditionHint(t: TFunction, key: string): string {
  const term = CONDITION_TERMS[key];

  if (!term) {
    return t('hints.condition.unknown');
  }

  return NOT_A_CONDITION.has(key)
    ? t(term)
    : t('hints.condition.known', { term: t(term) });
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
 * Every protection this firmware emits, keyed as the console spells it — mixed case and all.
 * The old table uppercased the key first and so looked for `BAT OV`, which is not what comes
 * back; almost everything missed and fell through to the generic text. Firmware that reports a
 * name not listed here still gets the family explanation rather than a guess at the letters.
 */
const FAULT_TERMS: Record<string, ParseKeys | undefined> = {
  COC: 'hints.fault.COC',
  COC2: 'hints.fault.COC2',
  COCA: 'hints.fault.COCA',
  DOC: 'hints.fault.DOC',
  DOC2: 'hints.fault.DOC2',
  DOCA: 'hints.fault.DOCA',
  SC: 'hints.fault.SC',
  'Bat OV': 'hints.fault.Bat OV',
  'Bat HV': 'hints.fault.Bat HV',
  'Bat LV': 'hints.fault.Bat LV',
  'Bat UV': 'hints.fault.Bat UV',
  'Bat SLP': 'hints.fault.Bat SLP',
  'Pwr OV': 'hints.fault.Pwr OV',
  'Pwr HV': 'hints.fault.Pwr HV',
  'Pwr LV': 'hints.fault.Pwr LV',
  'Pwr UV': 'hints.fault.Pwr UV',
  'Pwr SLP': 'hints.fault.Pwr SLP',
  COT: 'hints.fault.COT',
  CUT: 'hints.fault.CUT',
  DOT: 'hints.fault.DOT',
  DUT: 'hints.fault.DUT',
  CHT: 'hints.fault.CHT',
  CLT: 'hints.fault.CLT',
  DHT: 'hints.fault.DHT',
  DLT: 'hints.fault.DLT',
  RV: 'hints.fault.RV',
  'Input OV': 'hints.fault.Input OV',
  BMICERR: 'hints.fault.BMICERR',
  'Log Charge': 'hints.fault.Log Charge',
};

function faultHint(t: TFunction, key: string): string {
  const term = FAULT_TERMS[key];

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
