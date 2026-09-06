import type { ReactNode } from 'react';

import { Hint } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Severity } from '@/lib/severity';

const TONE_CLASS: Record<Severity, string> = {
  ok: 'text-ink',
  warn: 'text-warn',
  critical: 'text-critical font-medium',
};

export interface MetricCell {
  value: ReactNode;
  tone?: Severity;
  title?: string;
}

export interface MetricRow {
  /** Stable across languages, so switching language does not remount the table. */
  id?: string;
  label: string;
  unit?: string;
  /** Plain-language explanation of the term, hung off the row label. */
  hint?: ReactNode;
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
          <tr className="border-b border-rule">
            <th
              scope="col"
              className="silk sticky left-0 z-10 bg-panel py-2 pr-6 pl-3 text-left"
            >
              {corner}
            </th>
            {columns.map((column) => (
              <th
                scope="col"
                key={column}
                className="silk px-3 py-2 text-right whitespace-nowrap text-ink-dim"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id ?? row.label}
              className={cn(
                'group hover:bg-panel-sunken',
                row.group && 'border-t border-dashed border-rule',
              )}
            >
              <th
                scope="row"
                className="caps sticky left-0 z-10 bg-panel py-[3px] pr-6 pl-3 text-left text-[11px] font-normal whitespace-nowrap text-ink-dim group-hover:bg-panel-sunken"
              >
                {row.hint ? (
                  <Hint content={row.hint}>{row.label}</Hint>
                ) : (
                  row.label
                )}
                {row.unit ? (
                  <span className="ml-1.5 text-[10px] tracking-normal text-ink-faint normal-case">
                    {row.unit}
                  </span>
                ) : null}
              </th>
              {row.cells.map((cell, index) => (
                <td
                  key={`${row.id ?? row.label}:${columns[index] ?? index}`}
                  title={cell.title}
                  className={cn(
                    'tnum px-3 py-[3px] text-right whitespace-nowrap',
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
