import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  detail: string;
  /** Something is on its way: the marker blinks like a cursor waiting on the line. */
  loading?: boolean;
  tone?: 'dim' | 'warn' | 'critical';
  action?: ReactNode;
}

export function EmptyState({
  title,
  detail,
  loading = false,
  tone = 'dim',
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 border border-rule bg-panel px-4 py-14 text-center">
      <span className={cn('reticle', `reticle-${tone}`)}>
        {loading ? (
          <span className="blink mr-1.5" aria-hidden>
            ▮
          </span>
        ) : null}
        {title}
      </span>
      <p className="max-w-md text-[11px] leading-relaxed text-ink-dim">
        {detail}
      </p>
      {action}
    </div>
  );
}
