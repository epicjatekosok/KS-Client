/* KS Client ALPHA: best-effort game requestAnimationFrame pacing.
 * Electron injects this at document start when supported; CEF injects after navigation. It does not control GPU
 * vsync, all game engine render loops, worker rendering, or network latency.
 */
(() => {
  'use strict';
  if (location.protocol !== 'https:' || !['kirka.io', 'www.kirka.io'].includes(location.hostname)) return;
  if (window.__KS_FRAME_PACER__) return;
  const nativeRAF = window.requestAnimationFrame.bind(window);
  const nativeCancelRAF = window.cancelAnimationFrame.bind(window);
  const allowed = new Set([0, 60, 120, 144, 165, 180, 200, 240, 300, 360]);
  const settingsKey = 'ksclient.settings.alpha';
  let target = 0;
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) || '{}');
    const n = Number(saved.fpsLimit);
    if (allowed.has(n)) target = n;
  } catch (_) {}
  let nextId = 1;
  const queued = new Map();
  let lastFrameTimestamp = -1;
  let permittedThisFrame = false;
  let nextDueTimestamp = -Infinity;
  let completedFrames = 0;
  let completedAt = 0;
  let lastCompletedAt = 0;
  let callbackFPS = 0;
  let callbackFrameMs = 0;
  let lastSampleAt = 0;
  let periodCount = 0;

  function updateFrameMetrics(ts) {
    if (completedAt === ts) return;
    if (lastCompletedAt > 0) callbackFrameMs = ts - lastCompletedAt;
    lastCompletedAt = ts;
    completedAt = ts;
    completedFrames++;
    periodCount++;
    if (lastSampleAt === 0) lastSampleAt = ts;
    if (ts - lastSampleAt >= 1000) {
      callbackFPS = Math.round(periodCount * 1000 / (ts - lastSampleAt));
      periodCount = 0;
      lastSampleAt = ts;
    }
  }

  function shouldRun(ts) {
    if (lastFrameTimestamp !== ts) {
      lastFrameTimestamp = ts;
      if (!target) permittedThisFrame = true;
      else {
        const period = 1000 / target;
        // Accumulate fractional timing so 144 on 180 Hz is ~144, not 90.
        if (!Number.isFinite(nextDueTimestamp) || ts - nextDueTimestamp > period * 3) {
          nextDueTimestamp = ts;
        }
        permittedThisFrame = ts + 0.45 >= nextDueTimestamp;
        if (permittedThisFrame) nextDueTimestamp += period;
      }
    }
    return permittedThisFrame;
  }

  function frameRequest(callback) {
    if (typeof callback !== 'function') throw new TypeError('callback must be a function');
    const id = nextId++;
    const entry = { callback, nativeId: 0 };
    queued.set(id, entry);
    const deliver = ts => {
      if (!queued.has(id)) return;
      if (shouldRun(ts)) {
        queued.delete(id);
        updateFrameMetrics(ts);
        entry.callback(ts);
      } else {
        entry.nativeId = nativeRAF(deliver);
      }
    };
    entry.nativeId = nativeRAF(deliver);
    return id;
  }
  function frameCancel(id) {
    const entry = queued.get(id);
    if (entry) { nativeCancelRAF(entry.nativeId); queued.delete(id); }
  }
  Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, writable: true, value: frameRequest });
  Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, writable: true, value: frameCancel });
  Object.defineProperty(window, '__KS_FRAME_PACER__', { configurable: false, value: Object.freeze({
    setLimit(n) {
      n = Number(n);
      if (!allowed.has(n)) return false;
      target = n;
      nextDueTimestamp = -Infinity;
      return true;
    },
    getStats() {
      return {
        target,
        estimatedCallbackFPS: callbackFPS,
        estimatedCallbackFrameMs: callbackFrameMs,
        completedFrames,
        requestCount: queued.size,
        note: 'Best-effort requestAnimationFrame callback rate; not verified GPU FPS'
      };
    },
    nativeRequestAnimationFrame: nativeRAF
  }) });

  // WebGL observation now lives in integration_bootstrap.js, the single
  // shared early game context registry. No competing getContext wrappers.

})();
