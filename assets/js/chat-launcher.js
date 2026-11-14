/* Veridell — the floating chat launcher.
 *
 * One control, bottom-right, on every page except the chat itself: a tap goes
 * straight to /chat/. The side panel that briefly lived here was removed on
 * request — the chat is a destination, and one click should land in it. It carries its own styles so it works on the app shell,
 * the static pages and the Research Desk without any of them having to know
 * about it.
 *
 * It stays out of the way: it does not cover the composer, it hides while
 * printing, and it respects reduced motion.
 */
(() => {
  if (document.getElementById('im-chat-launcher')) return;


  if (location.pathname.replace(/\/+$/, '') === '/chat') return;

  const style = document.createElement('style');
  style.textContent = `
  .im-launcher {
    position: fixed;
    right: max(16px, env(safe-area-inset-right));
    bottom: max(18px, env(safe-area-inset-bottom));
    z-index: 9000;
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 11px 16px 11px 13px;
    border: 1px solid var(--im-border-strong, rgba(255,255,255,.16));
    border-radius: 999px;
    background: color-mix(in srgb, var(--im-surface, #14251e) 94%, transparent);
    color: var(--im-text, #f0f5f1);
    font: 600 13.5px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    text-decoration: none;
    box-shadow: 0 12px 30px -12px rgba(0,0,0,.42), 0 2px 6px rgba(0,0,0,.16);
    cursor: pointer;
    transition: transform .16s ease, box-shadow .16s ease, opacity .16s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .im-launcher:hover { transform: translateY(-2px); box-shadow: 0 18px 38px -14px rgba(0,0,0,.65); }
  .im-launcher:active { transform: translateY(0) scale(.985); }
  .im-launcher:focus-visible { outline: 2px solid #f7f4ec; outline-offset: 3px; }
  .im-launcher img {
    width: 30px; height: 30px; flex: none; border-radius: 10px;
    filter: drop-shadow(0 3px 7px rgba(0,0,0,.32));
    transition: transform .28s cubic-bezier(.2,.75,.25,1);
  }
  .im-launcher:hover img { transform: rotate(-6deg) scale(1.08); }
  /* A slow, small breath: the mark is a character, not a logo, and it should
     look alive without ever pulling the eye away from the text. */
  @keyframes im-bob {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-2px) rotate(3deg); }
  }
  .im-launcher img { animation: im-bob 4.2s ease-in-out infinite; }
  .im-launcher:hover img { animation: none; }
  .im-launcher .im-lbl { white-space: nowrap; }
  .im-launcher .im-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #7fe0b0; box-shadow: 0 0 0 3px rgba(127,224,176,.22);
    flex: none;
  }
  @media (max-width: 1024px) {
    .im-launcher { bottom: calc(72px + env(safe-area-inset-bottom, 0px)); }
  }
  @media (max-width: 520px) {
    .im-launcher { padding: 10px; gap: 0; }
    .im-launcher .im-lbl, .im-launcher .im-dot { display: none; }
  }
  @media print { .im-launcher { display: none; } }
  @media (prefers-reduced-motion: reduce) {
    .im-launcher, .im-launcher img { transition: none; animation: none; }
    .im-launcher:hover, .im-launcher:hover img { transform: none; }
  }`;
  document.head.append(style);

  const link = document.createElement('a');
  link.id = 'im-chat-launcher';
  link.className = 'im-launcher';
  link.href = '/chat/';
  // The visible label is "Amigo", and WCAG 2.5.3 (Label in Name) requires the
  // accessible name to contain it — speech input matches on this string.
  link.setAttribute('aria-label', 'Open Amigo chat');
  link.innerHTML = `
    <span class="im-face"><img class="amigo amigo--launcher" data-state="idle" src="/assets/img/amigo/front.png" width="239" height="320" alt="" aria-hidden="true" decoding="async"></span>
    <span class="im-dot" aria-hidden="true"></span>
    <span class="im-lbl">Amigo</span>`;

  // A shortcut that does not fight the page's own keys: inside a text field,
  // Ctrl/Cmd+I belongs to the field (italic, insert), not to this link.
  document.addEventListener('keydown', (event) => {
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]')) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      location.href = '/chat/';
    }
  });

  const mount = () => document.body.append(link);
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
})();
