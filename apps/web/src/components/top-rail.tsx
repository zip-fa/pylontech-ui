import type { Snapshot, StackTotals } from '@libs/protocol';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { POLL_INTERVAL_MS } from '@/hooks/use-snapshot';
import { useLanguage } from '@/hooks/use-language';
import { LANGUAGE_NAMES, LANGUAGES } from '@/i18n';
import type { Health } from '@/lib/api';
import { ageLabel, clockTime, secondsSince } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface TopRailProps {
  snapshot: Snapshot | null;
  health: Health | null;
  fetchError: string | null;
  now: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onRefresh: () => void;
}

/**
 * One line carrying identity and link state, the two answers to the first question anyone asks
 * of a readout: whose figures are these, and are they current.
 */
export function TopRail({
  snapshot,
  health,
  fetchError,
  now,
  theme,
  onToggleTheme,
  onRefresh,
}: TopRailProps) {
  const { t } = useTranslation();
  const [language, cycleLanguage] = useLanguage();
  const nextLanguage =
    LANGUAGES[(LANGUAGES.indexOf(language) + 1) % LANGUAGES.length];
  const connected = snapshot?.connected ?? health?.connected ?? false;
  const port = snapshot?.port ?? health?.port ?? null;
  // Two independent failures: the daemon cannot reach the battery, or we cannot reach the daemon.
  const batteryError = snapshot?.error ?? health?.error ?? null;
  const age = secondsSince(snapshot?.updatedAt ?? null, now);
  const stale = age !== null && age > 15;

  return (
    <>
      <div className="flex h-10 items-center gap-3 px-3">
        <StackName totals={snapshot?.totals ?? null} />

        <span className="leader hidden md:block" aria-hidden />

        <span className="tnum hidden items-baseline gap-2 text-[11px] whitespace-nowrap sm:flex">
          <span className={cn('text-ink', stale && 'text-warn')}>
            {clockTime(snapshot?.updatedAt ?? null)}
          </span>
          <span className={cn('text-ink-faint', stale && 'text-warn')}>
            {ageLabel(age)}
          </span>
        </span>

        <span className="leader hidden md:block" aria-hidden />

        <span className="caps flex items-center gap-2 text-[11px] whitespace-nowrap">
          <span
            className={cn(
              'size-1.5',
              connected ? 'bg-ok' : 'blink bg-critical',
            )}
            aria-hidden
          />
          <span className={connected ? 'text-ink' : 'text-critical'}>
            {connected ? t('rail.connected') : t('rail.disconnected')}
          </span>
          <span className="hidden tracking-normal text-ink-faint normal-case lg:inline">
            {port ?? t('rail.noPort')}
          </span>
        </span>

        <span className="silk hidden whitespace-nowrap xl:inline">
          {t('rail.poll', { seconds: POLL_INTERVAL_MS / 1000 })}
        </span>

        <div className="ml-1 flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            aria-label={t('rail.refresh')}
          >
            <span className="text-accent" aria-hidden>
              ↻
            </span>
            {t('rail.refreshShort')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? t('rail.toLight') : t('rail.toDark')}
          >
            {theme === 'dark' ? t('rail.light') : t('rail.dark')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={cycleLanguage}
            aria-label={`${t('rail.language')}: ${LANGUAGE_NAMES[nextLanguage].name}`}
            title={LANGUAGE_NAMES[nextLanguage].name}
          >
            {LANGUAGE_NAMES[nextLanguage].short}
          </Button>
        </div>
      </div>

      {fetchError ? (
        <ErrorRow label={t('rail.daemon')} message={fetchError} />
      ) : null}
      {batteryError ? (
        <ErrorRow label={t('rail.battery')} message={batteryError} />
      ) : null}
    </>
  );
}

/** Model, pack count, cell count and capacity all come from the stack itself. */
function StackName({ totals }: { totals: StackTotals | null }) {
  const { t } = useTranslation();
  const models = totals?.models ?? [];
  const name =
    models.length === 0
      ? t('rail.stack')
      : models.length === 1
        ? `${totals?.manufacturer ? `${totals.manufacturer} ` : ''}${models[0]}`
        : t('rail.mixed', { models: models.join(', ') });

  const parts: string[] = [];

  if (totals) {
    // `packCount` is how many addresses the bus enumerates (always 16), not how many packs exist.
    parts.push(t('rail.packs', { count: totals.presentCount }));

    if (totals.cellCount > 0) {
      parts.push(t('rail.cells', { count: totals.cellCount }));
    }

    if (totals.energyNominal !== null) {
      const value = (totals.energyNominal / 1000).toFixed(1);

      parts.push(
        totals.ratedPackCount < totals.presentCount
          ? t('rail.energyPartial', { value, rated: totals.ratedPackCount })
          : t('rail.energy', { value }),
      );
    }
  }

  return (
    <div className="flex min-w-0 shrink-0 items-baseline gap-3">
      <h1 className="caps truncate text-[12px] leading-none font-semibold text-ink">
        {name}
      </h1>
      <p className="caps tnum hidden truncate text-[11px] text-ink-faint sm:block">
        {parts.length > 0 ? parts.join(' · ') : t('rail.waiting')}
      </p>
    </div>
  );
}

function ErrorRow({ label, message }: { label: string; message: string }) {
  return (
    <div className="border-t border-critical/40 bg-critical-soft px-3 py-1.5">
      <p className="flex gap-3 text-[11px] text-critical">
        <span className="caps shrink-0 font-medium">! {label}</span>
        <span className="min-w-0 break-words">{message}</span>
      </p>
    </div>
  );
}
