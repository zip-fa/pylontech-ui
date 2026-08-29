const PLACEHOLDER = '—';

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Every formatter returns an em dash rather than NaN so a missing reading still lays out. */
export function num(
  value: number | null | undefined,
  digits = 1,
  unit = '',
): string {
  if (!finite(value)) {
    return PLACEHOLDER;
  }

  return `${value.toFixed(digits)}${unit ? ` ${unit}` : ''}`;
}

export function signed(
  value: number | null | undefined,
  digits = 1,
  unit = '',
): string {
  if (!finite(value)) {
    return PLACEHOLDER;
  }

  const sign = value > 0 ? '+' : '';

  return `${sign}${value.toFixed(digits)}${unit ? ` ${unit}` : ''}`;
}

export function int(value: number | null | undefined, unit = ''): string {
  if (!finite(value)) {
    return PLACEHOLDER;
  }

  return `${Math.round(value)}${unit ? ` ${unit}` : ''}`;
}

export function whAsKwh(wh: number | null | undefined, digits = 2): string {
  if (!finite(wh)) {
    return PLACEHOLDER;
  }

  return (wh / 1000).toFixed(digits);
}

export function clockTime(iso: string | null | undefined): string {
  if (!iso) {
    return PLACEHOLDER;
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return PLACEHOLDER;
  }

  return date.toLocaleTimeString(undefined, { hour12: false });
}

export function secondsSince(
  iso: string | null | undefined,
  now: number,
): number | null {
  if (!iso) {
    return null;
  }

  const then = new Date(iso).getTime();

  if (Number.isNaN(then)) {
    return null;
  }

  return Math.max(0, Math.round((now - then) / 1000));
}

export function ageLabel(seconds: number | null): string {
  if (seconds === null) {
    return 'never';
  }

  if (seconds < 2) {
    return 'just now';
  }

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  return `${Math.floor(minutes / 60)}h ago`;
}

/** Strings from the console can come back empty; an em dash lays out, an empty cell does not. */
export function text(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();

  return trimmed === '' ? PLACEHOLDER : trimmed;
}

export function mahAsAh(mah: number | null | undefined, digits = 1): string {
  if (!finite(mah)) {
    return PLACEHOLDER;
  }

  return (mah / 1000).toFixed(digits);
}

/** Large counters read better grouped than as a bare run of digits. */
export function count(value: number | null | undefined): string {
  if (!finite(value)) {
    return PLACEHOLDER;
  }

  return Math.round(value).toLocaleString();
}
