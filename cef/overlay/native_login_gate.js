/* KS native login gate. Runs on Kirka's own page without touching form data.
   During sign-in, KS adds no buttons, key handlers, overlays or WebGL hooks.
   Kirka itself creates its account UI and stores its own session locally.
   A successful session starts a fresh normal game page with the full KS UI. */
(() => {
  'use strict';
  if (location.protocol !== 'https:' ||
      !['kirka.io', 'www.kirka.io'].includes(location.hostname) ||
      window.__KS_NATIVE_LOGIN_GATE__) return;
  window.__KS_NATIVE_LOGIN_GATE__ = true;
  const sessionReady = () => {
    try { return !!localStorage.getItem('token'); }
    catch (_) { return false; }
  };
  if (sessionReady()) return;
  let reloadRequested = false;
  const poll = setInterval(() => {
    if (!sessionReady() || reloadRequested) return;
    reloadRequested = true;
    clearInterval(poll);
    // After Kirka completes login, reload once so document-start game hooks
    // can attach normally. No password or token ever crosses native IPC.
    location.reload();
  }, 500);
  window.addEventListener('pagehide', () => clearInterval(poll), {once:true});
})();
