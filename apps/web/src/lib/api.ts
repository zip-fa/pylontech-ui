import type { Snapshot } from '@libs/protocol';

export interface Health {
  connected: boolean;
  port: string | null;
  error: string | null;
}

const TIMEOUT_MS = 4000;

async function getJson<T>(path: string): Promise<T> {
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
    return `Daemon did not answer within ${TIMEOUT_MS / 1000}s`;
  }

  if (error instanceof TypeError) {
    return 'Cannot reach the daemon — is it running?';
  }

  return error instanceof Error ? error.message : String(error);
}
