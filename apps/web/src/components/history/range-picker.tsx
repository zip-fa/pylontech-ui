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
      className="flex items-center gap-px"
    >
      {RANGE_IDS.map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={id === value}
          onClick={() => onChange(id)}
          className={cn(
            'tnum border px-2 py-[3px] text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none',
            id === value
              ? 'border-rule-strong bg-panel-sunken text-ink'
              : 'border-transparent text-ink-faint hover:text-ink-dim',
          )}
        >
          {t(`history.ranges.${id}`)}
        </button>
      ))}
    </div>
  );
}
