import type { StackTotals } from '@libs/protocol';
import { useTranslation } from 'react-i18next';

import { Kpi } from '@/components/ui/kpi';
import { rampTone, Segments } from '@/components/ui/meter';
import { num, signed, whAsKwh } from '@/lib/format';
import { SPREAD_LABEL_KEY, spreadSeverity } from '@/lib/severity';
import { cn } from '@/lib/utils';

function flowKey(
  power: number,
): 'band.idle' | 'band.charging' | 'band.discharging' {
  if (!Number.isFinite(power) || Math.abs(power) < 1) {
    return 'band.idle';
  }

  return power > 0 ? 'band.charging' : 'band.discharging';
}

/**
 * The band stays put above the tabs: whichever panel is open, the eight figures that decide
 * whether anything is wrong stay on screen.
 */
export function StackBand({ totals }: { totals: StackTotals }) {
  const { t } = useTranslation();
  const spreadTone = spreadSeverity(totals.worstSpread);

  return (
    <div className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-4 xl:grid-cols-8">
      <Kpi
        label={t('band.charge')}
        value={num(totals.soc, 0)}
        unit="%"
        foot={
          <Segments
            value={totals.soc}
            tone={rampTone}
            size="sm"
            className="mt-0.5"
            label={t('band.charge')}
          />
        }
      />
      <Kpi
        label={t('band.energy')}
        value={whAsKwh(totals.energyRemaining)}
        unit="kWh"
        foot={
          totals.energyNominal === null
            ? t('band.nameplateUnread')
            : t('band.ofNominal', { value: whAsKwh(totals.energyNominal) })
        }
      />
      <Kpi
        label={t('band.voltage')}
        value={num(totals.voltage, 2)}
        unit="V"
        foot={t('band.cellsInSeries', { count: totals.cellCount })}
      />
      <Kpi
        label={t('band.current')}
        value={signed(totals.current, 1)}
        unit="A"
        foot={t(flowKey(totals.power))}
      />
      <Kpi
        label={t('band.power')}
        value={signed(totals.power, 0)}
        unit="W"
        foot={
          totals.power < 0
            ? t('band.outOfStack')
            : totals.power > 0
              ? t('band.intoStack')
              : t('band.noFlow')
        }
      />
      <Kpi
        label={t('band.temperature')}
        value={`${num(totals.tempMin, 1)}–${num(totals.tempMax, 1)}`}
        unit="°C"
        foot={t('band.tempSpread', {
          value: num(totals.tempMax - totals.tempMin, 1),
        })}
      />
      <Kpi
        label={t('band.worstSpread')}
        value={num(totals.worstSpread, 0)}
        unit="mV"
        tone={spreadTone}
        foot={t(SPREAD_LABEL_KEY[spreadTone]).toLowerCase()}
      />
      <AlarmKpi
        alarm={totals.alarm}
        present={totals.presentCount}
        total={totals.packCount}
      />
    </div>
  );
}

function AlarmKpi({
  alarm,
  present,
  total,
}: {
  alarm: boolean;
  present: number;
  total: number;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col justify-between gap-1.5 px-3 py-2.5',
        alarm ? 'bg-critical-soft' : 'bg-panel',
      )}
    >
      <span className="silk">{t('band.status')}</span>
      <span
        className={cn(
          'caps flex items-center gap-2 text-[13px] leading-none font-semibold',
          alarm ? 'text-critical' : 'text-ok',
        )}
      >
        <span
          className={cn('size-1.5 shrink-0 bg-current', alarm && 'blink')}
          aria-hidden
        />
        <span className="truncate">
          {alarm ? t('band.alarmActive') : t('band.allClear')}
        </span>
      </span>
      <span className="tnum truncate text-[11px] text-ink-faint">
        {t('band.answered', { present, total })}
      </span>
    </div>
  );
}
