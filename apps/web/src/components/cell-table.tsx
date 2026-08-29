import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import type { ParseKeys, TFunction } from 'i18next';
import { ArrowDown, ArrowUp, ChevronsUpDown, Info } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

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

/** The state itself is the console's word; only the "all fine" placeholder is ours to translate. */
function StateCell({ state }: { state: string }) {
  const { t } = useTranslation();

  if (isNormal(state)) {
    return <span className="text-ink-dim">{t('cells.ok')}</span>;
  }

  return <Badge variant="critical">{state}</Badge>;
}

const buildColumns = (t: TFunction) =>
  helper.columns([
    helper.accessor('pack', {
      header: t('cells.pack'),
      sortFn: 'basic',
      cell: (info) => <span className="font-semibold">#{info.getValue()}</span>,
    }),
    helper.accessor('index', {
      header: t('cells.cell'),
      sortFn: 'basic',
      cell: (info) => int(info.getValue()),
    }),
    helper.accessor('voltage', {
      header: t('cells.voltage'),
      sortFn: 'basic',
      cell: (info) => `${int(info.getValue())} mV`,
    }),
    helper.accessor('delta', {
      header: t('cells.delta'),
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
      header: t('cells.temp'),
      sortFn: 'basic',
      cell: (info) => `${num(info.getValue(), 1)} °C`,
    }),
    helper.accessor('current', {
      header: t('cells.current'),
      sortFn: 'basic',
      cell: (info) => `${signed(info.getValue(), 2)} A`,
    }),
    helper.accessor('soc', {
      header: t('cells.soc'),
      sortFn: 'basic',
      cell: (info) => `${num(info.getValue(), 0)} %`,
    }),
    helper.accessor('coulomb', {
      header: t('cells.coulomb'),
      sortFn: 'basic',
      cell: (info) => `${num(info.getValue(), 0)} mAh`,
    }),
    helper.accessor('balancing', {
      header: t('cells.balancing'),
      sortFn: 'basic',
      cell: (info) =>
        info.getValue() ? (
          <Badge variant="warn">{t('cells.balancingBadge')}</Badge>
        ) : (
          <span className="text-ink-dim">—</span>
        ),
    }),
    helper.accessor('baseState', {
      header: t('cells.state'),
      sortFn: 'text',
      cell: (info) => <span className="text-ink-dim">{info.getValue()}</span>,
    }),
    helper.accessor('voltState', {
      header: t('cells.volt'),
      sortFn: 'text',
      cell: (info) => <StateCell state={info.getValue()} />,
    }),
    helper.accessor('currState', {
      header: t('cells.curr'),
      sortFn: 'text',
      cell: (info) => <StateCell state={info.getValue()} />,
    }),
    helper.accessor('tempState', {
      header: t('cells.tempState'),
      sortFn: 'text',
      cell: (info) => <StateCell state={info.getValue()} />,
    }),
  ]);

/**
 * Only the abbreviated and coined column headers. The explanation hangs off a marker beside the
 * label rather than off the label itself, because the header text sits inside the sort button and
 * a button cannot contain another button.
 */
const HEADER_HINTS: Record<string, ParseKeys | undefined> = {
  delta: 'hints.delta',
  soc: 'hints.soc',
  coulomb: 'hints.coulomb',
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
  const { t } = useTranslation();
  const data = useMemo(() => rows, [rows]);
  const columns = useMemo(() => buildColumns(t), [t]);
  const table = useTable({ features, columns, data });

  return (
    <div className="max-h-[28rem] overflow-auto">
      <table className="w-full min-w-[900px] border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-panel">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} className="border-b">
              {group.headers.map((header) => {
                const hint = HEADER_HINTS[header.column.id];
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
                      {hint ? (
                        <Hint
                          content={t(hint)}
                          aria-label={t('cells.explain', {
                            term: headerText(
                              header.column.columnDef.header,
                              header.column.id,
                            ),
                          })}
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
