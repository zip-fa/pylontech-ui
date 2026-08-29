import type { PackPoint, PackSeries } from '@libs/protocol';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { SPREAD_PROBLEM_MV, SPREAD_WATCH_MV } from '@/lib/severity';

import { momentFormatter, paddedDomain, tickFormatter } from './axis';
import { ChartPanel } from './chart-panel';

/** Six distinguishable hues; a stack longer than that wraps rather than inventing new ones. */
const HUES = 6;

const colourFor = (index: number) => `var(--chart-${(index % HUES) + 1})`;

/**
 * The API returns one row per pack per bucket, which is the right shape to store and the wrong
 * shape to draw: a line chart wants one row per bucket with a column per pack. Pivoting here keeps
 * that transposition out of both the daemon and the chart.
 */
function pivot(
  points: PackPoint[],
  addresses: number[],
  pick: (point: PackPoint) => number | null,
): Array<Record<string, number>> {
  const rows = new Map<number, Record<string, number>>();

  for (const point of points) {
    if (!addresses.includes(point.address)) {
      continue;
    }

    const value = pick(point);

    if (value === null || !Number.isFinite(value)) {
      continue;
    }

    const row = rows.get(point.at) ?? { at: point.at };

    row[`p${point.address}`] = value;
    rows.set(point.at, row);
  }

  return [...rows.values()].sort((a, b) => (a['at'] ?? 0) - (b['at'] ?? 0));
}

function packConfig(addresses: number[], label: (a: number) => string) {
  return Object.fromEntries(
    addresses.map((address, index) => [
      `p${address}`,
      { label: label(address), color: colourFor(index) },
    ]),
  ) satisfies ChartConfig;
}

interface PackChartProps {
  series: PackSeries;
}

/**
 * Per-pack temperature. Drawn per pack rather than as a stack min/max band because the question a
 * warm stack raises is *which* pack is warm — one pack running hotter than its neighbours is a
 * different problem from the whole cabinet being warm.
 */
export function PackTemperatureChart({ series }: PackChartProps) {
  const { t } = useTranslation();
  const span = series.to - series.from;
  const { addresses } = series;

  const data = useMemo(
    () => pivot(series.points, addresses, (point) => point.tempMax),
    [series.points, addresses],
  );

  const domain = useMemo(
    () =>
      paddedDomain(
        data.flatMap((row) =>
          addresses.map((address) => row[`p${address}`] ?? Number.NaN),
        ),
        4,
      ),
    [data, addresses],
  );

  const config = packConfig(addresses, (address) =>
    t('grid.pack', { address }),
  );

  return (
    <ChartPanel
      title={t('history.charts.temperature')}
      note={t('history.charts.temperatureNote')}
      hasData={data.length > 0}
    >
      <ChartContainer config={config} className="h-full w-full">
        <LineChart
          data={data}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="2 3" />
          <XAxis
            dataKey="at"
            type="number"
            scale="time"
            domain={[series.from, series.to]}
            tickFormatter={tickFormatter(span)}
            tickLine={false}
            minTickGap={44}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            width={44}
            domain={domain}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            tickFormatter={(value: number) => value.toFixed(0)}
            unit="°"
          />
          {addresses.map((address, index) => (
            <Line
              key={address}
              dataKey={`p${address}`}
              stroke={colourFor(index)}
              strokeWidth={1.3}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ))}
          <Tooltip
            cursor={{ stroke: 'var(--rule-strong)', strokeWidth: 1 }}
            content={
              <ChartTooltipContent
                labelFormatter={(value) => momentFormatter(span)(Number(value))}
                valueFormatter={(value) => `${value.toFixed(1)} °C`}
              />
            }
          />
          <Legend content={<ChartLegendContent />} position="top" />
        </LineChart>
      </ChartContainer>
    </ChartPanel>
  );
}

/**
 * Per-pack cell spread, with the two vendor thresholds drawn in. The live view only ever shows the
 * spread at the instant it polled; a pack that drifts apart under load and settles again at rest
 * is invisible there and obvious here.
 */
export function PackSpreadChart({ series }: PackChartProps) {
  const { t } = useTranslation();
  const span = series.to - series.from;
  const { addresses } = series;

  const data = useMemo(
    () => pivot(series.points, addresses, (point) => point.spread),
    [series.points, addresses],
  );

  const peak = useMemo(
    () =>
      data.reduce((highest, row) => {
        for (const address of addresses) {
          highest = Math.max(highest, row[`p${address}`] ?? 0);
        }

        return highest;
      }, 0),
    [data, addresses],
  );

  const config = packConfig(addresses, (address) =>
    t('grid.pack', { address }),
  );

  // The watch line is always in frame, so a flat trace reads as "well inside" and not as "no scale".
  const top = Math.max(peak * 1.15, SPREAD_WATCH_MV * 1.2);

  return (
    <ChartPanel
      title={t('history.charts.spread')}
      note={t('history.charts.spreadNote')}
      hasData={data.length > 0}
    >
      <ChartContainer config={config} className="h-full w-full">
        <LineChart
          data={data}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="2 3" />
          <XAxis
            dataKey="at"
            type="number"
            scale="time"
            domain={[series.from, series.to]}
            tickFormatter={tickFormatter(span)}
            tickLine={false}
            minTickGap={44}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            width={44}
            domain={[0, top]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            tickFormatter={(value: number) => value.toFixed(0)}
            unit=" mV"
          />
          <ReferenceLine
            y={SPREAD_WATCH_MV}
            stroke="var(--warn)"
            strokeDasharray="3 3"
            label={{
              value: t('history.charts.drifting'),
              position: 'insideTopLeft',
              fill: 'var(--warn)',
              fontSize: 10,
            }}
          />
          {top > SPREAD_PROBLEM_MV ? (
            <ReferenceLine
              y={SPREAD_PROBLEM_MV}
              stroke="var(--critical)"
              strokeDasharray="3 3"
              label={{
                value: t('history.charts.outOfBalance'),
                position: 'insideTopLeft',
                fill: 'var(--critical)',
                fontSize: 10,
              }}
            />
          ) : null}
          {addresses.map((address, index) => (
            <Line
              key={address}
              dataKey={`p${address}`}
              stroke={colourFor(index)}
              strokeWidth={1.3}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ))}
          <Tooltip
            cursor={{ stroke: 'var(--rule-strong)', strokeWidth: 1 }}
            content={
              <ChartTooltipContent
                labelFormatter={(value) => momentFormatter(span)(Number(value))}
                valueFormatter={(value) => `${Math.round(value)} mV`}
              />
            }
          />
          <Legend content={<ChartLegendContent />} position="top" />
        </LineChart>
      </ChartContainer>
    </ChartPanel>
  );
}
