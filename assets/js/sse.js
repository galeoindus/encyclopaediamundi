/* Veridell — the server-sent-events reader.
 *
 * The chat streams answers as SSE frames. This module is the part that turns a
 * byte stream into events, kept separate from the chat page so it can be tested
 * without a DOM, a network or a model.
 *
 * The spec detail that mattered: one event may carry several `data:` lines, and
 * they are joined with a real newline before the payload is read. The previous
 * code joined them with the two characters `\` and `n`, which produced invalid
 * JSON the moment a server split an event across two lines — a low-probability
 * bug that would have been impossible to diagnose from the browser.
 *
 * Also handled here, because a stream is not a tidy thing:
 *   · CRLF and LF line endings
 *   · a final frame with no trailing blank line
 *   · comment lines (`:keep-alive`) and non-data fields
 *   · a chunk boundary in the middle of an event
 */

/**
 * Parse one SSE frame into its event name and data payload.
 * Returns null for a frame that carries no data (a comment, a heartbeat).
 */
export function parseFrame(frame) {
  if (!frame || !frame.trim()) return null;
  const data = [];
  let event = '';
  for (const raw of String(frame).split(/\r\n|\r|\n/)) {
    if (!raw || raw.startsWith(':')) continue;
    const colon = raw.indexOf(':');
    const field = colon === -1 ? raw : raw.slice(0, colon);
    let value = colon === -1 ? '' : raw.slice(colon + 1);
    // A single leading space after the colon is part of the syntax, not data.
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'data') data.push(value);
    else if (field === 'event') event = value;
  }
  if (!data.length) return null;
  return { event, data: data.join('\n') };
}

/**
 * Parse a frame whose data is JSON. Returns null when it is not — a stream may
 * legitimately carry a keep-alive or a payload this build does not understand,
 * and neither should end the answer.
 */
export function parseJsonFrame(frame) {
  const parsed = parseFrame(frame);
  if (!parsed) return null;
  try {
    return { event: parsed.event, data: JSON.parse(parsed.data) };
  } catch {
    return null;
  }
}

/**
 * Split a buffer into complete frames, returning the frames and whatever is
 * left over. The leftover must be kept and prefixed to the next chunk, or an
 * event split across two reads is lost.
 */
export function splitFrames(buffer) {
  const parts = String(buffer).split(/\r\n\r\n|\n\n|\r\r/);
  const rest = parts.pop() ?? '';
  return { frames: parts.filter((f) => f.trim()), rest };
}
