import type { EnergyDay } from '@libs/protocol';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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

import { dayFormatter } from './axis';
import { ChartPanel } from './chart-panel';

/**
 * A day per bar, energy in above the line and energy out below it. Diverging rather than side by
 * side because the two are the same quantity in opposite directions, and the eye should be able to
 * tell a day that filled the stack from a day that emptied it without reading either number.
 */
export function EnergyChart({ days }: { days: EnergyDay[] }) {
  const { t } = useTranslation();

  const data = useMemo(
    () =>
      days.map((day) => ({
        at: day.at,
        charged: day.chargedWh / 1000,
        // Negated only for the drawing; the tooltip puts the sign back.
        discharged: -day.dischargedWh / 1000,
      })),
    [days],
  );

  const config: ChartConfig = {
    charged: { label: t('history.series.charged'), color: 'var(--series-in)' },
    discharged: {
      label: t('history.series.discharged'),
      color: 'var(--series-out)',
    },
  };

  return (
    <ChartPanel
      title={t('history.charts.energy')}
      note={t('history.charts.energyNote')}
      hasData={data.length > 0}
      height={230}
    >
      <ChartContainer config={config} className="h-full w-full">
        {/*
          `sign` keeps the two directions in separate stacks, so charging grows up from zero and
          discharging grows down from it. The default offset would add the signed values together
          and draw one net-height bar, which is not what a diverging pair means.
        */}
        <BarChart
          data={data}
          stackOffset="sign"
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="2 3" />
          <XAxis
            dataKey="at"
            tickFormatter={dayFormatter}
            tickLine={false}
            minTickGap={24}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            width={48}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            tickFormatter={(value: number) => String(Math.abs(value))}
            unit=" kWh"
          />
          <ReferenceLine y={0} stroke="var(--rule-strong)" />
          {/*
            One stack per day rather than two bars side by side: they belong to the same day, and
            grouping them splits each date into a pair that reads as two.
          */}
          <Bar
            dataKey="charged"
            stackId="day"
            maxBarSize={26}
            fill="var(--color-charged)"
            isAnimationActive={false}
          />
          <Bar
            dataKey="discharged"
            stackId="day"
            maxBarSize={26}
            fill="var(--color-discharged)"
            isAnimationActive={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--panel-sunken)' }}
            content={
              <ChartTooltipContent
                labelFormatter={(value) => dayFormatter(Number(value))}
                valueFormatter={(value) => `${Math.abs(value).toFixed(2)} kWh`}
              />
            }
          />
          <Legend content={<ChartLegendContent />} position="top" />
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}
