import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'caps inline-flex items-center justify-center gap-1.5 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:ring-[var(--ring)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border border-rule text-ink-dim hover:border-rule-strong hover:text-ink',
        accent: 'border border-accent/60 text-accent hover:bg-accent/10',
        ghost: 'text-ink-dim hover:text-ink',
      },
      size: {
        default: 'h-7 px-2.5',
        sm: 'h-6 px-2',
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
