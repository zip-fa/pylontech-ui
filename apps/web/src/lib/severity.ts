import type { CellState } from '@libs/protocol';

export type Severity = 'ok' | 'warn' | 'critical';

/** Vendor thresholds for cell spread in mV: tight pack, drifting pack, pack that needs attention. */
export const SPREAD_WATCH_MV = 30;
export const SPREAD_PROBLEM_MV = 100;

export function spreadSeverity(spread: number): Severity {
  if (!Number.isFinite(spread)) return 'ok';

  if (spread > SPREAD_PROBLEM_MV) return 'critical';

  if (spread >= SPREAD_WATCH_MV) return 'warn';

  return 'ok';
}

export const SPREAD_LABEL: Record<Severity, string> = {
  ok: 'Balanced',
  warn: 'Drifting',
  critical: 'Out of balance',
};

/** Anything the BMS does not call "Normal" is at least a warning. */
export function stateSeverity(state: CellState): Severity {
  if (state === 'Normal') return 'ok';

  if (state === 'Protect' || state === 'Alarm') return 'critical';

  return 'warn';
}

export function isNormal(state: CellState): boolean {
  return state === 'Normal';
}

/** Signed deviation bucket, -4..4, driving the diverging cell fill. */
export function deviationBucket(deltaMv: number): number {
  if (!Number.isFinite(deltaMv)) return 0;
  const magnitude = Math.abs(deltaMv);
  const step =
    magnitude < 3
      ? 0
      : magnitude < 8
        ? 1
        : magnitude < 16
          ? 2
          : magnitude < 30
            ? 3
            : 4;

  if (step === 0) return 0;

  return deltaMv < 0 ? -step : step;
}

export function deviationColor(bucket: number): string {
  if (bucket === 0) return 'var(--dev-zero)';

  return bucket < 0 ? `var(--dev-neg-${-bucket})` : `var(--dev-pos-${bucket})`;
}

export function deviationInk(bucket: number): string {
  return Math.abs(bucket) === 4 ? 'var(--dev-ink-strong)' : 'var(--dev-ink)';
}

/** Flattens a pack's four state fields into the alerts a reader actually has to act on. */
export function packFaults(
  states: Array<{ label: string; state: CellState }>,
): string[] {
  return states
    .filter((entry) => !isNormal(entry.state))
    .map((entry) => `${entry.label} ${entry.state}`);
}
