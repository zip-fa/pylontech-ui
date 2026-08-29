import type { StackTotals } from '@libs/protocol';
import { CircleAlert, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

import { num, signed, whAsKwh } from '@/lib/format';
import { SPREAD_LABEL, spreadSeverity, type Severity } from '@/lib/severity';
import { cn } from '@/lib/utils';

function flowLabel(power: number): string {
  if (!Number.isFinite(power) || Math.abs(power) < 1) {
    return 'idle';
  }

  return power > 0 ? 'charging' : 'discharging';
}

/**
 * The band stays put above the tabs: whichever panel is open, the eight figures that decide
 * whether anything is wrong stay on screen.
 */
export function StackBand({ totals }: { totals: StackTotals }) {
  const soc = Number.isFinite(totals.soc)
    ? Math.min(100, Math.max(0, totals.soc))
    : 0;
  const spreadTone = spreadSeverity(totals.worstSpread);
  const flowing = Number.isFinite(totals.power) && Math.abs(totals.power) >= 1;

  return (
    <div className="bed grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-8">
      <Kpi
        label="Charge"
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
        label="Energy"
        value={whAsKwh(totals.energyRemaining)}
        unit="kWh"
        foot={
          totals.energyNominal === null
            ? 'nameplate unread'
            : `of ${whAsKwh(totals.energyNominal)} nominal`
        }
      />
      <Kpi
        label="Voltage"
        value={num(totals.voltage, 2)}
        unit="V"
        foot={`${totals.cellCount} cells in series`}
      />
      <Kpi
        label="Current"
        value={signed(totals.current, 1)}
        unit="A"
        tone={flowing ? 'ok' : undefined}
        foot={flowLabel(totals.power)}
      />
      <Kpi
        label="Power"
        value={signed(totals.power, 0)}
        unit="W"
        foot={
          totals.power < 0
            ? 'out of the stack'
            : totals.power > 0
              ? 'into the stack'
              : 'no flow'
        }
      />
      <Kpi
        label="Temperature"
        value={`${num(totals.tempMin, 1)}–${num(totals.tempMax, 1)}`}
        unit="°C"
        foot={`${num(totals.tempMax - totals.tempMin, 1)} °C spread`}
      />
      <Kpi
        label="Worst spread"
        value={num(totals.worstSpread, 0)}
        unit="mV"
        tone={spreadTone}
        foot={SPREAD_LABEL[spreadTone].toLowerCase()}
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
  const Icon = alarm ? CircleAlert : ShieldCheck;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col justify-between gap-1 px-3 py-2',
        alarm ? 'bg-[var(--critical-soft)]' : 'bg-panel',
      )}
    >
      <span className="silk text-ink-faint">Status</span>
      <span
        className={cn(
          'flex items-center gap-1.5 text-[15px] leading-none font-semibold',
          alarm ? 'text-[var(--critical)]' : 'text-[var(--ok)]',
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{alarm ? 'Alarm active' : 'All clear'}</span>
      </span>
      <span className="tnum truncate text-[11px] text-ink-faint">
        {present} of {total} addresses answered
      </span>
    </div>
  );
}
