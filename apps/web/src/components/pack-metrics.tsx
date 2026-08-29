import type { PackCells, PackSummary } from '@libs/protocol';

import { MetricGrid, type MetricRow } from '@/components/metric-grid';
import { int, num, signed } from '@/lib/format';
import { spreadSeverity, stateSeverity } from '@/lib/severity';

export interface PackMetricsProps {
  packs: PackSummary[];
  cells: Record<number, PackCells>;
}

/** Only the abbreviations. Rows whose label already reads as English carry no explanation. */
const HINTS: Record<string, string> = {
  'MOSFET temperature':
    'Temperature of the power switches that connect and disconnect the pack. They run hotter than the cells under heavy load and are protected separately from them.',
};

/** Every figure `pwr` reports, plus what `bat` adds about the cells inside each pack. */
export function PackMetrics({ packs, cells }: PackMetricsProps) {
  const row = (
    label: string,
    unit: string | undefined,
    render: (pack: PackSummary, cells?: PackCells) => string,
    tone?: (pack: PackSummary, cells?: PackCells) => 'ok' | 'warn' | 'critical',
    group?: boolean,
  ): MetricRow => ({
    label,
    unit,
    group,
    hint: HINTS[label],
    cells: packs.map((pack) => ({
      value: render(pack, cells[pack.address]),
      tone: tone?.(pack, cells[pack.address]),
    })),
  });

  const rows: MetricRow[] = [
    row('State of charge', '%', (p) => num(p.soc, 0)),
    row('Voltage', 'V', (p) => num(p.voltage, 3)),
    row('Current', 'A', (p) => signed(p.current, 2)),
    row('Power', 'W', (p) => signed(p.voltage * p.current, 0)),
    row('Working state', undefined, (p) => p.baseState),

    row(
      'Cell temperature',
      '°C',
      (p) => num(p.temperature, 1),
      undefined,
      true,
    ),
    row('MOSFET temperature', '°C', (p) => num(p.mosTemperature, 1)),
    row(
      'Coolest cell',
      '°C',
      (p) => `${num(p.tempLow, 1)}  #${int(p.tempLowId)}`,
    ),
    row(
      'Hottest cell',
      '°C',
      (p) => `${num(p.tempHigh, 1)}  #${int(p.tempHighId)}`,
    ),

    row(
      'Lowest cell',
      'mV',
      (p) => `${int(p.cellLow)}  #${int(p.cellLowId)}`,
      undefined,
      true,
    ),
    row(
      'Highest cell',
      'mV',
      (p) => `${int(p.cellHigh)}  #${int(p.cellHighId)}`,
    ),
    row(
      'Cell spread',
      'mV',
      (_p, c) => int(c?.spread),
      (_p, c) => spreadSeverity(c?.spread ?? Number.NaN),
    ),
    row('Cell mean', 'mV', (_p, c) => int(c?.mean)),
    row('Cells read', undefined, (_p, c) => int(c?.cells.length)),
    row('Balancing now', undefined, (_p, c) =>
      int(c?.cells.filter((cell) => cell.balancing).length ?? 0),
    ),

    row(
      'Voltage state',
      undefined,
      (p) => p.voltState,
      (p) => stateSeverity(p.voltState),
      true,
    ),
    row(
      'Current state',
      undefined,
      (p) => p.currState,
      (p) => stateSeverity(p.currState),
    ),
    row(
      'Temperature state',
      undefined,
      (p) => p.tempState,
      (p) => stateSeverity(p.tempState),
    ),
    row(
      'System alarm',
      undefined,
      (p) => p.systemAlarm,
      (p) => stateSeverity(p.systemAlarm),
    ),

    row('BMS timestamp', undefined, (p) => p.timestamp || '—', undefined, true),
  ];

  return (
    <MetricGrid
      corner="Live reading"
      columns={packs.map((pack) => `Pack ${pack.address}`)}
      rows={rows}
    />
  );
}
