const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Tick labels are cut to the width of the window: a clock time carries no information across a
 * month, and a date carries none across six hours.
 */
export function tickFormatter(spanMs: number): (at: number) => string {
  if (spanMs <= 2 * DAY_MS) {
    return (at) =>
      new Date(at).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
  }

  return (at) =>
    new Date(at).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
}

/** The tooltip always spells the moment out in full; there is room for it and no room for doubt. */
export function momentFormatter(spanMs: number): (at: number) => string {
  const withDate = spanMs > 12 * HOUR_MS;

  return (at) => {
    const date = new Date(at);
    const time = date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return withDate
      ? `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${time}`
      : time;
  };
}

export function dayFormatter(at: number): string {
  return new Date(at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Where zero falls between the top and bottom of the axis, as a fraction from the top. A signed
 * series is filled with a gradient that switches colour at exactly that point, so charging and
 * discharging are told apart by the fill rather than by reading the axis.
 */
export function zeroOffset(min: number, max: number): number {
  if (max <= 0) {
    return 0;
  }

  if (min >= 0) {
    return 1;
  }

  return max / (max - min);
}

/** Pads a domain so the extremes are not drawn on the frame, and never collapses to a point. */
export function paddedDomain(
  values: number[],
  minimumSpan: number,
): [number, number] {
  const finite = values.filter((value) => Number.isFinite(value));

  if (finite.length === 0) {
    return [0, minimumSpan];
  }

  const low = Math.min(...finite);
  const high = Math.max(...finite);
  const span = Math.max(high - low, minimumSpan);
  const pad = span * 0.08;

  return [low - pad, high + pad];
}

/**
 * Rounds a signed domain out to a round step, so the axis is labelled 2000/1000/0 rather than with
 * whatever floats the extremes happened to be. Recharts labels the domain bounds verbatim, and an
 * unrounded bound is both unreadable and wide enough to clip.
 */
export function niceSignedDomain(min: number, max: number): [number, number] {
  const magnitude = Math.max(Math.abs(min), Math.abs(max), 1);
  const step = 10 ** Math.floor(Math.log10(magnitude)) / 2;

  return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
}
