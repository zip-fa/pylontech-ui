import {
  parseSpecification,
  type EuroStats,
  type PackInfo,
  type PackStat,
} from '@libs/protocol';
import type { ParseKeys, TFunction } from 'i18next';
import { Trans, useTranslation } from 'react-i18next';

import { MetricGrid, type MetricRow } from '@/components/metric-grid';
import { Panel, PanelBody, PanelHead } from '@/components/ui/card';
import { count, int, mahAsAh, num, text, whAsKwh } from '@/lib/format';
import type { Severity } from '@/lib/severity';
import { cn } from '@/lib/utils';

export interface DegradationProps {
  addresses: number[];
  euro: EuroStats | null;
  info: Record<number, PackInfo>;
  stats: Record<number, PackStat>;
}

/** Nameplate amp-hours for one pack, read from its own `Specification` string. */
function nameplateAh(entry: PackInfo | undefined): number | null {
  return parseSpecification(entry?.specification)?.ampHours ?? null;
}

/** The nameplate the whole stack shares, if it shares one — packs can be mixed. */
function commonNameplateAh(
  addresses: number[],
  info: Record<number, PackInfo>,
): number | null {
  const rated = addresses.map((address) => nameplateAh(info[address]));

  if (rated.length === 0 || rated.some((value) => value === null)) {
    return null;
  }

  return rated.every((value) => value === rated[0]) ? rated[0] : null;
}

/**
 * `euro` names no address, so the pack it describes has to be inferred. Cycle count and lifetime
 * discharge together are specific enough to pick one pack out of a stack; if they are not, we say
 * so rather than guess.
 */
function identifyEuroPack(
  euro: EuroStats,
  addresses: number[],
  stats: Record<number, PackStat>,
): number | null {
  const matches = addresses.filter((address) => {
    const stat = stats[address];

    if (!stat) {
      return false;
    }

    const lifetimeAh = stat.dischargeCapacity / 1000;
    const closeOnCapacity =
      euro.dischargeCapacityThroughput > 0 &&
      Math.abs(lifetimeAh - euro.dischargeCapacityThroughput) <=
        Math.max(2, euro.dischargeCapacityThroughput * 0.02);

    return stat.cycleTimes === euro.cycles && closeOnCapacity;
  });

  return matches.length === 1 ? (matches[0] ?? null) : null;
}

function healthSeverity(percent: number): Severity {
  if (percent >= 90) {
    return 'ok';
  }

  if (percent >= 80) {
    return 'warn';
  }

  return 'critical';
}

/**
 * Real degradation, as opposed to the firmware's own opinion of it. `euro`'s remaining capacity is
 * a measured amp-hour figure; `stat`'s SOH is computed, and several firmware builds leave it at
 * zero. Both are shown, labelled for what they are.
 */
