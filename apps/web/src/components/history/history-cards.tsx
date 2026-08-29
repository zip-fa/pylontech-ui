import type { EnergyDay, HistorySummary, StackTotals } from '@libs/protocol';
import { useTranslation } from 'react-i18next';

import { Kpi } from '@/components/ui/kpi';
import { int, num, whAsKwh } from '@/lib/format';
import { SPREAD_LABEL_KEY, spreadSeverity } from '@/lib/severity';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Below this the stack is resting, and a projection from it would divide by nearly nothing. */
const IDLE_W = 20;

/**
 * How long until the stack is full, or empty, at the rate it is running right now. Deliberately
 * naive: it is a rate extrapolation, not a forecast, which is why the card says "at this rate" —
 * the moment the load changes, the answer changes with it.
 */
function projection(
  totals: StackTotals,
): { key: 'toFull' | 'toEmpty'; hours: number } | null {
  const remaining = totals.energyRemaining;

  if (remaining === null || !Number.isFinite(totals.power)) {
    return null;
  }

  if (totals.power > IDLE_W && totals.energyNominal !== null) {
    const headroom = totals.energyNominal - remaining;

    return headroom <= 0
      ? null
      : { key: 'toFull', hours: headroom / totals.power };
  }

  if (totals.power < -IDLE_W) {
    return { key: 'toEmpty', hours: remaining / -totals.power };
  }

  return null;
}

/** Hours as the reader would say them: minutes under an hour, days past two. */
function duration(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }

  if (hours < 48) {
    return `${hours.toFixed(1)}h`;
  }

  return `${(hours / 24).toFixed(1)}d`;
}

export interface HistoryCardsProps {
  summary: HistorySummary;
  energy: EnergyDay[] | null;
  totals: StackTotals | null;
}

export function HistoryCards({ summary, energy, totals }: HistoryCardsProps) {
  const { t } = useTranslation();

  const days = energy ?? [];
  // The last entry is today's own bucket, so yesterday is the one before it.
  const yesterday = days.length >= 2 ? days[days.length - 2] : null;

  const spreadTone = spreadSeverity(summary.peak.spreadMax ?? 0);
  const forecast = totals ? projection(totals) : null;

  /*
   * Energy out over energy in. Over a single day this is dominated by whether the stack happened to
   * end the day fuller than it started, so it is taken over the week, where that evens out.
   */
  const roundTrip =
    summary.week.chargedWh > 0
      ? (summary.week.dischargedWh / summary.week.chargedWh) * 100
      : null;

  return (
    <div className="bed grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      <Kpi
        label={t('history.cards.chargedToday')}
        value={whAsKwh(summary.today.chargedWh)}
        unit="kWh"
        foot={
          yesterday
            ? t('history.cards.yesterday', {
                value: whAsKwh(yesterday.chargedWh),
              })
            : t('history.cards.noYesterday')
        }
      />
      <Kpi
        label={t('history.cards.dischargedToday')}
        value={whAsKwh(summary.today.dischargedWh)}
        unit="kWh"
        foot={
          yesterday
            ? t('history.cards.yesterday', {
                value: whAsKwh(yesterday.dischargedWh),
              })
            : t('history.cards.noYesterday')
        }
      />
      <Kpi
        label={t('history.cards.roundTrip')}
        value={roundTrip === null ? '—' : num(roundTrip, 0)}
        unit={roundTrip === null ? undefined : '%'}
        foot={t('history.cards.roundTripNote')}
      />
      <Kpi
        label={t('history.cards.atThisRate')}
        value={forecast ? duration(forecast.hours) : '—'}
        foot={
          forecast
            ? t(`history.cards.${forecast.key}`)
            : t('history.cards.notMoving')
        }
      />
      <Kpi
        label={t('history.cards.peakPower')}
        value={`${int(summary.peak.charge)}/${int(summary.peak.discharge)}`}
        unit="W"
        foot={t('history.cards.peakPowerNote')}
      />
      <Kpi
        label={t('history.cards.warmest')}
        value={num(summary.peak.tempMax, 1)}
        unit="°C"
        foot={t('history.cards.warmestNote')}
      />
      <Kpi
        label={t('history.cards.worstSpread')}
        value={num(summary.peak.spreadMax, 0)}
        unit="mV"
        tone={spreadTone}
        foot={t('history.cards.worstSpreadNote', {
          verdict: t(SPREAD_LABEL_KEY[spreadTone]).toLowerCase(),
        })}
      />
    </div>
  );
}

/** What is actually on disk, so an empty axis is never a mystery. */
export function CoverageNote({ summary }: { summary: HistorySummary }) {
  const { t } = useTranslation();
  const { coverage } = summary;

  if (coverage.first === null || coverage.last === null) {
    return <>{t('history.coverage.empty')}</>;
  }

  const days = (coverage.last - coverage.first) / DAY_MS;

  return (
    <>
      {t('history.coverage.recorded', {
        days: days < 1 ? '<1' : days.toFixed(1),
        rows: coverage.rows.toLocaleString(),
        retention: coverage.retentionDays,
      })}
    </>
  );
}
