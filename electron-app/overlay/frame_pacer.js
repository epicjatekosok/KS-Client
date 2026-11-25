/* Coalesce game requests on a native Chromium animation frame. A timer can
 * postpone requesting a frame, but never calls game code or invents timestamps. */
(() => {
  'use strict';
  if (location.protocol !== 'https:' || !['kirka.io', 'www.kirka.io'].includes(location.hostname)) return;
  if (window.__KS_FRAME_PACER__) return;
  const nativeRAF = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);
  const valid = n => Number.isFinite(n) && n >= 0 && n <= 2000;
  let target = 0;
  try {
    const value = JSON.parse(localStorage.getItem('ksclient.settings.alpha') || '{}').fpsLimit;
    if (valid(value)) target = value;
  } catch {}
  let activityLimit = 0, menuCap = 30, menuLimited = false;
  let timer = null, paint = null, deadline = null, delivering = false;
  let nativeWakes = 0, timerWakes = 0, nextId = 1, epoch = 0;
  let last = null, first = null, anchor = null, callbacks = 0, countSinceAnchor = 0;
  let completedFrames = 0, current = 0, frameMs = 0, sampling = false;
  let count = 0, cursor = 0, refresh = 0, synced = true;
  const intervals = new Float64Array(4096);
  const queue = new Map();
  function effectiveLimit() {
    const limit = Math.min(target || Infinity, activityLimit || Infinity, menuLimited && menuCap || Infinity);
    return Number.isFinite(limit) ? limit : 0;
  }
  function cancel() {
    if (paint !== null) nativeCancel(paint);
    if (timer !== null) clearTimeout(timer);
    paint = timer = null;
  }
  function clearSamples() {
    epoch++;
    first = last = anchor = null;
    callbacks = countSinceAnchor = count = cursor = current = frameMs = 0;
  }
  function reset() {
    cancel();
    deadline = null;
    clearSamples();
    schedule();
  }
  function schedule() {
    if (delivering || !queue.size || paint !== null || timer !== null) return;
    const cap = effectiveLimit();
    // Leave one display period to catch the intended repaint. For unlocked
    // Chromium the final wake still has to receive a real begin-frame.
    const lead = synced ? (refresh ? 1000 / refresh : 16.7) : 0.8;
    const sleep = cap && deadline !== null ? Math.floor(deadline - performance.now() - lead) : 0;
    if (sleep >= 2) {
      timer = setTimeout(() => {
        timer = null;
        timerWakes++;
        paint = nativeRAF(onPaint);
      }, sleep);
    } else paint = nativeRAF(onPaint);
  }
  function onPaint(ts) {
    paint = null;
    nativeWakes++;
    if (!queue.size) return;
    if (last !== null && ts - last > 1500) { clearSamples(); deadline = null; }
    const cap = effectiveLimit();
    if (cap) {
      const period = 1000 / cap;
      const tolerance = synced && refresh ? Math.min(period * 0.45, 450 / refresh) : 0.15;
      if (deadline !== null && ts + tolerance < deadline) { schedule(); return; }
      deadline ??= ts;
      deadline += Math.max(1, Math.floor((ts + tolerance - deadline) / period) + 1) * period;
    }
    if (last !== null) {
      frameMs = ts - last;
      callbacks++;
      if (sampling && frameMs > 0) {
        intervals[cursor] = frameMs;
        cursor = (cursor + 1) % intervals.length;
        count = Math.min(count + 1, intervals.length);
      }
    }
    if (anchor === null) anchor = ts;
    else countSinceAnchor++;
    if (ts - anchor >= 1000) {
      current = Math.round(countSinceAnchor * 1000 / (ts - anchor));
      countSinceAnchor = 0; anchor = ts;
    }
    first ??= ts;
    last = ts;
    completedFrames++;
    delivering = true;
    const end = nextId - 1;
    for (const [id, fn] of queue) {
      if (id > end) break;
      queue.delete(id);
      try { fn.call(window, ts); } catch (error) { setTimeout(() => { throw error; }, 0); }
    }
    delivering = false;
    if (!queue.size) deadline = null;
    schedule();
  }
  window.requestAnimationFrame = function(callback) {
    if (typeof callback !== 'function') throw new TypeError('Expected an animation callback');
    const id = nextId++;
    queue.set(id, callback);
    schedule();
    return id;
  };
  window.cancelAnimationFrame = function(id) {
    if (queue.delete(id) && !queue.size && !delivering) { cancel(); deadline = null; }
  };
  document.addEventListener('visibilitychange', reset);
  Object.defineProperty(window, '__KS_FRAME_PACER__', {value: Object.freeze({
    setLimit(n) { if (!valid(n)) return false; if (n !== target) { target = n; reset(); } return true; },
    setDisplaySync(value) { if (synced !== value) { synced = value; reset(); } },
    setRefreshRate(hz) { if (valid(hz) && hz !== refresh) { refresh = hz; reset(); } },
    setActivityLimit(n) { if (valid(n) && n !== activityLimit) { activityLimit = n; reset(); } },
    setMenuLimited(enabled, cap = 30) {
      if (valid(cap) && (menuLimited !== enabled || menuCap !== cap)) { menuLimited = enabled; menuCap = cap; reset(); }
    },
    setSampling(value) { if (sampling !== value) { sampling = value; count = cursor = 0; } },
    getIntervals: () => Array.from({length: count}, (_, i) => intervals[(cursor - count + i + intervals.length) % intervals.length]),
    getStats() {
      const recent = last !== null && performance.now() - last < 1500;
      return { target, effectiveLimit: effectiveLimit(), menuLimited, activityLimit, nativeWakes, timerWakes, epoch,
        completedFrames, requestCount: queue.size, averageCallbackFPS: recent && last - first >= 1000 ? Math.round(callbacks * 1000 / (last - first)) : 0,
        estimatedCallbackFPS: recent ? current : 0, estimatedCallbackFrameMs: recent ? frameMs : 0,
        note: 'Page rAF batch rate, measured at native Chromium animation callbacks' };
    },
    nativeRequestAnimationFrame: nativeRAF, nativeCancelAnimationFrame: nativeCancel
  })});
})();
