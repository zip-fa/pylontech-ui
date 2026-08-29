import {
  parseSpecification,
  type EuroStats,
  type PackInfo,
  type PackStat,
} from '@libs/protocol';

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

  if (rated.length === 0 || rated.some((value) => value === null)) return null;

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

    if (!stat) return false;

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
  if (percent >= 90) return 'ok';

  if (percent >= 80) return 'warn';

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
          title="Measured capacity"
          note={
            attached === null
              ? 'console-attached pack · address unidentified'
              : `pack ${attached} · console cable`
          }
        />
        <PanelBody className="flex flex-col gap-4 p-3">
          {euro === null ? (
            <p className="text-xs text-ink-faint">
              No <code className="text-ink-dim">euro</code> reading yet. The
              daemon polls it on the slow sweep; it should appear within a
              minute of the console opening.
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
                    ? 'nameplate unknown'
                    : `of ${num(rated, 0)} Ah nameplate${attached === null ? ', shared by every pack' : ''}`}
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
                    {num(health, 1)} % of nameplate ·{' '}
                    {num(Math.max(0, 100 - health), 1)} % capacity lost
                  </p>
                </div>
              ) : null}

              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-[3px] text-[12px]">
                <Field
                  label="In service since"
                  value={dateText(euro.dateInService)}
                />
                <Field
                  label="Date of manufacture"
                  value={dateText(euro.dateOfManufacture)}
                />
                <Field
                  label="Storage before use"
                  value={text(euro.storageDays)}
                />
                <Field
                  label="Charge/discharge cycles"
                  value={count(euro.cycles)}
                />
                <Field
                  label="Deep discharges"
                  value={count(euro.deepDischargeCount)}
                  tone={euro.deepDischargeCount > 0 ? 'warn' : 'ok'}
                />
                <Field
                  label="Internal resistance"
                  value={reported(
                    euro.resistanceMilliOhm,
                    `${int(euro.resistanceMilliOhm)} mΩ`,
                  )}
                />
                <Field
                  label="Round-trip efficiency"
                  value={reported(
                    euro.roundTripEfficiency,
                    `${int(euro.roundTripEfficiency)} %`,
                  )}
                />
                <Field
                  label="Self-discharge rate"
                  value={reported(
                    euro.selfDischargeRate,
                    int(euro.selfDischargeRate),
                  )}
                />
                <Field
                  label="Reserve capacity"
                  value={`${int(euro.remainCapacity2)} Ah`}
                />
                <Field
                  label="Remaining power"
                  value={`${int(euro.remainPower)} W`}
                />
                <Field
                  label="Time at extreme temperature"
                  value={`${count(euro.extremeTempSeconds)} s`}
                  tone={euro.extremeTempSeconds > 0 ? 'warn' : 'ok'}
                />
                <Field
                  label="Energy in / out"
                  value={`${whAsKwh(euro.chargeEnergyThroughput, 1)} / ${whAsKwh(euro.dischargeEnergyThroughput, 1)} kWh`}
                />
                <Field
                  label="Charge in / out"
                  value={`${count(euro.chargeCapacityThroughput)} / ${count(euro.dischargeCapacityThroughput)} Ah`}
                />
              </dl>
            </>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHead
          title="Per-pack wear"
          note={`${addresses.length} pack${addresses.length === 1 ? '' : 's'}`}
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
            <span className="text-ink-dim">euro</span> takes no address: it
            reports only the pack whose console port holds the cable, so
            measuring another pack means moving the cable to it.
            {attached === null
              ? ' Its counters matched no single pack on the bus, so the column it belongs to is unknown.'
              : ''}{' '}
            <span className="text-ink-dim">Charge cycles</span> is derived from
            accumulated amp-hours rather than counted independently, so it
            restates lifetime throughput and says nothing on its own about wear.
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
  const row = (
    label: string,
    unit: string | undefined,
    render: (stat: PackStat | undefined, address: number) => string,
    tone?: (stat: PackStat | undefined, address: number) => Severity,
    group?: boolean,
  ): MetricRow => ({
    label,
    unit,
    group,
    cells: addresses.map((address) => ({
      value: render(stats[address], address),
      tone: tone?.(stats[address], address),
    })),
  });

  const rows: MetricRow[] = [
    row('Nameplate', 'Ah', (_s, address) => {
      const rated = nameplateAh(info[address]);

      return rated === null ? '—' : num(rated, 0);
    }),
    // Only ever populated for one column: the pack the console cable happens to be plugged into.
    row('Measured capacity', 'Ah', (_s, address) =>
      euro && address === attached
        ? num(euro.remainCapacity, 0)
        : 'needs the cable',
    ),
    row(
      'Capacity retained',
      '%',
      (_s, address) => {
        const rated = nameplateAh(info[address]);

        if (!euro || address !== attached || !rated) return '—';

        return num((euro.remainCapacity / rated) * 100, 1);
      },
      (_s, address) => {
        const rated = nameplateAh(info[address]);

        if (!euro || address !== attached || !rated) return 'ok';

        return healthSeverity((euro.remainCapacity / rated) * 100);
      },
    ),
    // Firmware-computed, and several builds leave it flat at zero — worth showing, not worth trusting alone.
    row(
      'State of health, reported',
      '%',
      (s) =>
        s === undefined ? '—' : s.soh > 0 ? num(s.soh, 0) : 'not reported',
      (s) => (s && s.soh > 0 ? healthSeverity(s.soh) : 'ok'),
      true,
    ),
    row('Charge cycles', undefined, (s) => count(s?.cycleTimes)),
    row('Lifetime discharge', 'Ah', (s) => mahAsAh(s?.dischargeCapacity, 0)),
    row('Equivalent full cycles', undefined, (s, address) => {
      const rated = nameplateAh(info[address]);

      if (!s || !rated) return '—';

      return num(s.dischargeCapacity / 1000 / rated, 1);
    }),
    row('Charge held now', 'Ah', (s) => num(s?.coulombAh, 1), undefined, true),
    row('Charge counter', '%', (s) => int(s?.powerPercent)),
  ];

  return (
    <MetricGrid
      corner="Wear"
      columns={addresses.map((address) => `Pack ${address}`)}
      rows={rows}
    />
  );
}

/** The console prints an all-dashes date when the field was never programmed at the factory. */
function dateText(value: string): string {
  const trimmed = value.trim();

  return trimmed === '' || /^-+[\s:-]*$/.test(trimmed)
    ? 'not programmed'
    : trimmed;
}

/** Several of these counters read a flat zero on firmware that never computes them. */
function reported(value: number, formatted: string): string {
  return value === 0 ? 'not reported' : formatted;
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