export function Degradation({
  addresses,
  euro,
  info,
  stats,
}: DegradationProps) {
  const { t } = useTranslation();
  const attached = euro ? identifyEuroPack(euro, addresses, stats) : null;
  // Even when the pack cannot be named, the percentage still holds if every pack carries the same
  // nameplate — the usual case for a stack bought as one.
  const rated =
    attached === null
      ? commonNameplateAh(addresses, info)
      : nameplateAh(info[attached]);
  const health =
    euro && rated && rated > 0 ? (euro.remainCapacity / rated) * 100 : null;

  return (
    <div className="bed grid grid-cols-1 gap-px xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <Panel>
        <PanelHead
          title={t('panels.measuredCapacity')}
          note={
            attached === null
              ? t('degradation.attachedUnknown')
              : t('degradation.attachedTo', { address: attached })
          }
        />
        <PanelBody className="flex flex-col gap-4 p-3">
          {euro === null ? (
            <p className="text-xs text-ink-faint">
              <Trans
                i18nKey="degradation.euroMissing"
                components={{ code: <code className="text-ink-dim" /> }}
              />
            </p>
          ) : (
            <>
              <div className="flex items-end gap-3">
                <span
                  className={cn(
                    'tnum text-[44px] leading-[0.9] font-semibold tracking-tight',
                    health !== null &&
                      healthSeverity(health) === 'warn' &&
                      'text-[var(--warn)]',
                    health !== null &&
                      healthSeverity(health) === 'critical' &&
                      'text-[var(--critical)]',
                  )}
                >
                  {num(euro.remainCapacity, 0)}
                </span>
                <span className="pb-1 text-sm text-ink-dim">Ah</span>
                <span className="tnum ml-auto pb-1 text-right text-xs text-ink-faint">
                  {rated === null
                    ? t('degradation.nameplateUnknown')
                    : t(
                        attached === null
                          ? 'degradation.ofNameplateShared'
                          : 'degradation.ofNameplate',
                        { value: num(rated, 0) },
                      )}
                </span>
              </div>

              {health !== null ? (
                <div className="flex flex-col gap-1.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-sunken">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        healthSeverity(health) === 'ok' && 'bg-[var(--ok)]',
                        healthSeverity(health) === 'warn' && 'bg-[var(--warn)]',
                        healthSeverity(health) === 'critical' &&
                          'bg-[var(--critical)]',
                      )}
                      style={{
                        width: `${Math.min(100, Math.max(2, health))}%`,
                      }}
                    />
                  </div>
                  <p className="tnum text-xs text-ink-dim">
                    {t('degradation.healthLine', {
                      retained: num(health, 1),
                      lost: num(Math.max(0, 100 - health), 1),
                    })}
                  </p>
                </div>
              ) : null}

              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-[3px] text-[12px]">
                <Field
                  label={t('degradation.inService')}
                  value={dateText(t, euro.dateInService)}
                />
                <Field
                  label={t('degradation.manufactured')}
                  value={dateText(t, euro.dateOfManufacture)}
                />
                <Field
                  label={t('degradation.storage')}
                  value={text(euro.storageDays)}
                />
                <Field
                  label={t('degradation.cycles')}
                  value={count(euro.cycles)}
                />
                <Field
                  label={t('degradation.deepDischarges')}
                  value={count(euro.deepDischargeCount)}
                  tone={euro.deepDischargeCount > 0 ? 'warn' : 'ok'}
                />
                <Field
                  label={t('degradation.resistance')}
                  value={reported(
                    t,
                    euro.resistanceMilliOhm,
                    `${int(euro.resistanceMilliOhm)} mΩ`,
                  )}
                />
                <Field
                  label={t('degradation.efficiency')}
                  value={reported(
                    t,
                    euro.roundTripEfficiency,
                    `${int(euro.roundTripEfficiency)} %`,
                  )}
                />
                <Field
                  label={t('degradation.selfDischarge')}
                  value={reported(
                    t,
                    euro.selfDischargeRate,
                    int(euro.selfDischargeRate),
                  )}
                />
                <Field
                  label={t('degradation.reserveCapacity')}
                  value={`${int(euro.remainCapacity2)} Ah`}
                />
                {/*
                  The console calls this "Remain Power" but it is energy, not power: it divides by
                  the remaining amp-hours at a pack voltage, which is what watt-hours do.
                */}
                <Field
                  label={t('degradation.remainingEnergy')}
                  value={`${int(euro.remainPower)} Wh`}
                />
                <Field
                  label={t('degradation.extremeTemp')}
                  value={`${count(euro.extremeTempSeconds)} s`}
                  tone={euro.extremeTempSeconds > 0 ? 'warn' : 'ok'}
                />
                <Field
                  label={t('degradation.energyInOut')}
                  value={`${whAsKwh(euro.chargeEnergyThroughput, 1)} / ${whAsKwh(euro.dischargeEnergyThroughput, 1)} kWh`}
                />
                <Field
                  label={t('degradation.chargeInOut')}
                  value={`${count(euro.chargeCapacityThroughput)} / ${count(euro.dischargeCapacityThroughput)} Ah`}
                />
              </dl>
            </>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHead
          title={t('panels.perPackWear')}
          note={t('panels.packsNote', { count: addresses.length })}
        />
        <PanelBody className="flex flex-col">
          <PackWear
            addresses={addresses}
            attached={attached}
            euro={euro}
            info={info}
            stats={stats}
          />
          <p className="border-t border-rule px-3 py-2 text-[11px] leading-relaxed text-ink-faint">
            <Trans
              i18nKey="degradation.euroNote"
              components={{ term: <span className="text-ink-dim" /> }}
            />{' '}
            {attached === null ? `${t('degradation.euroUnmatched')} ` : ''}
            <Trans
              i18nKey="degradation.cyclesNote"
              components={{ term: <span className="text-ink-dim" /> }}
            />
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}

function PackWear({
  addresses,
  attached,
  euro,
  info,
  stats,
}: DegradationProps & { attached: number | null }) {
  const { t } = useTranslation();

  const row = (
    key: ParseKeys,
    unit: string | undefined,
    render: (stat: PackStat | undefined, address: number) => string,
    tone?: (stat: PackStat | undefined, address: number) => Severity,
    group?: boolean,
  ): MetricRow => ({
    id: key,
    label: t(key),
    unit,
    group,
    cells: addresses.map((address) => ({
      value: render(stats[address], address),
      tone: tone?.(stats[address], address),
    })),
  });

  const rows: MetricRow[] = [
    row('degradation.nameplate', 'Ah', (_s, address) => {
      const rated = nameplateAh(info[address]);

      return rated === null ? '—' : num(rated, 0);
    }),
    // Only ever populated for one column: the pack the console cable happens to be plugged into.
    row('degradation.measured', 'Ah', (_s, address) =>
      euro && address === attached
        ? num(euro.remainCapacity, 0)
        : t('degradation.needsCable'),
    ),
    row(
      'degradation.retained',
      '%',
      (_s, address) => {
        const rated = nameplateAh(info[address]);

        if (!euro || address !== attached || !rated) {
          return '—';
        }

        return num((euro.remainCapacity / rated) * 100, 1);
      },
      (_s, address) => {
        const rated = nameplateAh(info[address]);

        if (!euro || address !== attached || !rated) {
          return 'ok';
        }

        return healthSeverity((euro.remainCapacity / rated) * 100);
      },
    ),
    // Firmware-computed, and several builds leave it flat at zero — worth showing, not worth trusting alone.
    row(
      'degradation.sohReported',
      '%',
      (s) =>
        s === undefined
          ? '—'
          : s.soh > 0
            ? num(s.soh, 0)
            : t('degradation.notReported'),
      (s) => (s && s.soh > 0 ? healthSeverity(s.soh) : 'ok'),
      true,
    ),
    row('degradation.cycles', undefined, (s) => count(s?.cycleTimes)),
    row('degradation.lifetimeDischarge', 'Ah', (s) =>
      mahAsAh(s?.dischargeCapacity, 0),
    ),
    row('degradation.equivalentCycles', undefined, (s, address) => {
      const rated = nameplateAh(info[address]);

      if (!s || !rated) {
        return '—';
      }

      return num(s.dischargeCapacity / 1000 / rated, 1);
    }),
    row(
      'degradation.chargeHeldNow',
      'Ah',
      (s) => num(s?.coulombAh, 1),
      undefined,
      true,
    ),
    row('degradation.chargeCounter', '%', (s) => int(s?.powerPercent)),
  ];

  return (
    <MetricGrid
      corner={t('grid.wear')}
      columns={addresses.map((address) => t('grid.pack', { address }))}
      rows={rows}
    />
  );
}

/** The console prints an all-dashes date when the field was never programmed at the factory. */
function dateText(t: TFunction, value: string): string {
  const trimmed = value.trim();

  return trimmed === '' || /^-+[\s:-]*$/.test(trimmed)
    ? t('degradation.notProgrammed')
    : trimmed;
}

/** Several of these counters read a flat zero on firmware that never computes them. */
function reported(t: TFunction, value: number, formatted: string): string {
  return value === 0 ? t('degradation.notReported') : formatted;
}

function Field({
  label,
  value,
  tone = 'ok',
}: {
  label: string;
  value: string;
  tone?: Severity;
}) {
  return (
    <>
      <dt className="truncate text-ink-dim">{label}</dt>
      <dd
        className={cn(
          'tnum text-right font-medium',
          tone === 'warn' && 'text-[var(--warn)]',
          tone === 'critical' && 'text-[var(--critical)]',
        )}
      >
        {value}
      </dd>
    </>
  );
}
