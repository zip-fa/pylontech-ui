import type { Cell, PackCells } from '@libs/protocol';
import { Activity } from 'lucide-react';

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

const CELL_MIN_WIDTH = 58;

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
      <div className="bed flex flex-col gap-px">
        {packs.map((pack) => (
          <PackCellRow key={pack.address} pack={pack} />
        ))}
        <DeviationLegend />
      </div>
    </TooltipProvider>
  );
}

function PackCellRow({ pack }: { pack: PackCells }) {
  const severity = spreadSeverity(pack.spread);
  const temps = tempSpread(pack.cells);
  const balancing = pack.cells.filter((cell) => cell.balancing).length;

  return (
    <Panel>
      <PanelHead title={`Pack ${pack.address}`}>
        <span className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[11px] whitespace-nowrap text-ink-faint">
          <span className="tnum">
            mean <span className="text-ink-dim">{num(pack.mean, 1)}</span> mV
          </span>
          <span className="tnum">
            <span className="text-ink-dim">{pack.cells.length}</span> cells
          </span>
          <span className="tnum">
            temp spread <span className="text-ink-dim">{num(temps, 1)}</span> °C
          </span>
          <span className="tnum flex items-center gap-1">
            {balancing > 0 ? (
              <Activity className="size-3 text-[var(--warn)]" aria-hidden />
            ) : null}
            <span className="text-ink-dim">{balancing}</span> balancing
          </span>
          <span className="flex items-baseline gap-1.5">
            <span
              className={cn(
                'tnum text-[15px] leading-none font-semibold',
                severity === 'ok' && 'text-ink',
                severity === 'warn' && 'text-[var(--warn)]',
                severity === 'critical' && 'text-[var(--critical)]',
              )}
            >
              {int(pack.spread)}
            </span>
            <span>mV spread</span>
            <SpreadBadge spread={pack.spread} />
          </span>
        </span>
      </PanelHead>
      <PanelBody className="flex flex-col gap-2 p-2">
        <SpreadMeter spread={pack.spread} className="px-1" />
        <div className="overflow-x-auto">
          <div
            className="grid gap-px"
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
  const delta = cell.voltage - mean;
  const bucket = deviationBucket(delta);
  const extreme = Math.abs(bucket) === 4;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative flex flex-col items-center justify-center gap-px border border-transparent px-1 py-1 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none',
            extreme && 'border-current ring-1 ring-current',
            cell.balancing && 'stripe-balancing',
          )}
          style={{
            backgroundColor: deviationColor(bucket),
            color: deviationInk(bucket),
          }}
        >
          <span className="tnum text-[9px] opacity-70">{cell.index}</span>
          <span className="tnum text-[13px] leading-none font-semibold">
            {int(cell.voltage)}
          </span>
          <span className="tnum text-[10px] leading-none opacity-80">
            {signed(delta, 0)}
          </span>
          {cell.balancing ? (
            <span
              className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-current"
              aria-hidden
            />
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold">Cell {cell.index}</span>
          <dl className="tnum grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-[11px]">
            <dt className="text-ink-dim">Voltage</dt>
            <dd className="text-right font-medium">{int(cell.voltage)} mV</dd>
            <dt className="text-ink-dim">Δ from mean</dt>
            <dd className="text-right font-medium">{signed(delta, 1)} mV</dd>
            <dt className="text-ink-dim">Temperature</dt>
            <dd className="text-right font-medium">
              {num(cell.temperature, 1)} °C
            </dd>
            <dt className="text-ink-dim">Balancing</dt>
            <dd className="text-right font-medium">
              {cell.balancing ? 'Yes' : 'No'}
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
      return '≤ −30';
    case -2:
      return '−8';
    case 0:
      return '0';
    case 2:
      return '+8';
    case 4:
      return '≥ +30';
    default:
      return '';
  }
}

function DeviationLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-panel px-3 py-2 text-[11px] text-ink-dim">
      <span className="flex items-center gap-2">
        <span>Deviation from pack mean (mV)</span>
        <span className="flex items-end gap-px">
          {LEGEND_BUCKETS.map((bucket) => (
            <span key={bucket} className="flex flex-col items-center gap-0.5">
              <span
                className="block h-4 w-6 rounded-sm"
                style={{ backgroundColor: deviationColor(bucket) }}
              />
              <span className="tnum text-[9px]">{legendLabel(bucket)}</span>
            </span>
          ))}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="stripe-balancing relative block size-4 rounded-sm border bg-panel-sunken">
          <span
            className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-current"
            aria-hidden
          />
        </span>
        Balancing (BMS bleeding this cell)
      </span>
    </div>
  );
}
