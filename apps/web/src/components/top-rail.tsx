import type { Snapshot, StackTotals } from '@libs/protocol';
import { Moon, RefreshCw, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
 * One rail carrying identity and link state. Both belong at the top because both answer the same
 * first question: is what I am about to read actually current, and whose readings are these.
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
  const connected = snapshot?.connected ?? health?.connected ?? false;
  const port = snapshot?.port ?? health?.port ?? null;
  // Two independent failures: the daemon cannot reach the battery, or we cannot reach the daemon.
  const batteryError = snapshot?.error ?? health?.error ?? null;
  const age = secondsSince(snapshot?.updatedAt ?? null, now);
  const stale = age !== null && age > 15;

  return (
    <div className="sticky top-0 z-30 border-b border-rule bg-ground/95 backdrop-blur">
      <div className="flex h-11 items-center gap-x-5 gap-y-1 px-3">
        <StackName totals={snapshot?.totals ?? null} />

        <span className="ml-auto flex items-center gap-2 whitespace-nowrap">
          <span
            className={cn(
              'size-2 rounded-full',
              connected ? 'bg-[var(--ok)]' : 'bg-[var(--critical)]',
            )}
            aria-hidden
          />
          <span
            className={cn(
              'text-[12px] font-semibold',
              connected ? 'text-ink' : 'text-[var(--critical)]',
            )}
          >
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          <code className="rounded-sm bg-panel-sunken px-1.5 py-0.5 text-[11px] text-ink-dim">
            {port ?? 'no port'}
          </code>
        </span>

        <span className="hidden items-baseline gap-1.5 text-[11px] whitespace-nowrap text-ink-faint sm:flex">
          <span
            className={cn('tnum text-ink-dim', stale && 'text-[var(--warn)]')}
          >
            {clockTime(snapshot?.updatedAt ?? null)}
          </span>
          <span className={cn(stale && 'text-[var(--warn)]')}>
            {ageLabel(age)}
          </span>
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            aria-label="Refresh now"
          >
            <RefreshCw className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? (
              <Sun className="size-3.5" />
            ) : (
              <Moon className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      {fetchError ? <ErrorRow label="Daemon" message={fetchError} /> : null}
      {batteryError ? (
        <ErrorRow label="Battery" message={batteryError} />
      ) : null}
    </div>
  );
}

/** Model, pack count, cell count and capacity all come from the stack itself. */
function StackName({ totals }: { totals: StackTotals | null }) {
  const models = totals?.models ?? [];
  const name =
    models.length === 0
      ? 'Battery stack'
      : models.length === 1
        ? `${totals?.manufacturer ? `${totals.manufacturer} ` : ''}${models[0]}`
        : `Mixed · ${models.join(', ')}`;

  const parts: string[] = [];

  if (totals) {
    // `packCount` is how many addresses the bus enumerates (always 16), not how many packs exist.
    parts.push(
      `${totals.presentCount} pack${totals.presentCount === 1 ? '' : 's'}`,
    );

    if (totals.cellCount > 0) {
      parts.push(`${totals.cellCount} cells`);
    }

    if (totals.energyNominal !== null) {
      const partial =
        totals.ratedPackCount < totals.presentCount
          ? ` (${totals.ratedPackCount} rated)`
          : '';

      parts.push(`${(totals.energyNominal / 1000).toFixed(1)} kWh${partial}`);
    }
  }

  return (
    <div className="flex min-w-0 items-baseline gap-2.5">
      <h1 className="truncate text-[15px] leading-none font-semibold tracking-tight">
        {name}
      </h1>
      <p className="tnum truncate text-[11px] text-ink-faint">
        {parts.length > 0 ? parts.join(' · ') : 'waiting for the first reading'}
      </p>
    </div>
  );
}

function ErrorRow({ label, message }: { label: string; message: string }) {
  return (
    <div className="border-t border-rule bg-[var(--critical-soft)] px-3 py-1">
      <p className="flex gap-2 text-[11px] text-[var(--critical)]">
        <span className="silk shrink-0 text-[var(--critical)]">{label}</span>
        <span className="min-w-0 break-words">{message}</span>
      </p>
    </div>
  );
}
