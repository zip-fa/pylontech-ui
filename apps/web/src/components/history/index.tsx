import type { StackTotals } from '@libs/protocol';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/empty-state';
import { useHistoryFeed } from '@/hooks/use-history';
import type { RangeId } from '@/lib/history';

import { CoverageNote, HistoryCards } from './history-cards';
import { EnergyChart } from './energy-chart';
import { PackSpreadChart, PackTemperatureChart } from './pack-charts';
import { PowerChart } from './power-chart';
import { RangePicker } from './range-picker';
import { SocChart } from './soc-chart';

export interface HistoryPanelProps {
  range: RangeId;
  onRangeChange: (id: RangeId) => void;
  /** The live totals, for the projections the recorded series cannot make on its own. */
  totals: StackTotals | null;
}

/**
 * The recorded view. Cards first, because they answer the questions the live band cannot — what
 * yesterday looked like, what the worst moment of the day was — and charts under them, because a
 * shape is what you go to history for.
 */
export function HistoryPanel({
  range,
  onRangeChange,
  totals,
}: HistoryPanelProps) {
  const { t } = useTranslation();
  const feed = useHistoryFeed(range);

  if (feed.unavailable) {
    return (
      <EmptyState
        title={t('history.unavailableTitle')}
        detail={t('history.unavailableDetail')}
      />
    );
  }

  if (feed.error) {
    return (
      <EmptyState
        tone="critical"
        title={t('history.errorTitle')}
        detail={feed.error}
      />
    );
  }

  if (feed.isPending) {
    return (
      <EmptyState
        loading
        title={t('history.loadingTitle')}
        detail={t('history.loadingDetail')}
      />
    );
  }

  const empty = (feed.summary?.coverage.rows ?? 0) === 0;

  return (
    <div className="flex flex-col gap-3">
      {feed.summary ? (
        <HistoryCards
          summary={feed.summary}
          energy={feed.energy}
          totals={totals}
        />
      ) : null}

      <div className="flex h-9 items-center gap-3 border border-rule bg-panel-head px-3">
        <span className="silk">{t('history.window')}</span>
        <RangePicker value={range} onChange={onRangeChange} />
        <span className="leader hidden sm:block" aria-hidden />
        <span className="truncate text-[11px] text-ink-faint">
          {feed.summary ? <CoverageNote summary={feed.summary} /> : null}
        </span>
      </div>

      {empty ? (
        <EmptyState
          title={t('history.emptyTitle')}
          detail={t('history.emptyDetail')}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {feed.stack ? <PowerChart series={feed.stack} /> : null}
            {feed.stack ? <SocChart series={feed.stack} /> : null}
          </div>

          {feed.energy ? <EnergyChart days={feed.energy} /> : null}

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {feed.packs ? <PackTemperatureChart series={feed.packs} /> : null}
            {feed.packs ? <PackSpreadChart series={feed.packs} /> : null}
          </div>
        </>
      )}
    </div>
  );
}
