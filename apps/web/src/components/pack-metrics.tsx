import type { PackCells, PackSummary } from '@libs/protocol';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';

import { MetricGrid, type MetricRow } from '@/components/metric-grid';
import { int, num, signed } from '@/lib/format';
import { spreadSeverity, stateSeverity } from '@/lib/severity';

export interface PackMetricsProps {
  packs: PackSummary[];
  cells: Record<number, PackCells>;
}

/** Only the abbreviations. Rows whose label already reads as prose carry no explanation. */
const HINTS: Record<string, ParseKeys | undefined> = {
  'metrics.mosTemperature': 'hints.mosfet',
};

/** Every figure `pwr` reports, plus what `bat` adds about the cells inside each pack. */
export function PackMetrics({ packs, cells }: PackMetricsProps) {
  const { t } = useTranslation();

  const row = (
    key: ParseKeys,
    unit: string | undefined,
    render: (pack: PackSummary, cells?: PackCells) => string,
    tone?: (pack: PackSummary, cells?: PackCells) => 'ok' | 'warn' | 'critical',
    group?: boolean,
  ): MetricRow => {
    const hint = HINTS[key];

    return {
      id: key,
      label: t(key),
      unit,
      group,
      hint: hint ? t(hint) : undefined,
      cells: packs.map((pack) => ({
        value: render(pack, cells[pack.address]),
        tone: tone?.(pack, cells[pack.address]),
      })),
    };
  };

  // The state fields carry the console's own words, so they are printed, never translated.
  const rows: MetricRow[] = [
    row('metrics.soc', '%', (p) => num(p.soc, 0)),
    row('metrics.voltage', 'V', (p) => num(p.voltage, 3)),
    row('metrics.current', 'A', (p) => signed(p.current, 2)),
    row('metrics.power', 'W', (p) => signed(p.voltage * p.current, 0)),
    row('metrics.workingState', undefined, (p) => p.baseState),

    row(
      'metrics.cellTemperature',
      '°C',
      (p) => num(p.temperature, 1),
      undefined,
      true,
    ),
    row('metrics.mosTemperature', '°C', (p) => num(p.mosTemperature, 1)),
    row(
      'metrics.coolestCell',
      '°C',
      (p) => `${num(p.tempLow, 1)}  #${int(p.tempLowId)}`,
    ),
    row(
      'metrics.hottestCell',
      '°C',
      (p) => `${num(p.tempHigh, 1)}  #${int(p.tempHighId)}`,
    ),

    row(
      'metrics.lowestCell',
      'mV',
      (p) => `${int(p.cellLow)}  #${int(p.cellLowId)}`,
      undefined,
      true,
    ),
    row(
      'metrics.highestCell',
      'mV',
      (p) => `${int(p.cellHigh)}  #${int(p.cellHighId)}`,
    ),
    row(
      'metrics.cellSpread',
      'mV',
      (_p, c) => int(c?.spread),
      (_p, c) => spreadSeverity(c?.spread ?? Number.NaN),
    ),
    row('metrics.cellMean', 'mV', (_p, c) => int(c?.mean)),
    row('metrics.cellsRead', undefined, (_p, c) => int(c?.cells.length)),
    row('metrics.balancingNow', undefined, (_p, c) =>
      int(c?.cells.filter((cell) => cell.balancing).length ?? 0),
    ),

    row(
      'metrics.voltState',
      undefined,
      (p) => p.voltState,
      (p) => stateSeverity(p.voltState),
      true,
    ),
    row(
      'metrics.currState',
      undefined,
      (p) => p.currState,
      (p) => stateSeverity(p.currState),
    ),
    row(
      'metrics.tempState',
      undefined,
      (p) => p.tempState,
      (p) => stateSeverity(p.tempState),
    ),
    row(
      'metrics.systemAlarm',
      undefined,
      (p) => p.systemAlarm,
      (p) => stateSeverity(p.systemAlarm),
    ),

    row(
      'metrics.timestamp',
      undefined,
      (p) => p.timestamp || '—',
      undefined,
      true,
    ),
  ];

  return (
    <MetricGrid
      corner={t('grid.live')}
      columns={packs.map((pack) => t('grid.pack', { address: pack.address }))}
      rows={rows}
    />
  );
}
