import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  SPREAD_LABEL,
  SPREAD_PROBLEM_MV,
  SPREAD_WATCH_MV,
  spreadSeverity,
  type Severity,
} from '@/lib/severity';
import { cn } from '@/lib/utils';

const SCALE_MAX_MV = 150;

const FILL: Record<Severity, string> = {
  ok: 'bg-[var(--ok)]',
  warn: 'bg-[var(--warn)]',
  critical: 'bg-[var(--critical)]',
};

const ICON = {
  ok: CircleCheck,
  warn: TriangleAlert,
  critical: CircleAlert,
} as const;

export function SpreadBadge({
  spread,
  className,
}: {
  spread: number;
  className?: string;
}) {
  const severity = spreadSeverity(spread);
  const Icon = ICON[severity];

  return (
    <Badge
      variant={severity}
      className={cn(
        severity === 'critical' &&
          'ring-1 ring-[var(--critical)] ring-offset-1 ring-offset-[var(--panel)]',
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {SPREAD_LABEL[severity]}
    </Badge>
  );
}

/** Ticks sit at the 30/100 mV thresholds so a bar length reads as a verdict, not just a number. */
export function SpreadMeter({
  spread,
  className,
}: {
  spread: number;
  className?: string;
}) {
  const safe = Number.isFinite(spread) ? Math.max(0, spread) : 0;
  const severity = spreadSeverity(safe);
  const percent = Math.min(100, (safe / SCALE_MAX_MV) * 100);

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-panel-sunken">
        <div
          className={cn('h-full rounded-full', FILL[severity])}
          style={{ width: `${Math.max(percent, 2)}%` }}
        />
        <span
          className="absolute top-0 h-full w-px bg-panel/80"
          style={{ left: `${(SPREAD_WATCH_MV / SCALE_MAX_MV) * 100}%` }}
          aria-hidden
        />
        <span
          className="absolute top-0 h-full w-px bg-panel/80"
          style={{ left: `${(SPREAD_PROBLEM_MV / SCALE_MAX_MV) * 100}%` }}
          aria-hidden
        />
      </div>
      <div className="tnum relative h-3 text-[10px] text-ink-dim">
        <span className="absolute left-0">0</span>
        <span
          className="absolute -translate-x-1/2"
          style={{ left: `${(SPREAD_WATCH_MV / SCALE_MAX_MV) * 100}%` }}
        >
          {SPREAD_WATCH_MV}
        </span>
        <span
          className="absolute -translate-x-1/2"
          style={{ left: `${(SPREAD_PROBLEM_MV / SCALE_MAX_MV) * 100}%` }}
        >
          {SPREAD_PROBLEM_MV}
        </span>
        <span className="absolute right-0">{SCALE_MAX_MV}+ mV</span>
      </div>
    </div>
  );
}
