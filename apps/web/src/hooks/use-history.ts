import type {
  EnergyDay,
  HistorySummary,
  PackSeries,
  StackSeries,
} from '@libs/protocol';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import {
  fetchEnergyDays,
  fetchPackSeries,
  fetchStackSeries,
  fetchSummary,
  HistoryUnavailableError,
  rangeWindow,
  type RangeId,
} from '@/lib/history';

/**
 * The recorder writes one row a minute, so asking more often than that returns the same rows. The
 * live band keeps its five-second cadence; only the charts slow down.
 */
const REFRESH_MS = 60_000;

/**
 * Advances the charted window with the clock. Only the clock needs an effect; the window itself is
 * derived, so changing the range redraws immediately instead of on a second render.
 */
function useMinuteWindow(range: RangeId) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_MS);

    return () => clearInterval(timer);
  }, []);

  return useMemo(() => rangeWindow(range, now), [range, now]);
}

export interface HistoryFeed {
  summary: HistorySummary | null;
  stack: StackSeries | null;
  packs: PackSeries | null;
  energy: EnergyDay[] | null;
  isPending: boolean;
  /** The daemon is up but storage is not; the page says so instead of drawing an empty axis. */
  unavailable: boolean;
  error: string | null;
}

export function useHistoryFeed(range: RangeId): HistoryFeed {
  const window = useMinuteWindow(range);

  const summary = useQuery({
    queryKey: ['history', 'summary'],
    queryFn: fetchSummary,
    refetchInterval: REFRESH_MS,
    retry: false,
  });

  const stack = useQuery({
    queryKey: ['history', 'stack', window.from, window.to, window.points],
    queryFn: () => fetchStackSeries(window),
    refetchInterval: REFRESH_MS,
    // Keeps the previous window on screen while the next one loads, so the chart never blanks.
    placeholderData: (previous) => previous,
    retry: false,
  });

  const packs = useQuery({
    queryKey: ['history', 'packs', window.from, window.to, window.points],
    queryFn: () => fetchPackSeries(window),
    refetchInterval: REFRESH_MS,
    placeholderData: (previous) => previous,
    retry: false,
  });

  const energy = useQuery({
    queryKey: ['history', 'energy'],
    queryFn: () => fetchEnergyDays(30),
    refetchInterval: REFRESH_MS,
    retry: false,
  });

  const failures = [summary.error, stack.error, packs.error, energy.error];
  const unavailable = failures.some(
    (error) => error instanceof HistoryUnavailableError,
  );
  const other = failures.find(
    (error): error is Error =>
      error instanceof Error && !(error instanceof HistoryUnavailableError),
  );

  return {
    summary: summary.data ?? null,
    stack: stack.data ?? null,
    packs: packs.data ?? null,
    energy: energy.data ?? null,
    isPending: summary.isPending && stack.isPending,
    unavailable,
    error: other ? other.message : null,
  };
}
