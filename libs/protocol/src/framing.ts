/** A response is complete once the `$$` terminator is followed by a fresh prompt. */
export const PROMPT = 'pylon>';
export const TERMINATOR = '$$';
export const PAGINATION = 'Press [Enter] to be continued';

export function isComplete(buffer: string): boolean {
  const tail = buffer.trimEnd();

  return tail.endsWith(PROMPT) && buffer.includes(TERMINATOR);
}

export function countPages(buffer: string): number {
  return buffer.split(PAGINATION).length - 1;
}

/**
 * A prompt can arrive mid-chunk with more output behind it, so the tail of the buffer is not a
 * reliable place to look: count every prompt seen and compare against the pages already answered.
 */
export function needsPage(buffer: string, answered: number): boolean {
  return countPages(buffer) > answered;
}

export interface Frame {
  frame: string;
  rest: string;
}

/** Cuts the first `$$`-terminated frame off the buffer; a late answer and ours can share a chunk. */
export function takeFrame(buffer: string): Frame | null {
  const end = buffer.indexOf(TERMINATOR);

  if (end < 0) {
    return null;
  }

  const prompt = buffer.indexOf(PROMPT, end + TERMINATOR.length);

  if (prompt < 0) {
    return null;
  }

  const cut = prompt + PROMPT.length;

  return { frame: buffer.slice(0, cut), rest: buffer.slice(cut) };
}

/** The console echoes the command before the `@` ack; anything else is another request's answer. */
export function echoMatches(frame: string, command: string): boolean {
  return echoOf(frame) === normalise(command);
}

export function echoOf(frame: string): string {
  for (const line of frame.replace(/\r/g, '\n').split('\n')) {
    const text = line.trim().startsWith(PROMPT)
      ? line.trim().slice(PROMPT.length)
      : line;
    const trimmed = normalise(text);

    if (trimmed) {
      return trimmed;
    }
  }

  return '';
}

const normalise = (text: string): string => text.trim().replace(/\s+/g, ' ');

/** Strips the echoed command, the `@` ack, pagination prompts and the trailing frame. */
export function cleanResponse(raw: string, command: string): string {
  return raw
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => {
      const t = line.trim().startsWith(PROMPT)
        ? line.trim().slice(PROMPT.length).trim()
        : line.trim();

      if (normalise(t) === normalise(command)) {
        return false;
      }

      if (t === '@' || t === TERMINATOR || t === PROMPT || t === '') {
        return false;
      }

      if (t.startsWith(PAGINATION)) {
        return false;
      }

      return true;
    })
    .join('\n');
}
