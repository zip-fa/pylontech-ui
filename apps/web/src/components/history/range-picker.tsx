import { useTranslation } from 'react-i18next';

import { RANGE_IDS, type RangeId } from '@/lib/history';
import { cn } from '@/lib/utils';

/** Four fixed windows rather than a date picker: this is a wall panel, not a reporting tool. */
export function RangePicker({
  value,
  onChange,
}: {
  value: RangeId;
  onChange: (id: RangeId) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t('history.rangeLabel')}
      className="flex items-center gap-1"
    >
      {RANGE_IDS.map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={id === value}
          onClick={() => onChange(id)}
          className={cn(
            'caps tnum h-6 border px-2 text-[11px] transition-colors focus-visible:ring-1 focus-visible:ring-[var(--ring)] focus-visible:outline-none',
            id === value
              ? 'border-accent text-ink'
              : 'border-transparent text-ink-faint hover:text-ink-dim',
          )}
        >
          {t(`history.ranges.${id}`)}
        </button>
      ))}
    </div>
  );
}
