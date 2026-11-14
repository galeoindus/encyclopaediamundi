/* Runs before the stylesheet paints, as a classic (non-module) script.
 *
 * A module is deferred, so a theme set from one lands after the first paint:
 * the page flashes light, then turns dark — a visible jump, and a layout shift
 * every time. This reads the saved choice synchronously and writes the
 * attribute the CSS keys on, so the first paint is already the right one.
 */
(function () {
  try {
    var saved = localStorage.getItem('em:theme');
    var theme = saved ? JSON.parse(saved) : '';
    if (theme !== 'light' && theme !== 'dark') {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = theme;
  } catch (error) {
    document.documentElement.dataset.theme = 'light';
  }
})();
