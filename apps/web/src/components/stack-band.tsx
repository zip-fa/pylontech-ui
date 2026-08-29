import type { StackTotals } from '@libs/protocol';
import { CircleAlert, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { num, signed, whAsKwh } from '@/lib/format';
import {
  SPREAD_LABEL_KEY,
  spreadSeverity,
  type Severity,
} from '@/lib/severity';
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
  const soc = Number.isFinite(totals.soc)
    ? Math.min(100, Math.max(0, totals.soc))
    : 0;
  const spreadTone = spreadSeverity(totals.worstSpread);
  const flowing = Number.isFinite(totals.power) && Math.abs(totals.power) >= 1;

  return (
    <div className="bed grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-8">
      <Kpi
        label={t('band.charge')}
        value={num(totals.soc, 0)}
        unit="%"
        foot={
          <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-panel-sunken">
            <span
              className="block h-full rounded-full bg-[var(--ok)]"
              style={{ width: `${soc}%` }}
            />
          </span>
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
        tone={flowing ? 'ok' : undefined}
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

function Kpi({
  label,
  value,
  unit,
  foot,
  tone = 'ok',
}: {
  label: string;
  value: string;
  unit?: string;
  foot?: ReactNode;
  tone?: Severity;
}) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-1 bg-panel px-3 py-2">
      <span className="silk text-ink-faint">{label}</span>
      <span
        className={cn(
          'tnum flex items-baseline gap-1 text-[26px] leading-none font-semibold tracking-tight',
          tone === 'warn' && 'text-[var(--warn)]',
          tone === 'critical' && 'text-[var(--critical)]',
        )}
      >
        <span className="truncate">{value}</span>
        {unit ? (
          <span className="text-[12px] font-normal text-ink-faint">{unit}</span>
        ) : null}
      </span>
      {typeof foot === 'string' ? (
        <span className="truncate text-[11px] text-ink-faint">{foot}</span>
      ) : (
        foot
      )}
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
  const Icon = alarm ? CircleAlert : ShieldCheck;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col justify-between gap-1 px-3 py-2',
        alarm ? 'bg-[var(--critical-soft)]' : 'bg-panel',
      )}
    >
      <span className="silk text-ink-faint">{t('band.status')}</span>
      <span
        className={cn(
          'flex items-center gap-1.5 text-[15px] leading-none font-semibold',
          alarm ? 'text-[var(--critical)]' : 'text-[var(--ok)]',
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
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
