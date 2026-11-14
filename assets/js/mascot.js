/* Veridell — Amigo, exactly as drawn.
 *
 * The artwork is used as delivered: the five poses cut from the character
 * sheet, checkerboard removed, nothing redrawn or restyled. Each pose is a
 * state, and the state is what the interface reacts to:
 *
 *   front     idle — standing, heart lit
 *   reading   thinking — sitting with a tablet, while a request is in flight
 *   cheer     happy — thumbs up, when an answer lands
 *   waving    listening — waving, while the microphone is open
 *   confused  uncertain / error — puzzled, when the sources disagree or
 *             the request could not finish
 *
 * The wrapper carries data-state so the stylesheet can move it; the picture
 * itself is decorative, because the sentence beside it already says what is
 * happening.
 */

const BASE = '/assets/img/amigo/';

export const AMIGO_POSES = {
  // One canonical state list, mapped onto the five poses that exist. Several
  // states share a pose because the artwork has five drawings, not nine — the
  // label beside the character carries the difference, never the picture alone.
  idle: { file: 'front.png', w: 240, h: 320, label: 'Ask Amigo anything' },
  listening: { file: 'waving.png', w: 305, h: 320, label: 'Listening…' },
  researching: { file: 'reading.png', w: 243, h: 320, label: 'Finding relevant sources…' },
  composing: { file: 'reading.png', w: 243, h: 320, label: 'Putting the answer together…' },
  success: { file: 'cheer.png', w: 268, h: 320, label: 'Answer ready' },
  uncertain: { file: 'confused.png', w: 265, h: 320, label: 'The sources do not fully agree' },
  error: { file: 'confused.png', w: 265, h: 320, label: 'The request could not finish' },
  // kept so older callers do not break; both are aliases of real states now
  thinking: { file: 'reading.png', w: 243, h: 320, alias: 'researching' },
  happy: { file: 'cheer.png', w: 268, h: 320, alias: 'success' },
  sleepy: { file: 'confused.png', w: 265, h: 320, alias: 'uncertain' },
};

export const AMIGO_STATES = Object.keys(AMIGO_POSES);

/** One instance. `state` is idle | listening | researching | composing |
 *  success | uncertain | error (the older thinking / happy / sleepy names still
 *  resolve, through their aliases). */
export function amigoImg({ state = 'idle', className = '' } = {}) {
  const pose = AMIGO_POSES[state] || AMIGO_POSES.idle;
  return `<img class="amigo ${className}" data-state="${state}" src="${BASE}${pose.file}" `
    + `width="${pose.w}" height="${pose.h}" alt="" aria-hidden="true" decoding="async">`;
}

/** Point an instance, or the wrapper that holds one, at a state. */
export function setAmigoState(el, state) {
  if (!el) return;
  const img = el.matches?.('.amigo') ? el : el.querySelector('.amigo');
  if (!img) return;
  const asked = AMIGO_STATES.includes(state) ? state : 'idle';
  const next = AMIGO_POSES[asked]?.alias || asked;
  const pose = AMIGO_POSES[next];
  img.dataset.state = next;
  const src = `${BASE}${pose.file}`;
  if (!img.getAttribute('src')?.endsWith(pose.file)) {
    img.setAttribute('src', src);
    img.setAttribute('width', String(pose.w));
    img.setAttribute('height', String(pose.h));
  }
}
