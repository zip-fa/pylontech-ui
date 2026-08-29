import { SerialPort } from 'serialport';
import {
  PROMPT,
  cleanResponse,
  countPages,
  echoMatches,
  echoOf,
  isCommandAllowed,
  needsPage,
  takeFrame,
} from '@libs/protocol';

import { resolveSerialPath } from './config.ts';

interface QueueItem {
  command: string;
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
}

// `stat` paginates over a dozen pages and each page costs a console round trip of several seconds.
const RESPONSE_TIMEOUT_MS = 60000;
const WAKE_TIMEOUT_MS = 10000;
// One carriage return can land inside the console's own boot burst and be swallowed, so the
// prompt is asked for repeatedly rather than once.
const WAKE_NUDGE_MS = 1500;
const SETTLE_MS = 8000;
const MAX_PAGES = 60;

/**
 * Owns the serial port. Every command is serialised through one queue: the console is a
 * request/response shell with no multiplexing, so a second write before the `$$` frame
 * arrives corrupts both responses.
 *
 * The console answers slowly (seconds) and never identifies which request a frame belongs to,
 * so every frame is matched against its echoed command and anything unmatched is dropped —
 * otherwise one timeout shifts every later response onto the wrong request, permanently.
 */
export class ConsolePort {
  private port: SerialPort | null = null;
  private queue: QueueItem[] = [];
  private active: QueueItem | null = null;
  private buffer = '';
  private pagesAnswered = 0;
  private timer: NodeJS.Timeout | null = null;
  private draining = false;
  private notify: (() => void) | null = null;

  public path: string | null = null;
  public connected = false;
  public lastError: string | null = null;

  private readonly baudRate: number;

  constructor(baudRate: number) {
    this.baudRate = baudRate;
  }

  async open(): Promise<void> {
    if (this.port?.isOpen) {
      return;
    }

    try {
      this.path = await resolveSerialPath();

      if (!this.path) {
        throw new Error(
          'no usb serial adapter found; set SERIAL_PATH to choose one',
        );
      }

      const path = this.path;

      await new Promise<void>((resolve, reject) => {
        const port = new SerialPort(
          {
            path,
            baudRate: this.baudRate,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
          },
          (error) => (error ? reject(error) : resolve()),
        );

        this.port = port;
      });

      // The console stays silent until both lines are asserted, with no error to indicate why.
      await new Promise<void>((resolve, reject) =>
        this.port?.set({ dtr: true, rts: true }, (e) =>
          e ? reject(e) : resolve(),
        ),
      );

      this.port?.on('data', (chunk: Buffer) => this.onData(chunk));
      this.port?.on('close', () => this.onClose('port closed'));
      this.port?.on('error', (error: Error) => this.onClose(error.message));

      this.connected = true;
      this.lastError = null;

      // Asserting the lines emits a burst of noise and the first prompt lags by seconds; both would
      // otherwise be consumed as the first command's answer.
      if (!(await this.drain(WAKE_TIMEOUT_MS, true))) {
        this.lastError = 'console did not answer the wake prompt';
      }

      this.pump();
    } catch (error) {
      this.connected = false;
      this.lastError = (error as Error).message;
      throw error;
    }
  }

  close(): void {
    this.port?.close();
    this.port = null;
    this.connected = false;
  }

  send(command: string): Promise<string> {
    if (!isCommandAllowed(command)) {
      return Promise.reject(new Error(`Command not permitted: ${command}`));
    }

    return new Promise<string>((resolve, reject) => {
      this.queue.push({ command, resolve, reject });
      this.pump();
    });
  }

  private pump(): void {
    if (
      this.active ||
      this.draining ||
      !this.queue.length ||
      !this.port?.isOpen
    ) {
      return;
    }

    const item = this.queue.shift();

    if (!item) {
      return;
    }

    this.active = item;
    this.buffer = '';
    this.pagesAnswered = 0;
    this.timer = setTimeout(
      () => this.fail(new Error(`Timed out: ${item.command}`)),
      RESPONSE_TIMEOUT_MS,
    );
    this.port.write(`${item.command}\r`);
  }

  private onData(chunk: Buffer): void {
    // Assertion noise arrives as NULs and would break echo matching on the first frame.
    const text = chunk.toString('ascii').replace(/\0/g, '');

    this.buffer += text;

    if (this.draining) {
      this.notify?.();

      return;
    }

    if (!this.active) {
      return;
    }

    if (
      needsPage(this.buffer, this.pagesAnswered) &&
      this.pagesAnswered < MAX_PAGES
    ) {
      this.pagesAnswered += 1;
      this.port?.write('\r');

      return;
    }

    for (
      let frame = takeFrame(this.buffer);
      frame;
      frame = takeFrame(this.buffer)
    ) {
      this.buffer = frame.rest;
      this.pagesAnswered = Math.max(
        0,
        this.pagesAnswered - countPages(frame.frame),
      );

      if (echoMatches(frame.frame, this.active.command)) {
        const item = this.active;

        // A completed round trip proves the link, so any earlier complaint about it is stale.
        this.lastError = null;
        this.settle();
        item.resolve(cleanResponse(frame.frame, item.command));

        return;
      }

      console.warn(
        `dropped frame echoing "${echoOf(frame.frame)}" while awaiting "${this.active.command}"`,
      );
    }
  }

  private fail(error: Error): void {
    const item = this.active;

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = null;
    this.active = null;
    this.lastError = error.message;
    item?.reject(error);
    // The answer is still coming; it has to be swallowed before the next command goes out.
    void this.drain(SETTLE_MS, false);
  }

  private settle(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = null;
    this.active = null;
    queueMicrotask(() => this.pump());
  }

  /**
   * Swallows everything already in flight. A response that arrives after its own timeout would
   * otherwise be read as the answer to whatever command runs next.
   */
  private async drain(timeoutMs: number, wake: boolean): Promise<boolean> {
    if (!this.port?.isOpen) {
      return false;
    }

    this.draining = true;
    this.buffer = '';

    if (wake) {
      this.port.write('\r');
    }

    const sawPrompt = await new Promise<boolean>((resolve) => {
      const finish = (value: boolean): void => {
        clearTimeout(timer);

        if (nudge) {
          clearInterval(nudge);
        }

        this.notify = null;
        this.draining = false;
        this.buffer = '';
        resolve(value);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      const nudge = wake
        ? setInterval(() => this.port?.write('\r'), WAKE_NUDGE_MS)
        : null;

      // The prompt proves the console is awake; waiting out the full timeout would only delay boot.
      this.notify = wake
        ? () => void (this.buffer.includes(PROMPT) && finish(true))
        : null;
    });

    this.pump();

    return sawPrompt;
  }

  private onClose(reason: string): void {
    this.connected = false;
    this.lastError = reason;
    this.fail(new Error(reason));
    for (const item of this.queue.splice(0)) {
      item.reject(new Error(reason));
    }
  }
}
