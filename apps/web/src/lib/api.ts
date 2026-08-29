import type { Snapshot } from '@libs/protocol';

import { i18n } from '@/i18n';

export interface Health {
  connected: boolean;
  port: string | null;
  error: string | null;
}

const TIMEOUT_MS = 4000;

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`${path} responded ${response.status}`);
  }

  return (await response.json()) as T;
}

export function fetchSnapshot(): Promise<Snapshot> {
  return getJson<Snapshot>('/api/state');
}

export function fetchHealth(): Promise<Health> {
  return getJson<Health>('/api/health');
}

/** The daemon can be unreachable, or reachable but empty; both must read as a real message. */
export function describeFetchError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return i18n.t('errors.timeout', { seconds: TIMEOUT_MS / 1000 });
  }

  if (error instanceof TypeError) {
    return i18n.t('errors.unreachable');
  }

  return error instanceof Error ? error.message : String(error);
}
