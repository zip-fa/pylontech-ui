import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, Info } from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Hint } from '@/components/ui/tooltip';
import type { CellRow } from '@/lib/cell-rows';
import { int, num, signed } from '@/lib/format';
import { deviationBucket, isNormal } from '@/lib/severity';
import { cn } from '@/lib/utils';

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text },
});

const helper = createColumnHelper<typeof features, CellRow>();

function StateCell({ state }: { state: string }) {
  if (isNormal(state)) {
    return <span className="text-ink-dim">ok</span>;
  }

  return <Badge variant="critical">{state}</Badge>;
}

const columns = helper.columns([
  helper.accessor('pack', {
    header: 'Pack',
    sortFn: 'basic',
    cell: (info) => <span className="font-semibold">#{info.getValue()}</span>,
  }),
  helper.accessor('index', {
    header: 'Cell',
    sortFn: 'basic',
    cell: (info) => int(info.getValue()),
  }),
  helper.accessor('voltage', {
    header: 'Voltage',
    sortFn: 'basic',
    cell: (info) => `${int(info.getValue())} mV`,
  }),
  helper.accessor('delta', {
    header: 'Δ mean',
    sortFn: 'basic',
    cell: (info) => {
      const bucket = Math.abs(deviationBucket(info.getValue()));

      return (
        <span
          className={cn(
            bucket >= 4 && 'font-semibold text-[var(--critical)]',
            bucket === 3 && 'text-[var(--warn)]',
          )}
        >
          {signed(info.getValue(), 1)} mV
        </span>
      );
    },
  }),
  helper.accessor('temperature', {
    header: 'Temp',
    sortFn: 'basic',
    cell: (info) => `${num(info.getValue(), 1)} °C`,
  }),
  helper.accessor('current', {
    header: 'Current',
    sortFn: 'basic',
    cell: (info) => `${signed(info.getValue(), 2)} A`,
  }),
  helper.accessor('soc', {
    header: 'SOC',
    sortFn: 'basic',
    cell: (info) => `${num(info.getValue(), 0)} %`,
  }),
  helper.accessor('coulomb', {
    header: 'Coulomb',
    sortFn: 'basic',
    cell: (info) => `${num(info.getValue(), 0)} mAh`,
  }),
  helper.accessor('balancing', {
    header: 'Balancing',
    sortFn: 'basic',
    cell: (info) =>
      info.getValue() ? (
        <Badge variant="warn">balancing</Badge>
      ) : (
        <span className="text-ink-dim">—</span>
      ),
  }),
  helper.accessor('baseState', {
    header: 'State',
    sortFn: 'text',
    cell: (info) => <span className="text-ink-dim">{info.getValue()}</span>,
  }),
  helper.accessor('voltState', {
    header: 'Volt',
    sortFn: 'text',
    cell: (info) => <StateCell state={info.getValue()} />,
  }),
  helper.accessor('currState', {
    header: 'Curr',
    sortFn: 'text',
    cell: (info) => <StateCell state={info.getValue()} />,
  }),
  helper.accessor('tempState', {
    header: 'Temp state',
    sortFn: 'text',
    cell: (info) => <StateCell state={info.getValue()} />,
  }),
]);

/**
 * Only the abbreviated and coined column headers. The explanation hangs off a marker beside the
 * label rather than off the label itself, because the header text sits inside the sort button and
 * a button cannot contain another button.
 */
const HEADER_HINTS: Record<string, string> = {
  delta:
    "This cell's voltage minus the average of its own pack, in millivolts. Near zero is a matched cell; a cell that stays at one extreme is the one to watch.",
  soc: 'State of charge: how full this cell is, as the BMS estimates it.',
  coulomb:
    "The cell's own charge counter, in milliamp-hours — the charge the BMS believes this cell is holding.",
};

const RIGHT_ALIGNED = new Set([
  'index',
  'voltage',
  'delta',
  'temperature',
  'current',
  'soc',
  'coulomb',
]);

/** The header is a string for every sortable column here; the id is only a fallback. */
function headerText(header: unknown, fallback: string): string {
  return typeof header === 'string' ? header : fallback;
}

export function CellTable({ rows }: { rows: CellRow[] }) {
  const data = useMemo(() => rows, [rows]);
  const table = useTable({ features, columns, data });

  return (
    <div className="max-h-[28rem] overflow-auto">
      <table className="w-full min-w-[900px] border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-panel">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} className="border-b">
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const Icon =
                  sorted === 'asc'
                    ? ArrowUp
                    : sorted === 'desc'
                      ? ArrowDown
                      : ChevronsUpDown;

                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      sorted === 'asc'
                        ? 'ascending'
                        : sorted === 'desc'
                          ? 'descending'
                          : 'none'
                    }
                    className={cn(
                      'px-2 py-1.5 text-left text-[10px] font-medium tracking-wider text-ink-dim uppercase',
                      RIGHT_ALIGNED.has(header.column.id) && 'text-right',
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          'inline-flex items-center gap-1 hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none',
                          sorted && 'text-ink',
                        )}
                      >
                        <table.FlexRender header={header} />
                        <Icon
                          className={cn('size-3', !sorted && 'opacity-40')}
                          aria-hidden
                        />
                      </button>
                      {HEADER_HINTS[header.column.id] ? (
                        <Hint
                          content={HEADER_HINTS[header.column.id]}
                          aria-label={`What ${headerText(header.column.columnDef.header, header.column.id)} means`}
                          className="text-ink-faint no-underline hover:text-ink"
                        >
                          <Info className="size-3" aria-hidden />
                        </Hint>
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b last:border-0 hover:bg-panel-sunken"
            >
              {row.getAllCells().map((cell) => (
                <td
                  key={cell.id}
                  className={cn(
                    'px-2 py-1 align-middle',
                    RIGHT_ALIGNED.has(cell.column.id) && 'tnum text-right',
                  )}
                >
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
