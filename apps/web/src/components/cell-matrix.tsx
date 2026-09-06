import type { Cell, PackCells } from '@libs/protocol';
import { useTranslation } from 'react-i18next';

import { Panel, PanelBody, PanelHead } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SpreadBadge, SpreadMeter } from '@/components/spread-meter';
import { int, num, signed } from '@/lib/format';
import {
  deviationBucket,
  deviationColor,
  deviationInk,
  spreadSeverity,
} from '@/lib/severity';
import { cn } from '@/lib/utils';

const CELL_MIN_WIDTH = 56;

function tempSpread(cells: Cell[]): number {
  const temps = cells
    .map((cell) => cell.temperature)
    .filter((value) => Number.isFinite(value));

  if (temps.length === 0) {
    return Number.NaN;
  }

  return Math.max(...temps) - Math.min(...temps);
}

export function CellMatrix({ packs }: { packs: PackCells[] }) {
  return (
    <TooltipProvider delayDuration={80}>
      <div className="flex flex-col gap-3">
        {packs.map((pack) => (
          <PackCellRow key={pack.address} pack={pack} />
        ))}
        <DeviationLegend />
      </div>
    </TooltipProvider>
  );
}

/** One figure in the pack's head line: silkscreened word, then the reading. */
function Figure({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="silk">{label}</span>
      <span className="tnum text-[11px] text-ink">{value}</span>
      {unit ? <span className="text-[10px] text-ink-faint">{unit}</span> : null}
    </span>
  );
}

function PackCellRow({ pack }: { pack: PackCells }) {
  const { t } = useTranslation();
  const severity = spreadSeverity(pack.spread);
  const temps = tempSpread(pack.cells);
  const balancing = pack.cells.filter((cell) => cell.balancing).length;

  return (
    <Panel>
      <PanelHead
        title={t('grid.pack', { address: pack.address })}
        tone={severity === 'ok' ? 'ok' : severity}
      >
        <span className="ml-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-1">
          <Figure label={t('cells.mean')} value={num(pack.mean, 1)} unit="mV" />
          <Figure
            label={t('cells.cellsCount')}
            value={String(pack.cells.length)}
          />
          <Figure
            label={t('cells.tempSpread')}
            value={num(temps, 1)}
            unit="°C"
          />
          <Figure label={t('cells.balancingCount')} value={String(balancing)} />
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                'tnum text-[14px] leading-none font-semibold',
                severity === 'ok' && 'text-ink',
                severity === 'warn' && 'text-warn',
                severity === 'critical' && 'text-critical',
              )}
            >
              {int(pack.spread)}
            </span>
            <span className="text-[10px] text-ink-faint">
              {t('cells.mvSpread')}
            </span>
            <SpreadBadge spread={pack.spread} />
          </span>
        </span>
      </PanelHead>
      <PanelBody className="flex flex-col gap-2.5 p-3">
        <SpreadMeter spread={pack.spread} />
        <div className="overflow-x-auto">
          <div
            className="grid gap-[2px]"
            style={{
              gridTemplateColumns: `repeat(${pack.cells.length}, minmax(${CELL_MIN_WIDTH}px, 1fr))`,
            }}
          >
            {pack.cells.map((cell) => (
              <CellTile key={cell.index} cell={cell} mean={pack.mean} />
            ))}
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}

function CellTile({ cell, mean }: { cell: Cell; mean: number }) {
  const { t } = useTranslation();
  const delta = cell.voltage - mean;
  const bucket = deviationBucket(delta);
  const extreme = Math.abs(bucket) === 4;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative flex flex-col items-center justify-center gap-0.5 border border-transparent px-1 py-1.5 focus-visible:z-10 focus-visible:ring-1 focus-visible:ring-[var(--ring)] focus-visible:outline-none',
            extreme && 'border-current',
            cell.balancing && 'stripe-balancing',
          )}
          style={{
            backgroundColor: deviationColor(bucket),
            color: deviationInk(bucket),
          }}
        >
          <span className="tnum text-[9px] leading-none opacity-60">
            {cell.index}
          </span>
          <span className="tnum text-[12px] leading-none font-medium">
            {int(cell.voltage)}
          </span>
          <span className="tnum text-[10px] leading-none opacity-75">
            {signed(delta, 0)}
          </span>
          {cell.balancing ? (
            <span
              className="absolute top-1 right-1 size-1 bg-current"
              aria-hidden
            />
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-1.5">
          <span className="silk text-ink">
            {t('cells.cellNumber', { index: cell.index })}
          </span>
          <dl className="tnum grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-[11px]">
            <dt className="text-ink-dim">{t('cells.voltage')}</dt>
            <dd className="text-right">{int(cell.voltage)} mV</dd>
            <dt className="text-ink-dim">{t('cells.deltaFromMean')}</dt>
            <dd className="text-right">{signed(delta, 1)} mV</dd>
            <dt className="text-ink-dim">{t('cells.temperature')}</dt>
            <dd className="text-right">{num(cell.temperature, 1)} °C</dd>
            <dt className="text-ink-dim">{t('cells.balancing')}</dt>
            <dd className="text-right">
              {cell.balancing ? t('cells.yes') : t('cells.no')}
            </dd>
          </dl>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

const LEGEND_BUCKETS = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

function legendLabel(bucket: number): string {
  switch (bucket) {
    case -4:
      return '≤−30';
    case -2:
      return '−8';
    case 0:
      return '0';
    case 2:
      return '+8';
    case 4:
      return '≥+30';
    default:
      return '';
  }
}

function DeviationLegend() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2 px-1 text-[10px] text-ink-faint">
      <span className="flex items-center gap-3">
        <span className="silk">{t('cells.legend')}</span>
        <span className="flex items-start gap-[2px]">
          {LEGEND_BUCKETS.map((bucket) => (
            <span key={bucket} className="flex w-7 flex-col items-center gap-1">
              <span
                className="block h-2 w-full"
                style={{ backgroundColor: deviationColor(bucket) }}
              />
              <span className="tnum text-[9px]">{legendLabel(bucket)}</span>
            </span>
          ))}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="stripe-balancing relative block h-2 w-7 bg-seg-empty">
          <span className="absolute top-0 right-0 size-1 bg-ink" aria-hidden />
        </span>
        <span className="silk">{t('cells.balancingLegend')}</span>
      </span>
    </div>
  );
}
