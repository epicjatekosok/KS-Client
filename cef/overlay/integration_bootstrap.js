/* KS Client – passive Kirka WebGL context discovery (shared Electron / CEF).
   Installs once, changes neither draw calls nor shaders/textures.
   Failure cannot prevent the game from obtaining its original context. */
(() => {
  'use strict';
  if (location.protocol !== 'https:' || !['kirka.io', 'www.kirka.io'].includes(location.hostname)) return;
  if (window.__KS_RENDER_OBSERVER__) return;
  const proto = HTMLCanvasElement.prototype;
  const original = proto.getContext;
  const contexts = new WeakSet();
  const seen = { webgl: 0, webgl2: 0, contextLost: 0, restored: 0, lastCanvas: '' };
  function track(canvas, kind, context) {
    if (!context || contexts.has(context)) return;
    contexts.add(context);
    if (kind === 'webgl2') seen.webgl2++;
    else seen.webgl++;
    seen.lastCanvas = String(canvas.id || '(unnamed)').slice(0, 64);
  }
  function wrappedGetContext(kind, ...args) {
    const context = Reflect.apply(original, this, [kind, ...args]);
    if (kind === 'webgl' || kind === 'experimental-webgl' || kind === 'webgl2') {
      try { track(this, kind, context); } catch (_) {}
    }
    return context;
  }
  // A minimal wrapper is installed early where supported; never force
  // creation of a context or replace game WebGL functions.
  try { proto.getContext = wrappedGetContext; } catch (_) { return; }
  document.addEventListener('webglcontextlost', () => { seen.contextLost++; }, true);
  document.addEventListener('webglcontextrestored', () => { seen.restored++; }, true);
  window.__KS_RENDER_OBSERVER__ = Object.freeze({
    getStatus: () => ({ ...seen, installed: proto.getContext === wrappedGetContext,
      mode: 'passive', note: '3D texture replacement is not enabled' }),
    restore: () => { if (proto.getContext === wrappedGetContext) proto.getContext = original; }
  });
})();