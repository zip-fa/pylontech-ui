import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm px-1.5 py-px text-[11px] leading-[1.4] font-semibold tracking-[0.06em] uppercase whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-panel-sunken text-ink-dim',
        outline: 'border border-rule text-ink-faint',
        ok: 'bg-[var(--ok-soft)] text-[var(--ok)]',
        warn: 'bg-[var(--warn-soft)] text-[var(--warn)]',
        critical: 'bg-[var(--critical-soft)] text-[var(--critical)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type BadgeProps = ComponentProps<'span'> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
