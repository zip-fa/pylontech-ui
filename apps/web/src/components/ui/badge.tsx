import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/** A boxed word. Outline only, so it sits on the page like a stamp rather than a button. */
const badgeVariants = cva(
  'inline-flex h-[18px] items-center gap-1 border px-1.5 text-[10px] leading-none font-medium tracking-[0.06em] uppercase whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-rule text-ink-dim',
        outline: 'border-rule text-ink-faint',
        ok: 'border-ok/60 bg-ok-soft text-ok',
        warn: 'border-warn/60 bg-warn-soft text-warn',
        critical: 'border-critical/70 bg-critical-soft text-critical',
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
