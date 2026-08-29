/**
 * Whitelist of console commands the daemon may send. Built as an allow-list so that
 * `shut`, `trst`, `eurostub` and `updata` are unreachable from any layer above.
 */
export const READ_COMMANDS = {
  pwr: () => 'pwr',
  bat: (address: number) => `bat ${address}`,
  info: (address: number) => `info ${address}`,
  stat: (address: number) => `stat ${address}`,
  euro: () => 'euro',
  topen: () => 'topen',
  getpwr: () => 'getpwr',
  time: () => 'time',
} as const;

export type ReadCommand = keyof typeof READ_COMMANDS;

const ALLOWED = new Set<string>([
  'pwr',
  'bat',
  'info',
  'stat',
  'euro',
  'topen',
  'getpwr',
  'time',
  'log',
  'data',
  'datalist',
  'help',
]);

/** `disp` streams forever and never returns to the prompt; it would hang the queue. */
const NEVER = new Set<string>([
  'shut',
  'trst',
  'eurostub',
  'updata',
  'disp',
  'login',
  'logout',
  'cmudtesttime',
]);

export function isCommandAllowed(line: string): boolean {
  const verb = line.trim().split(/\s+/)[0]?.toLowerCase() ?? '';

  if (NEVER.has(verb)) {
    return false;
  }

  // `time` with arguments sets the RTC; only the bare read form is allowed through.
  if (verb === 'time' && line.trim().split(/\s+/).length > 1) {
    return false;
  }

  return ALLOWED.has(verb);
}
