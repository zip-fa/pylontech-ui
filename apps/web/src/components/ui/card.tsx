import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * A panel is a face on the instrument, not a floating card: square-ish corners, a hairline
 * edge and no shadow, so panels can sit shoulder to shoulder on the hairline bed.
 */
export function Panel({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('flex min-w-0 flex-col bg-panel', className)}
      {...props}
    />
  );
}

export interface PanelHeadProps extends ComponentProps<'header'> {
  title: string;
  /** Right-aligned annotation: a count, a cadence, a caveat. */
  note?: ReactNode;
}

export function PanelHead({
  title,
  note,
  className,
  children,
  ...props
}: PanelHeadProps) {
  return (
    <header
      className={cn(
        'flex h-8 shrink-0 items-center gap-3 border-b border-rule px-3',
        className,
      )}
      {...props}
    >
      <h2 className="silk truncate text-ink-dim">{title}</h2>
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
