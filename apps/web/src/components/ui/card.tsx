import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** A bordered face on the instrument: hairline edge, a head band, no shadow, no radius. */
export function Panel({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col border border-rule bg-panel',
        className,
      )}
      {...props}
    />
  );
}

export interface PanelHeadProps extends ComponentProps<'header'> {
  title: string;
  /** Right-aligned annotation: a count, a cadence, a caveat. */
  note?: ReactNode;
  tone?: 'ok' | 'dim' | 'warn' | 'critical' | 'accent';
}

export function PanelHead({
  title,
  note,
  tone = 'ok',
  className,
  children,
  ...props
}: PanelHeadProps) {
  return (
    <header
      className={cn(
        'flex h-9 shrink-0 items-center gap-3 border-b border-rule bg-panel-head px-3',
        className,
      )}
      {...props}
    >
      <h2
        className={cn('reticle shrink-0', tone !== 'ok' && `reticle-${tone}`)}
      >
        {title}
      </h2>
      {note ? (
        <span className="ml-auto truncate text-[11px] text-ink-faint">
          {note}
        </span>
      ) : null}
      {children}
    </header>
  );
}

export function PanelBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('min-w-0 flex-1', className)} {...props} />;
}
