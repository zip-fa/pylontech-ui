import type { StackSeries } from '@libs/protocol';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

import {
  momentFormatter,
  niceSignedDomain,
  tickFormatter,
  zeroOffset,
} from './axis';
import { ChartPanel } from './chart-panel';

/**
 * Signed power, filled with a gradient that changes colour exactly where the axis crosses zero, so
 * charging and discharging are told apart without reading the scale. The min/max band behind the
 * mean is the reason the recorder keeps those columns: at a wide bucket the mean alone would hide
 * a stack that spent the interval swinging between the two.
 */
export function PowerChart({ series }: { series: StackSeries }) {
  const { t } = useTranslation();
  const span = series.to - series.from;

  const data = useMemo(
    () =>
      series.points.map((point) => ({
        at: point.at,
        power: point.power,
        band: [point.powerMin, point.powerMax] as [number, number],
      })),
    [series.points],
  );

  const [min, max] = useMemo(() => {
    if (data.length === 0) {
      return [-1, 1];
    }

    return niceSignedDomain(
      Math.min(0, ...data.map((row) => row.band[0])),
      Math.max(0, ...data.map((row) => row.band[1])),
    );
  }, [data]);

  const config: ChartConfig = {
    power: { label: t('history.series.power'), color: 'var(--series-in)' },
    band: { label: t('history.series.powerBand') },
  };

  const split = zeroOffset(min, max);

  return (
    <ChartPanel
      title={t('history.charts.power')}
      note={t('history.charts.powerNote')}
      hasData={data.length > 0}
      height={220}
    >
      <ChartContainer config={config} className="h-full w-full">
        <ComposedChart
          data={data}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="power-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset={split}
                stopColor="var(--series-in)"
                stopOpacity={0.35}
              />
              <stop
                offset={split}
                stopColor="var(--series-out)"
                stopOpacity={0.35}
              />
            </linearGradient>
            <linearGradient id="power-stroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset={split} stopColor="var(--series-in)" />
              <stop offset={split} stopColor="var(--series-out)" />
            </linearGradient>
          </defs>
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
            width={56}
            domain={[min, max]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            tickFormatter={(value: number) => String(Math.round(value))}
            unit=" W"
          />
          <ReferenceLine y={0} stroke="var(--rule-strong)" />
          <Area
            dataKey="band"
            stroke="none"
            fill="url(#power-fill)"
            fillOpacity={0.4}
            isAnimationActive={false}
          />
          <Area
            dataKey="power"
            stroke="url(#power-stroke)"
            strokeWidth={1.4}
            fill="url(#power-fill)"
            isAnimationActive={false}
          />
          <Tooltip
            cursor={{ stroke: 'var(--rule-strong)', strokeWidth: 1 }}
            content={
              <ChartTooltipContent
                hide={['band']}
                labelFormatter={(value) => momentFormatter(span)(Number(value))}
                valueFormatter={(value) => `${Math.round(value)} W`}
              />
            }
          />
        </ComposedChart>
      </ChartContainer>
    </ChartPanel>
  );
}
