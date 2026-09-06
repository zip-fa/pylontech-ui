import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import type { Severity } from '@/lib/severity';

/**
 * One figure on the face: label, the reading, and a line of context under it. Shared by the live
 * band and the history cards so the two read as the same instrument.
 */
export interface KpiProps {
  label: string;
  value: string;
  unit?: string;
  /** A comparison, a cadence, a caveat — or a meter, which is why it is not just a string. */
  foot?: ReactNode;
  tone?: Severity;
  className?: string;
}

export function Kpi({
  label,
  value,
  unit,
  foot,
  tone = 'ok',
  className,
}: KpiProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col justify-between gap-1.5 bg-panel px-3 py-2.5',
        className,
      )}
    >
      <span className="silk truncate">{label}</span>
      <span
        className={cn(
          'tnum flex items-baseline gap-1 text-[20px] leading-none font-medium',
          tone === 'warn' && 'text-warn',
          tone === 'critical' && 'text-critical',
        )}
      >
        <span className="truncate">{value}</span>
        {unit ? (
          <span className="text-[11px] font-normal text-ink-dim">{unit}</span>
        ) : null}
      </span>
      {typeof foot === 'string' ? (
        <span className="truncate text-[11px] text-ink-faint">{foot}</span>
      ) : (
        foot
      )}
    </div>
  );
}
