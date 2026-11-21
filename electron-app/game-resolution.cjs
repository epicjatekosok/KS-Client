'use strict';

// Let the game rebuild its own render targets on viewport resize, including
// intermediate effects buffers. Keep the entire viewport fitted to the window.
function createGameResolution(win, getDisplayScale, isGame) {
  const contents = win.webContents;
  const heights = new Set(['720', '1080', '1440', '2160']);
  let preset = 'native';
  let timer, generation = 0, key = '', active = false;

  function reset() {
    clearTimeout(timer);
    generation++;
    key = '';
    if (active && !contents.isDestroyed()) contents.disableDeviceEmulation();
    active = false;
  }

  function apply() {
    if (win.isDestroyed() || !isGame() || preset === 'native') return reset();
    const [width, height] = win.getContentSize();
    if (width < 1 || height < 1 || win.isMinimized()) return;
    const displayScale = getDisplayScale();
    const next = [width,height,displayScale,preset].join('/');
    if (key === next) return;
    key = next;
    clearTimeout(timer);
    const current = ++generation;
    const target = Number(preset);
    function fit(viewHeight, attempt) {
      if (current !== generation || win.isDestroyed() || !isGame()) return;
      const viewWidth = Math.round(viewHeight * width / height);
      if (viewWidth < 1 || viewWidth > 8192 || viewHeight > 8192) return;
      const scale = height / viewHeight;
      contents.enableDeviceEmulation({screenPosition:'desktop',deviceScaleFactor:1,
        viewSize:{width:viewWidth,height:viewHeight},scale});
      active = true;
      contents.executeJavaScript('window.__KS_OUTPUT_PIXEL_RATIO__=' + (scale * displayScale)).catch(()=>{});
      // Games may choose their own internal render density. Calibrate against
      // the actual primary WebGL output after the game's resize handler settles.
      async function measure(retries) {
        if (current !== generation || win.isDestroyed() || !isGame()) return;
        try {
          const sample = await contents.executeJavaScript(
            '({view:innerHeight,buffer:window.__KS_RENDER_OBSERVER__?.getGameBufferHeight?.()||0})');
          if (current !== generation) return;
          if (sample.view !== viewHeight || sample.buffer < 64) {
            if (retries) timer = setTimeout(()=>measure(retries-1),600);
          } else if (attempt < 2 && Math.abs(sample.buffer-target)>1) {
            const corrected = Math.round(viewHeight * target / sample.buffer);
            if (corrected >= 240 && corrected !== viewHeight) fit(corrected, attempt+1);
          }
        } catch (_) { /* A navigation or window close invalidates this sample. */ }
      }
      timer = setTimeout(()=>measure(8),350);
    }
    fit(target,0);
  }

  function select(value) {
    if (value !== 'native' && !heights.has(value)) return;
    preset = value;
    if (isGame() && contents.getZoomFactor() !== 1) contents.setZoomFactor(1);
    apply();
    if (value === 'native' && isGame()) contents.executeJavaScript('delete window.__KS_OUTPUT_PIXEL_RATIO__').catch(()=>{});
  }

  return {select, apply, leave(){preset='native';reset();}};
}
module.exports = {createGameResolution};
