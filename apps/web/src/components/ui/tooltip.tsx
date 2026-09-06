import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { useRef, useState, type ComponentProps, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 border border-rule-strong bg-panel px-2.5 py-2 text-[11px] text-ink',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

export interface HintProps extends Omit<ComponentProps<'button'>, 'content'> {
  /** The explanation, in plain language. */
  content: ReactNode;
}

/**
 * A term that carries its own definition: dotted underline on the label, explanation on hover,
 * focus or tap. Radix opens on hover and focus only, so the tap is wired by hand — without it
 * every explanation on the page is unreachable on a phone.
 */
export function Hint({ content, className, children, ...props }: HintProps) {
  const [open, setOpen] = useState(false);
  const openAtPress = useRef(false);

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'cursor-help text-left [letter-spacing:inherit] [text-transform:inherit] underline decoration-ink-faint decoration-dotted underline-offset-[3px] hover:decoration-accent focus-visible:ring-1 focus-visible:ring-[var(--ring)] focus-visible:outline-none',
            className,
          )}
          {...props}
          // Radix has already closed on pointer-down by the time the click lands, so a tap has to
          // toggle against the state the trigger was in before the press.
          onPointerDown={() => {
            openAtPress.current = open;
          }}
          onClick={() => setOpen(!openAtPress.current)}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent
        collisionPadding={8}
        className="max-w-72 leading-relaxed tracking-normal normal-case"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
