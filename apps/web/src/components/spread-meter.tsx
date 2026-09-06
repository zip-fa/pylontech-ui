import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Segments } from '@/components/ui/meter';
import {
  SPREAD_LABEL_KEY,
  SPREAD_PROBLEM_MV,
  SPREAD_WATCH_MV,
  spreadSeverity,
} from '@/lib/severity';
import { cn } from '@/lib/utils';

const SCALE_MAX_MV = 150;
/* 5 mV a block, so both thresholds land exactly on a block edge. */
const BLOCKS = SCALE_MAX_MV / 5;

export function SpreadBadge({
  spread,
  className,
}: {
  spread: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const severity = spreadSeverity(spread);

  return (
    <Badge variant={severity} className={className}>
      {t(SPREAD_LABEL_KEY[severity])}
    </Badge>
  );
}

/**
 * The unlit blocks past 30 and 100 mV are tinted, so the two vendor thresholds are on the scale
 * before the reading reaches them and a bar length reads as a verdict, not just a number.
 */
export function SpreadMeter({
  spread,
  className,
}: {
  spread: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const safe = Number.isFinite(spread) ? Math.max(0, spread) : 0;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Segments
        value={safe}
        max={SCALE_MAX_MV}
        count={BLOCKS}
        tone={spreadSeverity(safe)}
        zone={(fraction) => {
          const mv = fraction * SCALE_MAX_MV;

          return mv > SPREAD_PROBLEM_MV
            ? 'critical'
            : mv > SPREAD_WATCH_MV
              ? 'warn'
              : null;
        }}
        size="sm"
        label={t('cells.mvSpread')}
      />
      <div className="tnum relative h-3 text-[9px] text-ink-faint">
        <span className="absolute left-0">0</span>
        <span
          className="absolute -translate-x-1/2"
          style={{ left: `${(SPREAD_WATCH_MV / SCALE_MAX_MV) * 100}%` }}
        >
          {SPREAD_WATCH_MV}
        </span>
        <span
          className="absolute -translate-x-1/2"
          style={{ left: `${(SPREAD_PROBLEM_MV / SCALE_MAX_MV) * 100}%` }}
        >
          {SPREAD_PROBLEM_MV}
        </span>
        <span className="absolute right-0">{SCALE_MAX_MV}+ mV</span>
      </div>
    </div>
  );
}
