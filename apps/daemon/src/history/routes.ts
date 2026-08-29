import { Router } from 'express';

import type { Store } from '../db/client.ts';

import {
  bucketFor,
  coverage,
  energyDays,
  healthSeries,
  packSeries,
  stackSeries,
  summary,
} from './queries.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface HistoryRouteOptions {
  intervalMs: number;
  retentionDays: number;
}

/**
 * Read-only, and every parameter is clamped rather than rejected: this is a dashboard talking to
 * itself, and a stale bookmark should draw a sensible window instead of an error.
 */
export function historyRoutes(
  store: Store,
  options: HistoryRouteOptions,
): Router {
  const router = Router();

  const window = (query: Record<string, unknown>) => {
    const to = number(query['to'], Date.now());
    const from = number(query['from'], to - DAY_MS);
    const points = clamp(number(query['points'], 480), 1, 2000);

    return {
      from: Math.min(from, to),
      to,
      bucketMs: bucketFor(from, to, points, options.intervalMs),
    };
  };

  router.get('/summary', (req, res, next) => {
    void summary(store, {
      offsetMinutes: offset(req.query['tz']),
      intervalMs: options.intervalMs,
      retentionDays: options.retentionDays,
    })
      .then((body) => res.json(body))
      .catch(next);
  });

  router.get('/coverage', (_req, res, next) => {
    void coverage(store, options)
      .then((body) => res.json(body))
      .catch(next);
  });

  router.get('/stack', (req, res, next) => {
    const range = window(req.query);

    void stackSeries(store, range)
      .then((points) => res.json({ ...range, points }))
      .catch(next);
  });

  router.get('/packs', (req, res, next) => {
    const range = window(req.query);

    void packSeries(store, range)
      .then((points) =>
        res.json({
          ...range,
          points,
          addresses: [...new Set(points.map((point) => point.address))].sort(
            (a, b) => a - b,
          ),
        }),
      )
      .catch(next);
  });

  router.get('/energy', (req, res, next) => {
    void energyDays(store, {
      days: clamp(number(req.query['days'], 30), 1, 400),
      offsetMinutes: offset(req.query['tz']),
    })
      .then((days) => res.json({ days }))
      .catch(next);
  });

  router.get('/health', (req, res, next) => {
    const to = number(req.query['to'], Date.now());

    void healthSeries(store, {
      from: number(req.query['from'], to - 365 * DAY_MS),
      to,
    })
      .then((points) => res.json({ points }))
      .catch(next);
  });

  return router;
}

const number = (value: unknown, fallback: number): number => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, Math.round(value)));

/** The browser's offset, so days are cut where the reader's day is cut. */
const offset = (value: unknown): number =>
  clamp(number(value, 0), -14 * 60, 14 * 60);
