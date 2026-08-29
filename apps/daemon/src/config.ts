import { fileURLToPath } from 'node:url';

import { SerialPort } from 'serialport';

export const config = {
  port: Number(process.env['PORT'] ?? 4300),
  /**
   * Where the built UI lives. One process serves both the API and the page it feeds, so the
   * browser talks to a single origin and needs no host configuration.
   */
  webRoot:
    process.env['WEB_ROOT'] ??
    fileURLToPath(new URL('../../web/dist', import.meta.url)),
  serialPath: process.env['SERIAL_PATH'] ?? null,
  baudRate: Number(process.env['BAUD_RATE'] ?? 115200),
  /**
   * Normally null: `pwr` enumerates every slot and flags which are present, so the addresses are
   * discovered rather than configured. The override exists only to pin a subset for debugging.
   */
  addresses: parseAddresses(process.env['PACK_ADDRESSES']),
  pollPwrMs: Number(process.env['POLL_PWR_MS'] ?? 5000),
  pollCellsMs: Number(process.env['POLL_CELLS_MS'] ?? 30000),
  pollStatMs: Number(process.env['POLL_STAT_MS'] ?? 3600000),
  pollIdentityMs: Number(process.env['POLL_IDENTITY_MS'] ?? 300000),
};

function parseAddresses(value: string | undefined): number[] | null {
  const parsed = (value ?? '')
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isInteger(entry) && entry > 0);

  return parsed.length ? parsed : null;
}

const FTDI_VENDOR_ID = '0403';
const USB_SERIAL = /usbserial|ttyUSB|usbmodem/i;

/**
 * The adapter enumerates under a different device node on every machine and after some replugs,
 * so the path is discovered rather than configured. `SERIAL_PATH` still wins when set.
 */
export async function resolveSerialPath(): Promise<string | null> {
  if (config.serialPath) return config.serialPath;

  const ports = await SerialPort.list();
  const ftdi = ports.find(
    (p) =>
      p.vendorId?.toLowerCase() === FTDI_VENDOR_ID ||
      /ftdi/i.test(p.manufacturer ?? ''),
  );
  const found = (ftdi ?? ports.find((p) => USB_SERIAL.test(p.path)))?.path;

  return found ? calloutDevice(found) : null;
}

/** macOS only enumerates /dev/tty.*, which blocks on open until DCD; the callout node does not. */
const calloutDevice = (path: string): string =>
  process.platform === 'darwin' ? path.replace('/dev/tty.', '/dev/cu.') : path;
