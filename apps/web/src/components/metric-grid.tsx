import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import type { Severity } from '@/lib/severity';

const TONE_CLASS: Record<Severity, string> = {
  ok: '',
  warn: 'text-[var(--warn)]',
  critical: 'text-[var(--critical)] font-semibold',
};

export interface MetricCell {
  value: ReactNode;
  tone?: Severity;
  title?: string;
}

export interface MetricRow {
  label: string;
  unit?: string;
  /** One entry per column, in column order. */
  cells: MetricCell[];
  /** Draws a rule above the row, so a block of related metrics reads as a block. */
  group?: boolean;
}

export interface MetricGridProps {
  /** Column headings — one per pack. */
  columns: string[];
  rows: MetricRow[];
  /** Row label for the leftmost column heading. */
  corner?: string;
}

/**
 * Metrics down the side, packs across the top. Transposed against the usual table because the
 * question asked of a stack is "how do the packs compare on this figure", which reads across a
 * row far more easily than down a column.
 */
export function MetricGrid({
  columns,
  rows,
  corner = 'Metric',
}: MetricGridProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-[12px]">
        <thead>
          <tr>
            <th
              scope="col"
              className="silk sticky left-0 z-10 bg-panel py-1.5 pr-4 pl-3 text-left"
            >
              {corner}
            </th>
            {columns.map((column) => (
              <th
                scope="col"
                key={column}
                className="border-l border-rule px-3 py-1.5 text-right text-[11px] font-semibold whitespace-nowrap text-ink-dim"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={row.label}
              className={cn(
                'group',
                rowIndex % 2 === 1 && 'bg-panel-sunken/60',
                row.group && 'border-t border-rule',
              )}
            >
              <th
                scope="row"
                className={cn(
                  'sticky left-0 z-10 py-[3px] pr-4 pl-3 text-left font-normal whitespace-nowrap text-ink-dim',
                  rowIndex % 2 === 1 ? 'bg-panel-sunken' : 'bg-panel',
                )}
              >
                {row.label}
                {row.unit ? (
                  <span className="ml-1 text-[10px] text-ink-faint">
                    {row.unit}
                  </span>
                ) : null}
              </th>
              {row.cells.map((cell, index) => (
                <td
                  key={`${row.label}:${columns[index] ?? index}`}
                  title={cell.title}
                  className={cn(
                    'tnum border-l border-rule px-3 py-[3px] text-right whitespace-nowrap',
                    TONE_CLASS[cell.tone ?? 'ok'],
                  )}
                >
                  {cell.value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
