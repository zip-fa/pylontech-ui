import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import type { Severity } from '@/lib/severity';

/**
 * One figure on the instrument face: silkscreened label, the reading at display size, and a line
 * of context underneath. Shared by the live band and the history cards so the two read as the same
 * instrument rather than as a page with a widget bolted on.
 */
export interface KpiProps {
  label: string;
  value: string;
  unit?: string;
  /** A comparison, a cadence, a caveat — or a bar, which is why it is not just a string. */
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
        'flex min-w-0 flex-col justify-between gap-1 bg-panel px-3 py-2',
        className,
      )}
    >
      <span className="silk text-ink-faint">{label}</span>
      <span
        className={cn(
          'tnum flex items-baseline gap-1 text-[26px] leading-none font-semibold tracking-tight',
          tone === 'warn' && 'text-[var(--warn)]',
          tone === 'critical' && 'text-[var(--critical)]',
        )}
      >
        <span className="truncate">{value}</span>
        {unit ? (
          <span className="text-[12px] font-normal text-ink-faint">{unit}</span>
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
