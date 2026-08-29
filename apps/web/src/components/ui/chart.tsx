import {
  createContext,
  useContext,
  useId,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { ResponsiveContainer } from 'recharts';

import { cn } from '@/lib/utils';

/**
 * The shadcn chart wrapper: a config object names each series once — its label and its colour — and
 * the container publishes those colours as CSS variables so Recharts and the surrounding markup
 * read the same value. Without it the legend, the tooltip swatch and the line itself each carry
 * their own copy of the colour and drift apart.
 */
export interface ChartSeries {
  label: string;
  color?: string;
}

export type ChartConfig = Record<string, ChartSeries>;

const ChartContext = createContext<ChartConfig | null>(null);

function useChart(): ChartConfig {
  const config = useContext(ChartContext);

  if (!config) {
    throw new Error('Chart components must be used inside <ChartContainer>');
  }

  return config;
}

export interface ChartContainerProps extends ComponentProps<'div'> {
  config: ChartConfig;
  children: ComponentProps<typeof ResponsiveContainer>['children'];
}

export function ChartContainer({
  config,
  className,
  children,
  ...props
}: ChartContainerProps) {
  const id = useId().replace(/:/g, '');
  const coloured = Object.entries(config).filter(([, series]) => series.color);

  return (
    <ChartContext.Provider value={config}>
      <div
        data-chart={id}
        className={cn(
          // Recharts draws its own focus outline on every surface; the page has one ring style.
          'min-w-0 [&_.recharts-cartesian-axis-line]:stroke-[var(--rule)] [&_.recharts-cartesian-axis-tick_text]:fill-[var(--ink-faint)] [&_.recharts-cartesian-grid_line]:stroke-[var(--grid)] [&_.recharts-surface]:outline-none',
          className,
        )}
        {...props}
      >
        {coloured.length > 0 ? (
          <style
            // Keys are our own config keys and values our own tokens; nothing here is user input.
            dangerouslySetInnerHTML={{
              __html: `[data-chart="${id}"]{${coloured
                .map(([key, series]) => `--color-${key}:${series.color};`)
                .join('')}}`,
            }}
          />
        ) : null}
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

interface TooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipContentProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  /** Renders the header. Given the raw x value, because only the caller knows if it is a date. */
  labelFormatter?: (label: string | number) => ReactNode;
  /** Renders one row's figure, units included. */
  valueFormatter?: (value: number, key: string) => ReactNode;
  /** Series to leave out of the tooltip — a min/max band drawn only to shade the chart. */
  hide?: string[];
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
  hide = [],
}: ChartTooltipContentProps) {
  const config = useChart();

  if (!active || !payload?.length) {
    return null;
  }

  const rows = payload.filter(
    (entry) => !hide.includes(String(entry.dataKey ?? '')),
  );

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="min-w-36 border border-rule-strong bg-panel px-2 py-1.5 shadow-sm">
      {label !== undefined ? (
        <div className="silk mb-1 text-ink-dim">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      ) : null}
      <div className="flex flex-col gap-0.5">
        {rows.map((entry) => {
          const key = String(entry.dataKey ?? entry.name ?? '');
          const series = config[key];
          const value = Number(entry.value);

          return (
            <div key={key} className="flex items-center gap-2 text-[11px]">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-[1px]"
                style={{
                  background: entry.color ?? `var(--color-${key})`,
                }}
              />
              <span className="truncate text-ink-dim">
                {series?.label ?? key}
              </span>
              <span className="tnum ml-auto font-medium text-ink">
                {valueFormatter ? valueFormatter(value, key) : value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface ChartLegendContentProps {
  payload?: Array<{ dataKey?: string | number; color?: string }>;
}

export function ChartLegendContent({ payload = [] }: ChartLegendContentProps) {
  const config = useChart();

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 px-3 pt-1">
      {payload.map((entry) => {
        const key = String(entry.dataKey ?? '');
        const series = config[key];

        if (!series) {
          return null;
        }

        return (
          <span
            key={key}
            className="flex items-center gap-1.5 text-[11px] text-ink-faint"
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-[1px]"
              style={{ background: entry.color ?? `var(--color-${key})` }}
            />
            {series.label}
          </span>
        );
      })}
    </div>
  );
}
