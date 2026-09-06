import { cn } from '@/lib/utils';

export type SegmentTone =
  'ok' | 'warn' | 'critical' | 'accent' | 'cold' | 'ink' | 'dim';

const FILL: Record<SegmentTone, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  critical: 'var(--critical)',
  accent: 'var(--accent)',
  cold: 'var(--cold)',
  ink: 'var(--ink)',
  dim: 'var(--ink-dim)',
};

/** A fraction of the scale coloured by where it falls: red at the bottom, green at the top. */
export function rampTone(fraction: number): SegmentTone {
  if (fraction < 0.2) {
    return 'critical';
  }

  if (fraction < 0.4) {
    return 'accent';
  }

  if (fraction < 0.6) {
    return 'warn';
  }

  return 'ok';
}

export interface SegmentsProps {
  value: number;
  max?: number;
  /** How many blocks the scale is cut into. */
  count?: number;
  /** Colour of a lit block, given the fraction of the scale that block stands for. */
  tone?: SegmentTone | ((fraction: number) => SegmentTone);
  /** Tint for an unlit block, so the zones of the scale show even when nothing reaches them. */
  zone?: (fraction: number) => SegmentTone | null;
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

/**
 * Discrete blocks rather than a smooth bar. A block is either lit or not, so the eye counts
 * rather than estimates, and neighbouring meters line up block for block.
 */
export function Segments({
  value,
  max = 100,
  count = 20,
  tone = 'ok',
  zone,
  size = 'md',
  label,
  className,
}: SegmentsProps) {
  const safe = Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : 0;
  const lit = Math.round((safe / max) * count);

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={safe}
      className={cn(
        'flex w-full gap-[2px]',
        size === 'sm' ? 'h-2' : 'h-2.5',
        className,
      )}
    >
      {Array.from({ length: count }, (_, index) => {
        // A block stands for the top of its own slice, so the first block lights at the first step.
        const fraction = (index + 1) / count;
        const on = index < lit;
        const zoneTone = zone?.(fraction) ?? null;
        const background = on
          ? FILL[typeof tone === 'function' ? tone(fraction) : tone]
          : zoneTone
            ? `color-mix(in srgb, ${FILL[zoneTone]} 22%, var(--seg-empty))`
            : 'var(--seg-empty)';

        return (
          <span
            key={index}
            className="min-w-[2px] flex-1"
            style={{ background }}
            aria-hidden
          />
        );
      })}
    </div>
  );
}
