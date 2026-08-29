import type { StackSeries } from '@libs/protocol';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

import { momentFormatter, tickFormatter } from './axis';
import { ChartPanel } from './chart-panel';

/**
 * Charge over time, on a fixed 0–100 axis. Fixed rather than fitted, because the shape of a stack
 * that never leaves the eighties is the point: an auto-scaled axis would redraw that as a dramatic
 * sawtooth and mislead at a glance.
 */
export function SocChart({ series }: { series: StackSeries }) {
  const { t } = useTranslation();
  const span = series.to - series.from;

  const config: ChartConfig = {
    soc: { label: t('history.series.soc'), color: 'var(--series-soc)' },
  };

  return (
    <ChartPanel
      title={t('history.charts.soc')}
      note={t('history.charts.socNote')}
      hasData={series.points.length > 0}
      height={220}
    >
      <ChartContainer config={config} className="h-full w-full">
        <AreaChart
          data={series.points}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="soc-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--series-soc)"
                stopOpacity={0.35}
              />
              <stop
                offset="100%"
                stopColor="var(--series-soc)"
                stopOpacity={0.02}
              />
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
            width={44}
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            unit="%"
          />
          <Area
            dataKey="soc"
            stroke="var(--series-soc)"
            strokeWidth={1.4}
            fill="url(#soc-fill)"
            isAnimationActive={false}
          />
          <Tooltip
            cursor={{ stroke: 'var(--rule-strong)', strokeWidth: 1 }}
            content={
              <ChartTooltipContent
                labelFormatter={(value) => momentFormatter(span)(Number(value))}
                valueFormatter={(value) => `${value.toFixed(1)} %`}
              />
            }
          />
        </AreaChart>
      </ChartContainer>
    </ChartPanel>
  );
}
