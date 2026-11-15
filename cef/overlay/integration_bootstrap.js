/* KS Client – single early Kirka WebGL context registry (Electron and CEF).
   This passive layer never creates a WebGL context, alters rendering, or consumes
   game input. Subscribers can attach to contexts created before they loaded. */
(() => {
  'use strict';
  if (location.protocol !== 'https:' || !['kirka.io', 'www.kirka.io'].includes(location.hostname)) return;
  if (window.__KS_RENDER_OBSERVER__) return;

  const proto = HTMLCanvasElement.prototype;
  const original = proto.getContext;
  const contexts = new WeakSet();
  const known = new Map();
  const subscribers = new Set();
  let selected = null;
  const seen = { webgl: 0, webgl2: 0, contextLost: 0, restored: 0, lastCanvas: '', notifications: 0, subscriberErrors: 0 };
  let installed = false;

  function publish(canvas, kind, gl, receiver = null) {
    if (!gl || canvas.id !== 'game') return;
    for (const subscriber of receiver ? [receiver] : subscribers) {
      try { subscriber(gl, canvas, kind); seen.notifications++; }
      catch (_) { seen.subscriberErrors++; }
    }
  }
  function track(canvas, kind, gl) {
    if (!gl || contexts.has(gl)) return;
    contexts.add(gl);
    known.set(gl, { canvas, kind });
    if (kind === 'webgl2') seen.webgl2++; else seen.webgl++;
    seen.lastCanvas = String(canvas.id || '(unnamed)').slice(0, 64);
    try {
      const attrs = gl.getContextAttributes?.();
      const requested = canvas.__ksLastWebGLAttrs ?? null;
      if (!selected || (canvas.width * canvas.height) >= (selected.canvas.width * selected.canvas.height)) {
        selected = { canvas, gl, kind, asked: requested?.antialias ?? null,
          reported: typeof attrs?.antialias === 'boolean' ? attrs.antialias : null };
      }
    } catch (_) { }
    publish(canvas, kind, gl);
    // Some game revisions assign the canvas ID after creating the context.
    if (canvas.id !== 'game') {
      try {
        const idObserver = new MutationObserver(() => {
          if (canvas.id === 'game') { idObserver.disconnect(); publish(canvas, kind, gl); }
        });
        idObserver.observe(canvas, { attributes: true, attributeFilter: ['id'] });
        canvas.addEventListener('webglcontextlost', () => idObserver.disconnect(), { once: true });
      } catch (_) { }
    }
  }
  function wrappedGetContext(kind, ...args) {
    // Invoke the game's original getContext exactly once, with its original
    // arguments and receiver. Never suppress errors from Chromium itself.
    const gl = Reflect.apply(original, this, [kind, ...args]);
    if (kind === 'webgl' || kind === 'experimental-webgl' || kind === 'webgl2') {
      try {
        if (!this.__ksLastWebGLAttrs && args.length && args[0] && typeof args[0] === 'object') {
          // Only keep a boolean snapshot, never retain game-owned option objects.
          this.__ksLastWebGLAttrs = { antialias: typeof args[0].antialias === 'boolean' ? args[0].antialias : null };
        }
        track(this, kind, gl);
      } catch (_) { seen.subscriberErrors++; }
    }
    return gl;
  }
  try { proto.getContext = wrappedGetContext; installed = proto.getContext === wrappedGetContext; }
  catch (_) { installed = false; }
  if (!installed) return;

  document.addEventListener('webglcontextlost', () => { seen.contextLost++; }, true);
  document.addEventListener('webglcontextrestored', () => { seen.restored++; }, true);
  window.__KS_RENDER_OBSERVER__ = Object.freeze({
    onContext: callback => {
      if (typeof callback !== 'function') return () => {};
      subscribers.add(callback);
      // Replay is crucial when native injection is later than game initialization;
      // replaying never calls getContext or creates additional GPU contexts.
      for (const [gl, info] of known) publish(info.canvas, info.kind, gl, callback);
      return () => subscribers.delete(callback);
    },
    getStats: () => selected ? {
      antialiasRequested: selected.asked, antialiasReported: selected.reported,
      canvasWidth: Number(selected.gl.drawingBufferWidth || selected.canvas.width || 0),
      canvasHeight: Number(selected.gl.drawingBufferHeight || selected.canvas.height || 0),
      contextType: selected.kind
    } : null,
    getStatus: () => ({ ...seen, installed: proto.getContext === wrappedGetContext,
      mode: 'passive', trackedContexts: known.size, subscribers: subscribers.size }),
    restore: () => {
      if (proto.getContext === wrappedGetContext) proto.getContext = original;
      subscribers.clear();
      known.clear();
    }
  });
  window.dispatchEvent(new Event('ks-render-observer-ready'));
})();