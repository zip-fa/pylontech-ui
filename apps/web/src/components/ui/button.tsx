import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-sm text-[12px] font-semibold tracking-[0.06em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-ink text-panel hover:opacity-85',
        outline:
          'border border-rule text-ink-dim hover:border-rule-strong hover:text-ink',
        ghost: 'text-ink-dim hover:bg-panel-sunken hover:text-ink',
      },
      size: {
        default: 'h-7 px-2.5',
        sm: 'h-6 px-2',
        icon: 'h-7 w-7',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
