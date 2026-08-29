import type {
  Coverage,
  EnergyDay,
  HealthPoint,
  HistorySummary,
  PackSeries,
  StackSeries,
} from '@libs/protocol';

import { getJson } from '@/lib/api';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Storage is optional: the daemon answers 503 on every history route when the database did not
 * open. That is a state the page draws, not a failure it reports, so it gets its own error type
 * rather than arriving as an unreadable status line.
 */
export class HistoryUnavailableError extends Error {
  constructor() {
    super('history storage is unavailable');
    this.name = 'HistoryUnavailableError';
  }
}

async function getHistory<T>(path: string): Promise<T> {
  try {
    return await getJson<T>(`/api/history${path}`);
  } catch (error) {
    if (error instanceof Error && /responded 503$/.test(error.message)) {
      throw new HistoryUnavailableError();
    }

    throw error;
  }
}

export const RANGE_IDS = ['6h', '24h', '7d', '30d'] as const;

export type RangeId = (typeof RANGE_IDS)[number];

/**
 * `points` is how many buckets to draw, not how many rows exist; the daemon widens its bucket to
 * fit. Wider windows ask for fewer points because a month at minute resolution is 43 200 of them
 * and the chart is a few hundred pixels wide.
 */
export const RANGES: Record<RangeId, { spanMs: number; points: number }> = {
  '6h': { spanMs: 6 * HOUR_MS, points: 360 },
  '24h': { spanMs: DAY_MS, points: 480 },
  '7d': { spanMs: 7 * DAY_MS, points: 336 },
  '30d': { spanMs: 30 * DAY_MS, points: 360 },
};

/**
 * The right-hand edge is quantised to the minute. The live feed polls every five seconds, and a
 * `to` that moved with it would make every render a cache miss for a chart whose last bucket is a
 * minute wide anyway.
 */
export function rangeWindow(
  id: RangeId,
  now = Date.now(),
): { from: number; to: number; points: number } {
  const to = Math.floor(now / MINUTE_MS) * MINUTE_MS;
  const range = RANGES[id];

  return { from: to - range.spanMs, to, points: range.points };
}

/** Minutes ahead of UTC, which is the sign the daemon shifts by to cut days at local midnight. */
export function timezoneOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

export function fetchSummary(): Promise<HistorySummary> {
  return getHistory<HistorySummary>(`/summary?tz=${timezoneOffsetMinutes()}`);
}

export function fetchCoverage(): Promise<Coverage> {
  return getHistory<Coverage>('/coverage');
}

export function fetchStackSeries(window: {
  from: number;
  to: number;
  points: number;
}): Promise<StackSeries> {
  return getHistory<StackSeries>(
    `/stack?from=${window.from}&to=${window.to}&points=${window.points}`,
  );
}

export function fetchPackSeries(window: {
  from: number;
  to: number;
  points: number;
}): Promise<PackSeries> {
  return getHistory<PackSeries>(
    `/packs?from=${window.from}&to=${window.to}&points=${window.points}`,
  );
}

export function fetchEnergyDays(days: number): Promise<EnergyDay[]> {
  return getHistory<{ days: EnergyDay[] }>(
    `/energy?days=${days}&tz=${timezoneOffsetMinutes()}`,
  ).then((body) => body.days);
}

export function fetchHealthSeries(from: number): Promise<HealthPoint[]> {
  return getHistory<{ points: HealthPoint[] }>(`/health?from=${from}`).then(
    (body) => body.points,
  );
}
