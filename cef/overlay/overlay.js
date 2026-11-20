/* KS Client Beta 1.0.15 – Electron/CEF unified game overlay. */
(() => {
  'use strict';
  if (window.__KS_CLIENT__) return;
  // Single build label for all current-version UI and settings exports.
  // Historical changelog items deliberately retain their original version.
  const CLIENT_VERSION='1.0.15';
  const CLIENT_LABEL='Beta '+CLIENT_VERSION;

  const allowedHosts = new Set([
    'kirka.io',
    'www.kirka.io',
    'kirka-stats.lovable.app',
    'kirka-clan-tracker-notpro9.lovable.app'
  ]);
  if (!allowedHosts.has(location.hostname) || location.protocol !== 'https:') return;

  const isGamePage = location.hostname === 'kirka.io' || location.hostname === 'www.kirka.io';
  const KEY = 'ksclient.settings.alpha';
  const defaults = Object.freeze({
    crosshairEnabled: false,
    shape: 'cross',
    color: '#f4a61c',
    size: 14,
    gap: 6,
    thickness: 2,
    opacity: 100,
    centerDot: false,
    previewBackground: 'default',
    centerDotShape: 'circle', centerDotSize: 3, centerDotColor: '#ffffff',
    centerDotOutline: false, centerDotOutlineColor: '#000000', centerDotOutlineThickness: 1,
    outlineEnabled: false, outlineColor: '#000000', outlineThickness: 2,
    shadowEnabled: false, shadowColor: '#000000', shadowBlur: 4, shadowOffsetX: 1, shadowOffsetY: 2,
    showFPS: false,
    fpsSource: 'browser',
    showHUD: true,
    showBadge: true,
    fpsPosition: 'top-left',
    uiScale: 100,
    reduceMotion: false,
    uiAnimations: true,
    customCSSEnabled: false,
    customCSS: '',
    menuResolution: 'native',
    gameResolution: 'native',
    fpsLimit: 0,
    smoothPreset: 'Native',
    showGraph: true,
    limitSettingsFPS: true,
    limitLobbyFPS: false,
    limitUnfocusedFPS: false,
    eyeEnabled: false, eyePreset: 'Normal', eyeBrightness: 100, eyeContrast: 100, eyeSaturation: 100, eyeWarmth: 0, eyeSoftness: 0,
    breakReminderMinutes: 0,
    lowLatency: false,
    performancePreset: 'Balanced',
    themePreset: 'Amber', customAccent: '#f0aa35', customBackground: '#0d1015', customPanel: '#171c23', customText: '#edf0f6', customMuted: '#97a3b2', gameThemeEnabled: false,
    themeSurface:'Solid',themeGlow:0,themeRadius:12,themePattern:'None',themeDensity:'Comfortable',
    fontFamily: 'Segoe UI', fontSize: 110, gameFontEnabled: false,
    menuImageEnabled: true, menuSelector: '', uiImageSelector: '', menuSoundEnabled: false,
    minimalHUD: false, minimalSelectors: '', customCrosshairPresets: [],
    language: 'en',
    gameKeystrokes: false, gameStats: true,
    gameAutoMouseCapture: true, gameQuickJoin: true,
    gameKeysPosition:'bottom-left', gameKeysScale:100,
    autoCheckUpdates: true, autoDownloadUpdates: true, updateChannel: 'beta'
  });

  function stored() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; } }
  const previousSettings = stored();
  let state = { ...defaults, ...previousSettings };
  // One-time Beta 1.0.0 migration: undo the previous forced 150% default.
  // Non-150% choices remain unchanged. Users can select 150% again afterwards.
  try {
    if (localStorage.getItem('ksclient.menu-scale-alpha109') !== '1') {
      if (Number(state.uiScale) === 150) state.uiScale = 100;
      localStorage.setItem('ksclient.menu-scale-alpha109','1');
      localStorage.setItem(KEY,JSON.stringify(state));
    }
  } catch (_) { /* Use in-memory defaults if storage is blocked. */ }
  // Earlier builds defaulted to 1080p. Upgrade only those legacy defaults to
  // monitor matching once; explicit 720p/1440p/4K selections are preserved.
  // Users can reselect fixed 1080p afterwards if they prefer it.
  try {
    if (localStorage.getItem('ksclient.resolution-auto-alpha105') !== '1') {
      if (state.menuResolution === '1080') state.menuResolution = 'native';
      if (state.gameResolution === '1080') state.gameResolution = 'native';
      localStorage.setItem('ksclient.resolution-auto-alpha105', '1');
      localStorage.setItem(KEY, JSON.stringify(state));
    }
  } catch (_) { /* Storage may be disabled: use in-memory defaults. */ }
  // Clear settings belonging to removed features from existing profiles.
  const removedSettings = ['discordEnabled','discordAppId','hitmarkerEnabled','hitmarkerShape','hitmarkerColor','hitmarkerSize','hitmarkerDuration','updateFeed','autoCheck','gameHitmarker','gameHitmarkerColor','gameHitmarkerSize','gameHitmarkerImage','gameKillfeedColors'];
  if (removedSettings.some(k => Object.prototype.hasOwnProperty.call(state,k))) {
    for (const key of removedSettings) delete state[key];
    try { localStorage.setItem(KEY,JSON.stringify(state)); } catch (_) {}
  }
  let selectedTab = 'Performance';
  let open = false;
  let fps = 0, frameMs = 0, count = 0, lastFrame = 0, lastSample = 0;
  let activeEngine = window.__KS_RUNTIME__?.engine ||
    (window.CefSharp?.PostMessage ? 'CEF (CefSharp)' : 'Detecting native engine…');
  let engineSwitchStatus = '';
  let engineSwitchAcknowledged=false;
  let crashStatus = 'Checking local logs...';
  let sharingStatus = 'Settings stay on your device until you export them.';
  let diagnostics = null;
  let gpuInfo = { status: 'Not checked', renderer: '—', note: 'Press Check GPU to test WebGL' };
  const fpsHistory = [];
  const frameHistory = [];
  let displayedGameFPS = 0;
  let displayedFrameMs = 0;
  let measuredLabel = 'Waiting for page animation callbacks';
  // Named presets are complete visual palettes; they never touch gameplay settings.
  const themePalettes = Object.freeze({
    Amber:{accent:'#f0aa35',bg:'#0d1015',panel:'#171c23',text:'#edf0f6',muted:'#97a3b2'},
    Ember:{accent:'#ef7958',bg:'#151012',panel:'#251a20',text:'#fff0e9',muted:'#bea5a1'},
    Ice:{accent:'#74cce8',bg:'#0b1620',panel:'#172a37',text:'#e9f8ff',muted:'#9cb9c7'},
    Forest:{accent:'#78c99c',bg:'#0e1815',panel:'#1a2b23',text:'#e9f8ee',muted:'#a3c0b0'},
    Violet:{accent:'#b7a0f2',bg:'#151221',panel:'#241d37',text:'#f2edff',muted:'#b4aac9'},
    Midnight:{accent:'#738fff',bg:'#0a1021',panel:'#171f39',text:'#e9eeff',muted:'#a5b5d5'},
    Ocean:{accent:'#39d0ce',bg:'#09191c',panel:'#142f33',text:'#e4ffff',muted:'#91bec2'},
    Crimson:{accent:'#f36b8b',bg:'#1a1017',panel:'#321b2a',text:'#fff0f4',muted:'#cea4b2'},
    Cyber:{accent:'#b9ff4b',bg:'#10150b',panel:'#222e18',text:'#f4ffe5',muted:'#b6cb9b'},
    Rose:{accent:'#ff9fc7',bg:'#1b1420',panel:'#2e2036',text:'#fff0f8',muted:'#ccb1c7'},
    Sand:{accent:'#efbf81',bg:'#1b1713',panel:'#2c251d',text:'#fff2db',muted:'#c6b29c'},
    Monochrome:{accent:'#d9e2ed',bg:'#101214',panel:'#24282e',text:'#f5f7fa',muted:'#a9b4be'},
    Copper:{accent:'#ef9d65',bg:'#17130e',panel:'#2b211a',text:'#f9f0e7',muted:'#c5aa96'}
  });
  const themeColors = Object.freeze({...Object.fromEntries(Object.entries(themePalettes).map(([k,v])=>[k,v.accent])),Custom:null});
  const assetKeys = ['menuBackground', 'uiImage', 'menuSound', 'localFont'];
  const assets = Object.create(null);
  const assetURLs = Object.create(null);
  let resourceStatus = 'Assets are stored locally in this browser profile.';
  const crosshairFields = ['shape','color','size','gap','thickness','opacity','centerDot','centerDotShape','centerDotSize','centerDotColor','centerDotOutline','centerDotOutlineColor','centerDotOutlineThickness','outlineEnabled','outlineColor','outlineThickness','shadowEnabled','shadowColor','shadowBlur','shadowOffsetX','shadowOffsetY'];
  const crosshairShapes = ['cross','plus','x','t','chevron','circle','square','diamond','triangle','bullseye','four-dots','dot'];

  const resetSections = Object.freeze({
    General: [],
    Display: ['menuResolution','gameResolution','uiScale','showFPS','fpsSource','fpsPosition'],
    Performance: ['fpsLimit','smoothPreset','limitSettingsFPS','limitLobbyFPS','limitUnfocusedFPS','showGraph','lowLatency','performancePreset','uiAnimations'],
    'Frame Stability': [],
    'Game Integration':['gameKeystrokes','gameStats','gameKeysPosition','gameKeysScale','gameAutoMouseCapture','gameQuickJoin'],
    'Eye Comfort': ['eyeEnabled','eyePreset','eyeBrightness','eyeContrast','eyeSaturation','eyeWarmth','eyeSoftness','breakReminderMinutes'],
    Crosshair: [...crosshairFields,'previewBackground','customCrosshairPresets'],
    Appearance: ['themePreset','customAccent','customBackground','customPanel','customText','customMuted','themeSurface','themeGlow','themeRadius','themePattern','themeDensity','fontFamily','fontSize','uiAnimations'],
    Interface: ['showHUD','showBadge','reduceMotion','minimalHUD'],
    Resources: ['menuImageEnabled','menuSelector','uiImageSelector','menuSoundEnabled'],
    'CSS Editor': ['gameThemeEnabled','gameFontEnabled','menuSelector','uiImageSelector','minimalSelectors','customCSSEnabled','customCSS'],
    Sharing: ['language'],
    Diagnostics: []
  });
  function resetCurrentSection() {
    const keys = resetSections[selectedTab] || [];
    if (!keys.length) return;
    if (!confirm(L('Reset only the settings in this section? Other sections will stay unchanged.'))) return;
    for (const key of keys) state[key] = Array.isArray(defaults[key]) ? [] : defaults[key];
    if (keys.includes('fpsLimit')) window.__KS_FRAME_PACER__?.setLimit(state.fpsLimit);
    if (keys.includes('gameResolution')) notify('game-resolution',{preset:state.gameResolution});
    if (keys.includes('menuResolution')) notify('menu-resolution',{preset:state.menuResolution});
    save(); renderTab(); apply();
  }
  function sectionResetMarkup() {
    if (selectedTab === 'General') return ''; // General keeps the master Reset all control.
    if (!(resetSections[selectedTab] || []).length) return ''; // Informational-only sections have nothing to reset.
    return `<div class="ks-section-reset"><span>${L('This resets only the open settings section.')}</span><button class="ks-btn danger" data-action="reset-section">${L('Reset section settings')}</button></div>`;
  }
  const assetMeta = Object.create(null);
  let lastSentUpdatePreferences='';
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} syncUpdatePreferences(); }
  function syncUpdatePreferences() {
    const prefs={automatic:state.autoCheckUpdates===true,autoDownload:state.autoDownloadUpdates===true,
      channel:['alpha','beta','stable'].includes(state.updateChannel)?state.updateChannel:'beta'};
    const fingerprint=JSON.stringify(prefs);
    if(fingerprint!==lastSentUpdatePreferences && notify('update-config',prefs)) lastSentUpdatePreferences=fingerprint;
  }
  let latestWorkshopRequest=null,workshopTimeout=null;
  function workshopNotify(type,payload={}){
    if(!['resource-save','resource-scan'].includes(type))return notify(type,payload);
    const requestId=Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join('');
    latestWorkshopRequest=requestId;
    clearTimeout(workshopTimeout);
    workshopTimeout=setTimeout(()=>{
      if(latestWorkshopRequest===requestId){
        latestWorkshopRequest=null;
        window.__KS_CLIENT__?.setWorkshopStatus('The native resource swapper did not respond. Retry the operation.');
      }
    },6000);
    return notify(type,{...payload,requestId});
  }
  function notify(type, payload = {}) {
    try {
      const data={ type, ...payload };
      if(window.__KS_NATIVE__?.post){window.__KS_NATIVE__.post(data);return true;}
      if(window.CefSharp?.PostMessage){window.CefSharp.PostMessage(JSON.stringify(data));return true;}
    } catch (_) {}
    return false;
  }

  // CEF's postMessage bridge can be detached while the Kirka SPA changes
  // frames. These two fixed, trusted client-owned actions therefore navigate
  // to reserved Kirka URLs that the native CEF request handler ALWAYS
  // intercepts before network access. Electron keeps its existing IPC path.
  function openTrustedExternal(kind) {
    if(isGamePage && !window.__KS_NATIVE__?.post && (window.CefSharp?.PostMessage || (typeof activeEngine==='string' && activeEngine.toLowerCase().includes('cef')))) {
      const routes={
        discord:'https://kirka.io/__ksclient_internal_open_discord__',
        releases:'https://kirka.io/__ksclient_internal_open_releases__'
      };
      if(Object.prototype.hasOwnProperty.call(routes,kind)) {
        location.assign(routes[kind]);
        return true;
      }
    }
    return notify(kind==='discord'?'discord-community':'update-open-release');
  }

  // Beta 1.0.6: voluntary transfer of an existing Kirka session.
  // Never send the bearer token to native IPC, logs, our settings or any server.
  function importKirkaSession() {
    const source=arguments[0]||{};
    const input=source.input||$('ks-account-session-token');
    const consent=source.consent||$('ks-account-session-consent');
    const status=source.status||$('ks-account-session-status');
    if(!input||!consent||!status)return false;
    const token=String(input.value||'').trim();
    input.value='';
    const report=message=>{status.textContent=L(message);};
    if(!isGamePage || location.protocol!=='https:' ||
       !['kirka.io','www.kirka.io'].includes(location.hostname)){
      report('Only the Kirka.io game page can import its own session.');
      return false;
    }
    if(!consent.checked){report('Confirm the security warning first.');return false;}
    if(token.length<12 || token.length>8192 || /\s/.test(token) ||
       /^(?:Bearer\s|https?:\/\/)/i.test(token)){
      report('Invalid session format. Nothing was changed.');
      return false;
    }
    try {
      const previous=localStorage.getItem('token');
      if(previous && !confirm(L('Replace the current Kirka.io session on this engine?'))){
        report('Cancelled. Current session preserved.');
        return false;
      }
      localStorage.setItem('token',token);
      if(localStorage.getItem('token')!==token)throw new Error('Local storage rejected the session');
      report('Session stored locally. Reloading so Kirka can validate it.');
      location.reload();
      return true;
    }catch(_){
      report('Local import failed. No credentials were transmitted.');
      return false;
    }
  }

  const host = document.createElement('div');
  host.id = 'ks-client-root';
  host.style.cssText = 'all:initial!important;position:fixed!important;top:0!important;left:0!important;width:0!important;height:0!important;z-index:2147483647!important;pointer-events:none!important;overflow:visible!important;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
  <style>
    :host { all: initial; width:0!important; height:0!important; pointer-events:none!important; }
    *, *::before, *::after { box-sizing: border-box; }
    button, input, select, textarea { font: inherit; }
    #ks-screen {
      position: fixed; inset: 0; pointer-events: none;
      color: var(--ks-text,#f5f1e7); font: 13px/1.5 'Segoe UI', Arial, sans-serif;
      --ks-bg:#0d1015; --ks-panel:#171c23; --ks-text:#edf0f6; --ks-muted:#97a3b2; --ks-soft:#0f1318;
      text-rendering: geometricPrecision; -webkit-font-smoothing: antialiased;
    }
    #ks-fps {
      position: absolute; top: 68px; left: 18px; display: none;
      background: rgba(0,0,0,.9); color: var(--ks-accent, #f0aa35); border: 1px solid rgba(244,166,28,.32);
      border-radius: 10px; padding: 8px 12px; font: 700 13px 'Consolas', monospace;
      letter-spacing: .35px; box-shadow: 0 10px 28px rgba(0,0,0,.45);
    }
    #ks-badge {
      position: absolute; bottom: 18px; left: 20px; display: none;
      border: 1px solid rgba(244,166,28,.28); border-radius: 10px;
      background: rgba(0,0,0,.9); color: var(--ks-accent, #f0aa35);
      font: 800 10px 'Segoe UI', sans-serif; letter-spacing: 2px; padding: 7px 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,.35);
    }
    #ks-crosshair {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      display: none; line-height: 0; filter: drop-shadow(0 1px 2px rgba(0,0,0,.75));
    }
    #ks-quick {
      position: absolute; top: 16px; left: 18px; display: flex; gap: 10px; pointer-events: auto;
    }
    .ks-quick-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      min-height: 38px; padding: 0 14px; cursor: pointer;
      background: rgba(0,0,0,.86); color: var(--ks-accent, #f0aa35);
      border: 1px solid rgba(244,166,28,.46); border-radius: 8px;
      font-weight: 700; box-shadow: 0 10px 26px rgba(0,0,0,.35);
      transition: background .12s ease, color .12s ease, border-color .12s ease, transform .12s ease;
    }
    .ks-quick-btn:hover { background: var(--ks-accent, #f0aa35); color: #090909; border-color: #f6ba49; transform: translateY(-1px); }
    #ks-gear { width: 38px; min-width: 38px; height: 38px; min-height: 38px; padding: 0; }
    .ks-gear-icon { font-size: 20px; line-height: 1; }
    #ks-dimmer {
      display: none; pointer-events: auto; position: absolute; inset: 0;
      background: rgba(0,0,0,.70); backdrop-filter: none;
    }
    #ks-dimmer.visible { display: flex; align-items: center; justify-content: center; }
    #ks-panel {
      width: min(980px, calc(100vw - 46px)); max-height: min(820px, calc(100vh - 46px));
      display: flex; flex-direction: column; overflow: hidden;
      border: 1px solid rgba(255,255,255,.08); border-radius: 14px;
      background: var(--ks-bg,#0d1015);
      box-shadow: 0 28px 100px rgba(0,0,0,.66), 0 0 0 1px rgba(244,166,28,.08) inset;
      color: var(--ks-text,#ece6d8);
      zoom: var(--ks-ui-scale, 1);
    }
    #ks-top {
      display: flex; justify-content: space-between; align-items: center; gap: 18px;
      padding: 18px 22px 16px; background: var(--ks-soft,#0f1318);
      border-bottom: 1px solid rgba(255,255,255,.07);
    }
    #ks-brand { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
    #ks-brand-main { font-size: 23px; font-weight: 900; letter-spacing: 1px; color: var(--ks-accent, #f0aa35); }
    #ks-brand-sub { font-size: 11px; color: var(--ks-muted,#e7d7b3); letter-spacing: 1.6px; text-transform: uppercase; }
    .ks-stack { display: flex; align-items: center; gap: 9px; }
    .ks-pill {
      display: inline-flex; align-items: center; gap: 7px; min-height: 30px;
      background: rgba(11,11,11,.92); color: var(--ks-accent, #f0aa35); border: 1px solid rgba(244,166,28,.34);
      border-radius: 7px; padding: 0 11px; font-size: 11px; font-weight: 800; letter-spacing: .55px;
    }
    .ks-alpha {
      display: inline-flex; align-items: center; justify-content: center;
      min-height: 24px; padding: 0 8px; border-radius: 999px;
      background: var(--ks-accent, #f0aa35); color: #090909; border: 1px solid var(--ks-accent, #f0aa35);
      font-size: 10px; font-weight: 900; letter-spacing: .8px;
    }
    #ks-close {
      min-width: 36px; min-height: 36px; border-radius: 9px; cursor: pointer;
      background: rgba(0,0,0,.88); color: var(--ks-accent, #f0aa35); border: 1px solid rgba(244,166,28,.34);
    }
    #ks-close:hover { background: var(--ks-accent, #f0aa35); color: #090909; }
    #ks-main { display:grid; grid-template-columns:190px minmax(0,1fr); min-height:0; overflow:hidden; }
    #ks-nav {
      display: flex; flex-direction:column; gap:5px; padding:18px 12px;
      overflow:auto; background:var(--ks-soft,#101418); border-right:1px solid rgba(255,255,255,.07);
    }
    .ks-tab {
      background:transparent; border:1px solid transparent;
      border-radius:8px; padding:11px 13px; color:var(--ks-muted,#b6b5ae); text-align:left;
      cursor: pointer; white-space: nowrap; font-size: 12px; font-weight: 700;
    }
    .ks-tab:hover { color:#fff; background:#1a2028; border-color:#2f3640; }
    .ks-tab.active {background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));color:var(--ks-accent,#f0aa35);border-color:rgba(240,170,53,.35);box-shadow:inset 3px 0 0 var(--ks-accent,#f0aa35); }
    #ks-body { padding: 23px 27px; overflow: auto; min-height: 290px; max-height: min(510px, calc(100vh - 220px)); background: var(--ks-bg,#0d1015); scrollbar-width: thin; scrollbar-color: var(--ks-accent,#f4a61c) var(--ks-soft,#101418); }
    .ks-title { font-size: 20px; font-weight: 900; margin: 0 0 5px; color: var(--ks-accent, #f0aa35); letter-spacing: .3px; }
    .ks-sub { color: var(--ks-muted,#aaa9a2); margin: 0 0 18px; font-size: 12px; }
    .ks-grid { display: grid; grid-template-columns: 1.25fr 1fr; gap: 20px; }
    .ks-card {
      background: var(--ks-panel,#171c23); border: 1px solid rgba(255,255,255,.07);
      border-radius: 10px; padding: 0 14px;
    }
    .ks-preview {
      display: grid; place-items: center; min-height: 210px; border-radius: 10px;
      background: rgba(255,255,255,.02);
      border: 1px solid rgba(255,255,255,.06);
    }
    #ks-preview-svg { width: 130px; height: 130px; shape-rendering: geometricPrecision; }
    .ks-row {
      display: flex; justify-content: space-between; gap: 14px; align-items: center;
      padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,.08);
    }
    .ks-row:last-child { border-bottom: 0; }
    .ks-label { font-weight: 800; font-size: 13px; color: var(--ks-text,#f0eee9); }
    .ks-desc { color: var(--ks-muted,#97a3b2); font-size: 11px; margin-top: 3px; line-height: 1.42; }
    .ks-input {
      background: var(--ks-soft,#0f1318); border: 1px solid rgba(255,255,255,.08); color: var(--ks-text,#edf0f6);
      padding: 8px 11px; border-radius: 8px; outline: none; max-width: 100%;
    }
    .ks-input:focus { border-color: var(--ks-accent, #f0aa35); box-shadow: 0 0 0 2px rgba(244,166,28,.12); }
    .ks-field { display: flex; flex-direction: column; gap: 6px; margin: 8px 0 13px; }
    textarea.ks-input { width: 100%; min-height: 95px; resize: vertical; font: 12px/1.5 Consolas, monospace; }
    select.ks-input {
      min-width: 190px; appearance: none; -webkit-appearance: none; -moz-appearance: none;
      padding-right: 38px; cursor: pointer;
      background-color: #0d0d0d;
      background-image: linear-gradient(45deg, transparent 50%, #f4a61c 50%), linear-gradient(135deg, #f4a61c 50%, transparent 50%);
      background-position: calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px);
      background-size: 6px 6px, 6px 6px; background-repeat: no-repeat;
    }
    select.ks-input:hover { border-color:#f4a61c; background-color:#111111; }
    select.ks-input:focus { border-color:#f4a61c; box-shadow: 0 0 0 2px rgba(244,166,28,.12); }
    select.ks-input option { background:#0c0c0c; color:#f3ead6; }

    input[type='range'] { accent-color: var(--ks-accent, #f0aa35); width: 170px; cursor: pointer; }
    input[type='checkbox'] { accent-color: var(--ks-accent, #f0aa35); width: 18px; height: 18px; cursor: pointer; }
    input[type='color'] { width: 44px; height: 32px; border-radius: 7px; border: 1px solid rgba(244,166,28,.34); background: rgba(4,4,4,.96); padding: 2px; cursor: pointer; }
    .ks-val { font: 700 12px Consolas, monospace; color: var(--ks-accent, #f0aa35); min-width: 46px; text-align: right; }
    .ks-btn {
      background: var(--ks-panel,#181818); color: var(--ks-accent, #f0aa35); border: 1px solid rgba(255,255,255,.15);
      border-radius: 8px; padding: 9px 14px; font-weight: 800; cursor: pointer;
    }
    .ks-btn:hover { background: var(--ks-accent, #f0aa35); color: #090909; }
    .ks-btn.primary { background: var(--ks-accent, #f0aa35); color: #090909; border-color: var(--ks-accent, #f0aa35); }
    .ks-btn.primary:hover { background: var(--ks-accent, #f0aa35); }
    .ks-btn.danger { background: rgba(30,10,10,.9); color: #ffb0a8; border-color: rgba(255,125,106,.55); }
    .ks-btn.danger:hover { background: #5e211b; color: #fff2ee; }
    .ks-code { font: 12px Consolas, monospace; color: var(--ks-accent,#f5d185); word-break: break-all; }
    .ks-status { font-size: 11px; color: var(--ks-muted,#f7d48b); margin-top: 10px; min-height: 18px; word-break: break-word; }
    .ks-hint {
      font-size: 11px; color: var(--ks-muted,#d9c8a5); background: var(--ks-panel,#151515);
      border: 1px solid rgba(244,166,28,.2); border-radius: 9px; padding: 11px 13px; margin: 14px 0 0;
    }
    #ks-foot {
      display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
      padding: 12px 22px; background: var(--ks-soft,#0f1318); border-top: 1px solid rgba(244,166,28,.2);
      color: var(--ks-muted,#b8ab8d); font-size: 11px;
    }
    /* Performance monitor: same black / amber card layout as KirkaStats. */
    .ks-metric-grid { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0; }
    .ks-metric { border:1px solid rgba(244,166,28,.25);border-radius:9px;background:var(--ks-panel,#171c23);padding:11px; }
    .ks-metric-name { font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--ks-muted,#bbae91); }
    .ks-metric-value { font:800 23px 'Segoe UI',Arial,sans-serif;color:var(--ks-text,#f7e9cb);margin-top:4px; }
    .ks-stat-details { font-size:11px;color:var(--ks-muted,#c5b494);line-height:1.65;margin:12px 0; }
    #ks-graph-fps,#ks-graph-ms { display:block;width:100%;height:145px;background:#060606;border:1px solid rgba(244,166,28,.23);border-radius:8px;margin:10px 0 16px; }
    .ks-section-heading { margin-top:18px;font-size:12px;letter-spacing:1.4px;color:var(--ks-accent, #f0aa35);font-weight:800;text-transform:uppercase; }
    #ks-screen.no-motion *, #ks-screen.no-motion *::before, #ks-screen.no-motion *::after { transition:none!important;animation:none!important; }
    #ks-screen.no-motion #ks-dimmer { backdrop-filter:none!important; }
    @media (max-width:600px) {.ks-metric-grid{grid-template-columns:1fr 1fr;} }
    #ks-screen { --ks-accent:#f0aa35; --ks-font-scale:1.1; --ks-font-family:'Segoe UI', Arial, sans-serif; }
    #ks-panel { font-family:var(--ks-font-family); font-size:calc(13px * var(--ks-font-scale)); }
    #ks-panel button, #ks-panel input, #ks-panel textarea, #ks-panel select { font-family:inherit; }
    .ks-label {font-size:calc(13px * var(--ks-font-scale));}
    .ks-desc,.ks-sub,.ks-hint {font-size:calc(11px * var(--ks-font-scale));}
    .ks-tab {font-size:calc(12px * var(--ks-font-scale));}
    .ks-row {min-height:56px;}
    .ks-asset-summary {font:11px/1.5 var(--ks-font-family); color:var(--ks-muted,#bab8b2); padding:7px 0 0;}
    #ks-brand-icon {width:28px;height:28px;object-fit:contain;display:none;flex:0 0 auto;}
    .ks-note {padding:11px;background:var(--ks-panel,#171c23);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:var(--ks-muted,#c9c3b8);margin-top:10px;font-size:12px;line-height:1.5;}
    .ks-swatch {width:20px;height:20px;display:inline-block;border:1px solid #666;border-radius:50%;vertical-align:middle;margin-left:7px;}
    #ks-panel .ks-btn:disabled {opacity:.45;cursor:not-allowed;}
    @media (max-width: 800px) {
      .ks-grid { grid-template-columns: 1fr; }
      #ks-panel { width: min(920px,calc((100vw - 18px) / var(--ks-ui-scale,1))); }
      #ks-main {grid-template-columns:1fr;}
      #ks-nav {display:flex;flex-direction:row;flex-wrap:nowrap;border-right:0;border-bottom:1px solid #2a2418;padding:7px;max-height:58px;}
      .ks-tab {white-space:nowrap;}
      #ks-body { padding: 16px; }
      #ks-top { padding: 14px 16px; }
      #ks-quick { top: 12px; left: 12px; right: auto; }
    }

    /* Beta 1.0.0: native CSS zoom (layout-level, vector-sharp), responsive bounds. */
    #ks-panel {width:min(1180px,calc((100vw - 24px) / var(--ks-ui-scale,1)));max-height:min(920px,calc((100vh - 24px) / var(--ks-ui-scale,1)));border-radius:12px;}
    #ks-main {grid-template-columns:174px minmax(0,1fr);flex:1;}
    #ks-nav {overflow-y:auto; gap:5px; padding:17px 10px; background:var(--ks-soft,#101217); min-height:0;}
    .ks-sidebar-caption {font-size:9px;letter-spacing:2px;color:var(--ks-muted,#98a3ae);font-weight:800;padding:4px 12px 13px;opacity:.8;}
    .ks-sidebar-foot {margin-top:auto;padding:17px 9px 6px;font-size:10px;letter-spacing:.2px;color:var(--ks-muted,#98a3ae);border-top:1px solid rgba(255,255,255,.06);}
    .ks-tab {display:flex;align-items:center;gap:11px;min-height:42px;border-radius:7px;font-size:12px;font-weight:750;padding:9px 12px;letter-spacing:.1px;}
    .ks-tab-icon {width:19px;text-align:center;color:var(--ks-accent,#f0aa35);font-size:17px;opacity:.86;flex:0 0 19px;}
    .ks-tab.active {box-shadow:inset 3px 0 0 var(--ks-accent,#f0aa35);border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.07);color:var(--ks-text,#edf0f6);}
    #ks-body {min-height:0;max-height:none;padding:22px 25px 20px; scrollbar-width:thin; scrollbar-color:var(--ks-accent,#f0aa35) var(--ks-bg,#0d1015);}
    #ks-body .ks-title {font-size:19px;letter-spacing:.1px;}
    #ks-body .ks-sub {margin-bottom:14px;}
    .ks-subtabs {display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding-bottom:17px;margin-bottom:17px;border-bottom:1px solid rgba(255,255,255,.065);}
    .ks-subtab {background:transparent;color:var(--ks-muted,#9ba6b4);border:1px solid rgba(255,255,255,.08);border-radius:7px;padding:7px 12px;cursor:pointer;font-size:11px;font-weight:800;min-height:33px;}
    .ks-subtab:hover {background:rgba(255,255,255,.055);color:var(--ks-text,#edf0f6);}
    .ks-subtab.active {background:color-mix(in srgb,var(--ks-accent,#f0aa35) 13%,#11141a);border-color:color-mix(in srgb,var(--ks-accent,#f0aa35) 37%,#12141a);color:var(--ks-accent,#f0aa35);}
    .ks-settings-columns {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start;}
    .ks-settings-columns .ks-card {min-width:0;}
    .ks-grid {grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
    .ks-card {border-radius:8px;padding:2px 15px 4px;}
    .ks-row {padding:12px 0;min-height:58px;gap:10px;}
    .ks-label {font-size:12px;font-weight:760;color:var(--ks-text,#edf0f6);}
    .ks-desc {font-size:10px;line-height:1.48;}
    .ks-hint {border-color:rgba(255,255,255,.075);background:var(--ks-panel,#171c23);color:var(--ks-muted,#9ba6b4);}
    .ks-input {background:var(--ks-bg,#0d1015);border-color:rgba(255,255,255,.13);}
    /* Native <select> elements remain in the DOM for existing change handlers,
       but are visually replaced by fully styled, keyboard-usable dropdowns. */
    .ks-select-shell {position:relative;display:inline-flex;min-width:155px;max-width:100%;flex:0 1 215px;}
    .ks-select-shell>select {position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%);}
    .ks-select-trigger {width:100%;display:flex;justify-content:space-between;align-items:center;gap:9px;min-height:36px;min-width:0;text-align:left;background:rgba(8,10,14,.82);color:var(--ks-text,#edf0f6);border:1px solid rgba(255,255,255,.14);border-radius:7px;padding:7px 10px 7px 12px;font-size:11px;font-weight:700;cursor:pointer;}
    .ks-select-trigger:hover,.ks-select-trigger[aria-expanded="true"] {border-color:var(--ks-accent,#f0aa35);background:#15191f;}
    .ks-select-trigger:focus-visible {outline:2px solid var(--ks-accent,#f0aa35);outline-offset:2px;}
    .ks-select-value {white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;}
    .ks-select-chevron {flex:0 0 auto;color:var(--ks-accent,#f0aa35);font-size:11px;}
    .ks-select-popup {position:fixed;z-index:2147483647;background:#151a21;color:#f4f4f5;border:1px solid rgba(247,169,42,.45);border-radius:9px;padding:5px;box-shadow:0 20px 54px rgba(0,0,0,.85);max-height:min(275px,55vh);overflow:auto;scrollbar-width:thin;scrollbar-color:var(--ks-accent,#f0aa35) #151a21;pointer-events:auto;}
    .ks-select-popup button {display:flex;justify-content:space-between;gap:10px;align-items:center;width:100%;min-height:34px;border:0;border-radius:5px;background:transparent;color:#dfdfdf;padding:7px 10px;white-space:nowrap;text-align:left;font-size:11px;cursor:pointer;}
    .ks-select-popup button:hover,.ks-select-popup button:focus-visible {outline:0;background:#2e3137;color:white;}
    .ks-select-popup button[aria-selected="true"] {background:rgba(242,162,37,.12);color:var(--ks-accent,#f0aa35);}
    .ks-select-popup button[aria-selected="true"]::after {content:'✓';font-weight:900;}
    /* Electron/CEF / Chromium scrollbar track and arrows; no native white arrow buttons. */
    #ks-nav::-webkit-scrollbar,#ks-body::-webkit-scrollbar,.ks-select-popup::-webkit-scrollbar,#ks-panel textarea::-webkit-scrollbar {width:7px;height:7px;}
    #ks-nav::-webkit-scrollbar-track,#ks-body::-webkit-scrollbar-track,.ks-select-popup::-webkit-scrollbar-track,#ks-panel textarea::-webkit-scrollbar-track {background:transparent;}
    #ks-nav::-webkit-scrollbar-thumb,#ks-body::-webkit-scrollbar-thumb,.ks-select-popup::-webkit-scrollbar-thumb,#ks-panel textarea::-webkit-scrollbar-thumb {background:color-mix(in srgb,var(--ks-accent,#f0aa35) 65%,#252b33);border-radius:20px;border:1px solid transparent;background-clip:padding-box;}
    #ks-nav::-webkit-scrollbar-thumb:hover,#ks-body::-webkit-scrollbar-thumb:hover {background:var(--ks-accent,#f0aa35);}
    #ks-nav::-webkit-scrollbar-button,#ks-body::-webkit-scrollbar-button,.ks-select-popup::-webkit-scrollbar-button,#ks-panel textarea::-webkit-scrollbar-button {display:none!important;width:0!important;height:0!important;}

    /* Beta 1.0.0: scale is committed only after releasing the slider.
       CSS zoom reflows text sharply; never raster-stretch with transform. */
    #ks-panel {transform:none!important;transform-origin:center center;}
    #ks-preview-svg {width:162px;height:162px;max-width:100%;}
    .ks-crosshair-preview {position:sticky;top:2px;}
    .ks-preview-inline {min-height:122px;margin:7px 0 12px;}
    .ks-preview-inline #ks-preview-svg {height:118px;width:118px;}
    .ks-advanced-caption {font-size:11px;font-weight:850;letter-spacing:.7px;color:var(--ks-accent,#f0aa35);margin:12px 0 4px;}
    .ks-crosshair-card {padding-bottom:12px;}
    @media (max-width:1250px) {
      .ks-settings-columns,.ks-grid {grid-template-columns:minmax(0,1fr);}
    }
    .ks-history {margin-top:16px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:var(--ks-panel,#171c23);overflow:hidden;}
    .ks-history-heading {font-size:12px;font-weight:850;padding:12px 15px;border-bottom:1px solid rgba(255,255,255,.06);color:var(--ks-text,#edf0f6);}
    .ks-release {border-bottom:1px solid rgba(255,255,255,.07);}
    .ks-release:last-child {border-bottom:0;}
    .ks-release>summary {cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 15px;color:var(--ks-text,#edf0f6);font-size:12px;font-weight:750;}
    .ks-release>summary::-webkit-details-marker {display:none;}
    .ks-release>summary::after {content:'⌄';color:var(--ks-accent,#f0aa35);font-size:18px;line-height:1;transition:transform .15s;}
    .ks-release[open]>summary::after {transform:rotate(180deg);}
    .ks-release>summary:hover {background:rgba(255,255,255,.035);}
    .ks-release-body {padding:2px 16px 15px;color:var(--ks-muted,#9ba6b4);font-size:11px;line-height:1.7;}
    .ks-release-body ul {margin:0;padding-left:18px;}
    .ks-release-body li {padding:2px 0;}
    #ks-changes {display:none!important;}
    #ks-break-reminder {position:absolute;bottom:74px;right:18px;z-index:30;pointer-events:auto;display:flex;align-items:center;gap:12px;max-width:340px;background:#171c23;color:#f0f2f5;border:1px solid var(--ks-accent,#f0aa35);border-radius:10px;padding:13px 15px;font-size:12px;box-shadow:0 10px 40px rgba(0,0,0,.6);}
    #ks-break-reminder[hidden] {display:none!important;}
    #ks-break-dismiss {border:0;color:var(--ks-accent,#f0aa35);background:transparent;font-size:19px;cursor:pointer;}
    .ks-comfort-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start;}
    .ks-comfort-grid .ks-card {min-width:0;}
    .ks-comfort-preview {padding:16px 18px;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:linear-gradient(135deg,#152436,#445572 58%,#c9a577);color:#fff;font-weight:850;text-shadow:0 2px 5px #000;min-height:86px;display:flex;align-items:center;justify-content:space-between;}
    .ks-comfort-grid .ks-row {flex-wrap:wrap;}
    .ks-stability-grid {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:13px 0 17px;}
    .ks-stability-stat {border:1px solid rgba(255,255,255,.09);border-radius:9px;background:var(--ks-panel,#171c23);padding:13px 10px;}
    .ks-stability-stat .ks-metric-value {font-size:20px;}
    .ks-stability-stat .ks-metric-name {font-size:10px;}
    @media(max-width:950px){.ks-comfort-grid{grid-template-columns:1fr;}.ks-stability-grid{grid-template-columns:repeat(2,1fr);}}
    @media (max-width:900px) {
      #ks-panel {width:min(99vw,980px);}
      #ks-main {grid-template-columns:155px minmax(0,1fr);}
      #ks-body {padding:16px;}
      #ks-nav {display:flex;flex-direction:column;max-height:none;overflow-y:auto;}
      .ks-settings-columns,.ks-grid {grid-template-columns:minmax(0,1fr);}
    }
    @media (max-width:650px) {
      #ks-main {display:flex;flex-direction:column;}
      #ks-nav {display:flex;flex-direction:row;flex-wrap:nowrap;overflow:auto;max-height:61px;border-right:0;border-bottom:1px solid rgba(255,255,255,.07);}
      .ks-sidebar-caption,.ks-sidebar-foot {display:none;}
      .ks-tab {white-space:nowrap;flex-shrink:0;}
      #ks-body {min-height:0;}
      #ks-top {padding:11px 13px;}
    }

    .ks-crosshair-editor { display:grid;grid-template-columns:minmax(0,1.35fr) minmax(265px, .85fr);gap:14px;align-items:start; }
    .ks-crosshair-controls { display:grid;gap:12px;min-width:0; }
    .ks-crosshair-preview-column { position:sticky;top:8px;align-self:start;min-width:0; }
    .ks-preview-sticky { padding:12px 14px; }
    .ks-preview-large {min-height:158px;display:grid;place-items:center;border-radius:9px;margin:12px 0;}
    .ks-preview-large #ks-preview-svg {width:142px;height:142px;max-width:100%;}
    .ks-crosshair-advice { margin:0 0 14px;background:rgba(240,170,53,.06);color:var(--ks-text,#f0ece4);border:1px solid rgba(240,170,53,.30);}
    .ks-section-reset {display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;padding:13px 14px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:var(--ks-panel,#171c23);color:var(--ks-muted,#9aa4b4);font-size:11px;}
    @media(max-width:760px){.ks-crosshair-editor{grid-template-columns:minmax(0,1fr);} .ks-crosshair-preview-column{position:relative;top:auto;grid-row:1;} .ks-preview-large{min-height:145px;} .ks-preview-large #ks-preview-svg{width:130px;height:130px;} .ks-section-reset{flex-wrap:wrap;} }

    /* Alpha 1.0.0: calm, consistent settings design. Existing controls and bindings unchanged. */
    #ks-panel {
      width:min(1120px,calc((100vw - 32px) / var(--ks-ui-scale,1)));
      max-height:min(860px,calc((100vh - 32px) / var(--ks-ui-scale,1)));
      border-radius:18px;
      border:1px solid rgba(186,196,213,.16);
      box-shadow:0 34px 100px rgba(0,0,0,.63),0 1px 0 rgba(255,255,255,.045) inset;
    }
    #ks-top {padding:16px 23px;gap:16px;background:color-mix(in srgb,var(--ks-bg,#0d1015) 86%,white 14%);border-color:rgba(185,196,210,.10);}
    #ks-brand {align-items:center;gap:10px;}
    #ks-brand-main {font-size:20px;font-weight:820;letter-spacing:.3px;}
    #ks-brand-sub {font-size:10px;line-height:1.6;letter-spacing:.15px;text-transform:none;}
    #ks-brand-icon {width:26px;height:26px;}
    #ks-panel .ks-alpha {background:transparent;border:1px solid rgba(180,193,208,.16);border-radius:6px;color:var(--ks-muted,#aeb8c5);font-size:10px;font-weight:600;letter-spacing:0;}
    #ks-panel .ks-pill {border:1px solid rgba(185,195,210,.12);border-radius:6px;background:rgba(130,143,162,.065);min-height:28px;font-weight:650;letter-spacing:.15px;}
    #ks-close {background:rgba(140,157,178,.08);border:1px solid rgba(180,193,210,.13);color:var(--ks-text,#edf0f6);border-radius:9px;}
    #ks-close:hover {background:rgba(190,206,222,.14);color:var(--ks-text,#edf0f6);}
    #ks-main {grid-template-columns:206px minmax(0,1fr);}
    #ks-nav {padding:19px 12px 13px;gap:10px;min-height:0;background:color-mix(in srgb,var(--ks-soft,#101217) 92%,white 8%);border-color:rgba(190,198,210,.085);}
    .ks-sidebar-caption {padding:2px 10px 1px;letter-spacing:1.15px;font-size:10px;color:var(--ks-muted,#9ba6b4);opacity:.85;}
    #ks-menu-search-wrap {padding:0 1px 6px;}
    #ks-menu-search {
      display:block;width:100%;min-height:38px;border-radius:10px;
      background:rgba(6,10,15,.35);border:1px solid rgba(175,189,207,.17);
      outline:none;color:var(--ks-text,#edf0f6);padding:9px 11px;
      font:500 12px/1.4 var(--ks-font-family,'Segoe UI',sans-serif);
    }
    #ks-menu-search::placeholder {color:var(--ks-muted,#97a3b2);opacity:.88;}
    #ks-menu-search:focus-visible {border-color:var(--ks-accent,#f0aa35);box-shadow:0 0 0 2px rgba(240,170,53,.12);}
    #ks-sidebar-groups {display:flex;flex-direction:column;gap:5px;}
    #ks-sidebar-groups[hidden],#ks-search-results[hidden] {display:none!important;}
    #ks-search-results {display:grid;gap:6px;align-content:start;}
    .ks-search-result {min-height:49px;display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:8px 10px;border-radius:9px;background:transparent;border:1px solid transparent;color:var(--ks-text,#edf0f6);text-align:left;cursor:pointer;}
    .ks-search-result:hover,.ks-search-result:focus-visible {background:rgba(170,185,205,.09);border-color:rgba(178,191,207,.16);}
    .ks-search-path {font-size:10px;font-weight:500;color:var(--ks-muted,#97a3b2);}
    .ks-search-empty {font-size:11px;line-height:1.5;color:var(--ks-muted,#97a3b2);padding:10px;}
    .ks-tab {min-height:44px;padding:10px 12px;border-radius:10px;gap:12px;color:var(--ks-muted,#aeb8c7);font-size:12px;font-weight:620;letter-spacing:.1px;transition:background .14s ease,color .14s ease,border-color .14s ease;}
    .ks-tab-icon {font-size:16px;width:18px;flex-basis:18px;opacity:.76;}
    .ks-tab:hover {background:rgba(180,194,213,.085);border-color:rgba(185,195,210,.13);color:var(--ks-text,#edf0f6);}
    .ks-tab.active {background:color-mix(in srgb,var(--ks-accent,#f0aa35) 9%,var(--ks-panel,#171c23));border-color:color-mix(in srgb,var(--ks-accent,#f0aa35) 21%,transparent);box-shadow:inset 2px 0 0 var(--ks-accent,#f0aa35);color:var(--ks-text,#edf0f6);}
    .ks-tab.active .ks-tab-icon {opacity:1;}
    .ks-sidebar-foot {font-size:10px;line-height:1.65;padding:11px 10px 3px;color:var(--ks-muted,#9ba6b4);border-color:rgba(185,196,210,.09);}
    #ks-body {padding:24px 28px 27px;}
    .ks-subtabs {gap:7px;margin-bottom:23px;padding-bottom:15px;border-color:rgba(185,196,210,.105);}
    .ks-subtab {min-height:36px;border-radius:9px;padding:8px 12px;border-color:rgba(175,188,206,.13);background:rgba(185,197,214,.028);font-size:11px;font-weight:650;}
    .ks-subtab:hover {background:rgba(177,193,212,.09);}
    .ks-subtab.active {background:color-mix(in srgb,var(--ks-accent,#f0aa35) 10%,var(--ks-panel,#171c23));border-color:color-mix(in srgb,var(--ks-accent,#f0aa35) 28%,transparent);}
    #ks-body .ks-title {font-size:22px;line-height:1.23;letter-spacing:-.35px;margin:0 0 8px;color:var(--ks-text,#edf0f6);font-weight:760;}
    #ks-body .ks-sub {font-size:12px;line-height:1.6;margin:0 0 20px;max-width:76ch;color:var(--ks-muted,#9ba6b4);}
    .ks-settings-columns,.ks-grid {gap:16px;}
    .ks-card {border:1px solid rgba(182,196,214,.105);border-radius:13px;background:color-mix(in srgb,var(--ks-panel,#171c23) 94%,white 6%);padding:4px 18px 7px;}
    .ks-row {min-height:62px;gap:17px;padding:13px 0;border-bottom-color:rgba(175,190,207,.09);}
    .ks-row>div:first-child {min-width:0;}
    .ks-label {font-weight:685;font-size:12px;line-height:1.45;}
    .ks-desc {font-size:11px;line-height:1.55;max-width:67ch;}
    .ks-input,.ks-select-trigger {min-height:38px;border-radius:9px;border-color:rgba(176,193,211,.19);font-weight:575;}
    .ks-btn {border-radius:9px;padding:10px 14px;font-weight:650;transition:background .14s ease,border-color .14s ease;}
    .ks-hint,.ks-note {border-radius:10px;line-height:1.6;}
    .ks-section-heading {letter-spacing:.5px;text-transform:none;font-size:13px;margin-top:20px;font-weight:700;}
    .ks-section-reset {border-radius:11px;}
    #ks-foot {padding:9px 22px;border-color:rgba(185,198,210,.075);font-size:10px;line-height:1.5;color:var(--ks-muted,#98a3ae);}
    #ks-foot>span:last-child {opacity:.6;}
    #ks-panel :is(button,input,textarea,select):focus-visible {outline:2px solid var(--ks-accent,#f0aa35);outline-offset:2px;}
    #ks-badge {
      left:7px!important;bottom:5px!important;padding:0!important;
      border:0!important;border-radius:0!important;background:transparent!important;
      color:#d1d8e1!important;box-shadow:none!important;text-shadow:0 1px 3px rgba(0,0,0,.58);
      opacity:.36;font:500 9px/1.1 'Segoe UI',Arial,sans-serif!important;letter-spacing:.15px!important;
      pointer-events:none;
    }
    @media (max-width:950px) {
      #ks-panel {width:min(99vw,920px);}
      #ks-main {grid-template-columns:175px minmax(0,1fr);}
      #ks-body {padding:19px;}
      .ks-settings-columns,.ks-grid {grid-template-columns:minmax(0,1fr);}
    }
    @media (max-width:650px) {
      #ks-main {display:flex;flex-direction:column;}
      #ks-nav {flex-direction:column;gap:7px;padding:10px;overflow:visible;border-right:0;border-bottom:1px solid rgba(185,198,210,.09);}
      #ks-sidebar-groups {flex-direction:row;overflow-x:auto;gap:5px;padding-bottom:2px;}
      #ks-menu-search-wrap {padding:0;}
      #ks-menu-search {min-height:35px;}
      .ks-tab {flex-shrink:0;min-height:36px;padding:8px 10px;gap:7px;}
      .ks-sidebar-caption,.ks-sidebar-foot {display:none;}
      #ks-body {min-height:0;padding:15px;}
      #ks-top {padding:11px 14px;}
      #ks-brand-sub {display:none;}
      .ks-subtabs {flex-wrap:nowrap;overflow-x:auto;}
      .ks-subtab {flex-shrink:0;}
    }
    @media (prefers-reduced-motion:reduce) {
      .ks-tab,.ks-btn,.ks-subtab {transition:none!important;}
    }

    /* Alpha 1.0.0 — full gamer-style orange/black settings dashboard.
       Applied last to fully replace the previous tiny four-column visual system.
       The controls and native settings integration remain unchanged. */
    #ks-dimmer {
      background:rgba(2,3,7,.83);
      backdrop-filter:blur(10px);
      -webkit-backdrop-filter:blur(10px);
    }
    #ks-panel {
      --ks-orange:#ff8e00;
      --ks-orange-light:#ffb321;
      position:relative;isolation:isolate;
      width:min(1560px,calc((100vw - 26px) / var(--ks-ui-scale,1)));
      height:min(915px,calc((100vh - 24px) / var(--ks-ui-scale,1)));
      max-height:calc((100vh - 24px) / var(--ks-ui-scale,1));
      border:1px solid rgba(255,155,12,.13);border-radius:12px;
      background:#080a0e!important;
      box-shadow:0 0 0 1px rgba(0,0,0,.8),0 35px 120px rgba(0,0,0,.92);
      color:#f7f7fb;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;
    }
    #ks-panel::before {
      content:"";position:absolute;inset:0;z-index:0;pointer-events:none;
      background:
        radial-gradient(ellipse 50% 60% at 90% 12%,rgba(60,78,116,.19),transparent 77%),
        radial-gradient(ellipse 60% 70% at 12% 90%,rgba(225,88,5,.16),transparent 72%),
        linear-gradient(145deg,rgba(11,12,18,.80) 6%,rgba(9,10,16,.84) 48%,rgba(13,14,20,.91)),
        repeating-linear-gradient(90deg,transparent 0 128px,rgba(158,170,194,.02) 130px 132px),
        #08090d;
    }
    #ks-panel::after {
      content:"";position:absolute;inset:0;z-index:0;pointer-events:none;
      background:
        linear-gradient(132deg,transparent 0 10%,rgba(252,109,0,.42) 10.1% 10.7%,transparent 10.8% 100%) bottom left / 33% 40% no-repeat,
        linear-gradient(132deg,transparent 0 28%,rgba(255,146,0,.48) 28.1% 33.5%,transparent 33.6% 100%) bottom left / 21% 31% no-repeat,
        linear-gradient(132deg,transparent 0 63%,rgba(255,123,0,.49) 63.1% 65%,transparent 65.1% 100%) top right / 17% 46% no-repeat,
        radial-gradient(circle at 16% 100%,rgba(236,101,9,.10),transparent 27%);
      opacity:.78;
    }
    #ks-panel>*,#ks-panel #ks-top,#ks-panel #ks-main,#ks-panel #ks-foot {
      position:relative;z-index:1;
    }
    #ks-top {
      height:110px;flex:none;padding:17px 32px 14px 43px;gap:24px;
      background:linear-gradient(180deg,rgba(5,6,9,.56),transparent 92%);
      border:0;
    }
    #ks-brand {display:flex;align-items:center;gap:26px;flex-wrap:nowrap;min-width:0;}
    #ks-brand-icon {display:block;width:65px!important;height:65px!important;object-fit:contain;}
    #ks-brand-rule {display:block;flex:none;width:2px;height:67px;background:rgba(249,249,251,.72);}
    #ks-brand-copy {min-width:0;display:flex;flex-direction:column;gap:4px;}
    #ks-brand-main {font-size:35px;line-height:1.05;font-weight:840;letter-spacing:-1.2px;color:#fff;text-transform:none;}
    #ks-brand-sub {font-size:13px;line-height:1.5;font-weight:400;letter-spacing:0;text-transform:none;color:#bfc0ca;}
    #ks-panel #ks-close {
      width:50px;height:50px;border:0;border-radius:13px;
      background:rgba(4,5,9,.84);color:#f8f8fb;font:400 30px/1 'Segoe UI',sans-serif;
      box-shadow:0 3px 16px rgba(0,0,0,.22);
    }
    #ks-panel #ks-close:hover {background:rgba(255,140,0,.23);color:#fff;}
    #ks-panel .ks-top-discord {
      min-height:38px;border:1px solid rgba(255,154,19,.26);border-radius:11px;
      background:rgba(13,16,24,.76);color:#f5a83a;padding:9px 14px;
      font-size:12px;font-weight:750;cursor:pointer;
    }
    #ks-panel .ks-top-discord:hover {color:#fff;border-color:#ff9a00;background:rgba(255,134,0,.18);}
    #ks-main {
      display:grid;grid-template-columns:294px minmax(0,1fr);
      flex:1;min-height:0;overflow:hidden;
    }
    #ks-nav {
      display:flex;flex-direction:column;min-height:0;max-height:none;overflow-y:auto;
      padding:12px 18px 16px 32px;gap:0;
      border-right:1px solid rgba(255,255,255,.055);
      border-radius:0 18px 18px 0;
      background:linear-gradient(90deg,rgba(11,12,16,.94),rgba(20,20,25,.90));
      box-shadow:15px 0 45px rgba(0,0,0,.28);
    }
    #ks-nav .ks-sidebar-caption {
      font-size:10px;letter-spacing:1.2px;color:#b7b9c4;padding:0 12px 9px;
      opacity:.72;
    }
    #ks-menu-search-wrap {padding:0 9px 13px;}
    #ks-menu-search {
      min-height:38px;width:100%;
      border:1px solid rgba(255,255,255,.12);border-radius:10px;
      background:rgba(1,2,6,.62);color:#f5f6fa;padding:9px 12px;
      font:500 12px 'Segoe UI',Arial,sans-serif;
    }
    #ks-menu-search:focus {border-color:rgba(255,153,0,.8);box-shadow:0 0 0 3px rgba(255,149,0,.11);}
    #ks-sidebar-groups {display:flex;flex-direction:column;gap:2px;padding-right:7px;}
    #ks-panel .ks-tab {
      position:relative;display:flex;align-items:center;gap:21px;
      width:100%;min-height:59px;flex:none;padding:11px 15px;
      background:transparent;border:1px solid transparent;border-bottom-color:rgba(255,255,255,.065);
      border-radius:0;color:#f0f0f4;font-size:15px;font-weight:700;letter-spacing:-.1px;
      transition:background .12s,color .12s,transform .12s;white-space:nowrap;
    }
    #ks-panel .ks-tab-icon {width:26px;flex:0 0 26px;display:grid;place-items:center;opacity:1;}
    #ks-panel .ks-tab-icon svg {width:25px;height:25px;stroke:currentColor;}
    #ks-panel .ks-tab:hover:not(.active) {
      background:rgba(255,255,255,.075);color:#fff;border-color:rgba(255,255,255,.10);border-radius:11px;
    }
    #ks-panel .ks-tab.active {
      transform:translateX(-5px);width:calc(100% + 12px);min-height:61px;
      background:linear-gradient(107deg,#ff7700 5%,#ff9100 67%,#ffb900 100%);
      border:1px solid rgba(255,189,43,.9);border-radius:12px;
      clip-path:polygon(0 0,calc(100% - 18px) 0,100% 50%,calc(100% - 18px) 100%,0 100%);
      color:#fff;font-weight:830;box-shadow:inset 0 1px 2px rgba(255,255,255,.45);
      padding-left:21px;
    }
    #ks-panel .ks-tab.active .ks-tab-icon {color:#fff;}
    #ks-nav .ks-sidebar-foot {
      margin-top:auto;padding:15px 12px 0;border-top:1px solid rgba(255,255,255,.085);
      color:#a3a5b2;font-size:10px;letter-spacing:.45px;line-height:1.5;
    }
    #ks-nav .ks-sidebar-foot span {color:#ffac36;font-weight:800;}
    #ks-body {
      min-width:0;min-height:0;max-height:none;overflow-y:auto;
      padding:10px 46px 29px 40px;
      background:transparent;scrollbar-width:thin;scrollbar-color:rgba(244,155,36,.5) transparent;
    }
    #ks-panel .ks-subtabs {
      display:flex;gap:8px;align-items:center;flex-wrap:wrap;
      padding:0 0 16px;margin:0 0 15px;min-height:45px;
      border-bottom:1px solid rgba(255,255,255,.065);
    }
    #ks-panel .ks-subtab {
      min-height:32px;padding:7px 14px;border:1px solid rgba(255,255,255,.12);
      border-radius:9px;background:rgba(23,24,31,.82);
      color:#bdbec8;font-size:12px;font-weight:650;white-space:nowrap;
    }
    #ks-panel .ks-subtab:hover {border-color:rgba(255,155,0,.45);color:#fff;}
    #ks-panel .ks-subtab.active {
      color:#fff;border-color:rgba(255,152,0,.72);
      background:linear-gradient(180deg,rgba(255,139,0,.26),rgba(255,139,0,.07));
      box-shadow:inset 0 -2px 0 #ff9200;
    }
    #ks-body .ks-title {
      display:flex;align-items:center;gap:15px;
      margin:0 0 3px;font-size:23px;font-weight:850;letter-spacing:-.45px;
      color:#f9f9fb;line-height:1.2;
    }
    #ks-body .ks-title::before {
      content:"";width:27px;height:22px;flex:none;display:block;
      background:linear-gradient(108deg,transparent 0 16%,#ff8e00 16% 33%,transparent 33% 44%,#ff8e00 44% 63%,transparent 63% 100%);
    }
    #ks-body .ks-sub {
      margin:0 0 19px;padding-left:42px;
      font-size:12px;line-height:1.55;max-width:none;color:#adaebb;
    }
    #ks-body .ks-section-heading {
      color:#f5f6fb;font-size:16px;line-height:1.3;
      font-weight:800;letter-spacing:-.2px;text-transform:none;margin:13px 0 11px;
    }
    #ks-body .ks-section-heading::before {content:"▰";color:#ff9000;margin-right:9px;}
    #ks-body .ks-card,#ks-body .ks-metric,#ks-body .ks-stability-stat {
      min-width:0;
      background:linear-gradient(180deg,rgba(35,35,41,.89),rgba(21,22,28,.91));
      border:1px solid rgba(198,201,213,.075);border-radius:16px;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 15px 38px rgba(0,0,0,.25);
    }
    #ks-body .ks-card {padding:9px 20px 13px;margin-bottom:15px;}
    #ks-body .ks-card:has(> .ks-section-heading) {padding-top:7px;}
    #ks-body .ks-settings-columns,#ks-body .ks-grid,#ks-body .ks-comfort-grid {
      gap:16px;align-items:start;
    }
    #ks-body .ks-settings-columns {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));margin-top:16px;}
    #ks-body .ks-related-groups {margin-top:16px;}
    #ks-body .ks-related-groups>.ks-card {margin-bottom:0;}
    #ks-body .ks-row {
      gap:15px;padding:11px 2px;min-height:55px;
      border-bottom:1px solid rgba(199,206,223,.075);flex-wrap:wrap;
    }
    #ks-body .ks-row>div:first-child {min-width:0;flex:1 1 180px;}
    #ks-body .ks-label {font-size:12px;font-weight:760;color:#fff;line-height:1.45;letter-spacing:-.08px;}
    #ks-body .ks-desc {font-size:11px;line-height:1.5;color:#adafbc;max-width:72ch;}
    #ks-body .ks-code {color:#ffb84d;font-size:11px;}
    #ks-body .ks-input {
      min-height:36px;background:#121217;color:#f2f2f5;
      border:1px solid rgba(195,197,207,.25);border-radius:10px;
      padding:7px 12px;font-size:12px;font-weight:575;
    }
    #ks-body input[type="checkbox"] {
      -webkit-appearance:none;appearance:none;display:block;flex:0 0 47px;
      width:47px;height:26px;border:0;border-radius:999px;cursor:pointer;
      background:#4b4c55;position:relative;transition:background .16s ease;
    }
    #ks-body input[type="checkbox"]::before {
      content:"";display:block;position:absolute;left:4px;top:3px;
      width:20px;height:20px;border-radius:50%;background:#f7f7fa;
      box-shadow:0 2px 5px rgba(0,0,0,.25);transition:transform .16s ease;
    }
    #ks-body input[type="checkbox"]:checked {background:linear-gradient(100deg,#ff8600,#ffae00);}
    #ks-body input[type="checkbox"]:checked::before {transform:translateX(20px);}
    #ks-body input[type="checkbox"]:focus-visible {outline:2px solid #ffb523;outline-offset:3px;}
    #ks-body input[type="range"] {accent-color:#ff9200;cursor:pointer;}
    #ks-body .ks-select-trigger {
      min-height:35px;border-radius:11px;color:#f7f7f9;
      border:1px solid rgba(175,181,194,.24);
      background:linear-gradient(180deg,rgba(19,20,25,.95),rgba(8,9,13,.98));
      box-shadow:inset 0 1px 0 rgba(255,255,255,.04);
      font-size:12px;font-weight:625;
    }
    #ks-body .ks-select-trigger:hover {border-color:rgba(255,148,0,.68);}
    .ks-select-popup {background:#16171d!important;border-color:rgba(255,147,0,.55)!important;border-radius:11px!important;box-shadow:0 14px 50px rgba(0,0,0,.75)!important;}
    .ks-select-popup button:hover,.ks-select-popup button[aria-selected="true"] {background:rgba(255,144,0,.16)!important;color:#ffad31!important;}
    #ks-panel .ks-btn {
      min-height:37px;border-radius:11px;padding:8px 15px;
      color:#f6f6fa;font-size:12px;font-weight:750;
      border:1px solid rgba(190,192,205,.13);
      background:linear-gradient(180deg,rgba(42,43,49,.98),rgba(31,32,40,.98));
      box-shadow:0 4px 14px rgba(0,0,0,.16);
    }
    #ks-panel .ks-btn:hover {background:#40404a;border-color:rgba(255,157,29,.43);color:#fff;}
    #ks-panel .ks-btn.primary {
      color:#0b0906;font-weight:880;
      background:linear-gradient(110deg,#ff9600,#ffb10c);
      border:1px solid #ffbc26;box-shadow:0 4px 17px rgba(255,143,0,.22);
    }
    #ks-panel .ks-btn.primary:hover {background:linear-gradient(110deg,#ffae00,#ffd050);color:#120a00;}
    #ks-body .ks-note,#ks-body .ks-hint {
      color:#bbc0cb;font-size:11px;line-height:1.55;
      border:1px solid rgba(183,189,201,.10);border-radius:11px;
      background:rgba(26,27,34,.85);padding:12px 14px;
    }
    #ks-body .ks-stat-details {color:#b9b9c5;font-size:11px;}
    #ks-body .ks-metric-name {color:#b6b8c5;}
    #ks-body .ks-metric-value {color:#fff;}
    #ks-body #ks-graph-fps,#ks-body #ks-graph-ms {border-radius:11px;border-color:rgba(255,147,0,.22);background:rgba(7,8,12,.85);}
    #ks-body .ks-graphic-presets {margin:9px 0 20px;}
    #ks-body .ks-graphic-presets-label {
      display:flex;gap:10px;align-items:center;margin:0 0 12px;
      color:#f4f4f7;font-size:14px;font-weight:780;
    }
    #ks-body .ks-graphic-presets-label::before {content:"▰▰";color:#ff9a0a;letter-spacing:-6px;margin-right:6px;}
    #ks-body .ks-graphic-preset-grid {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;}
    #ks-body .ks-graphic-preset {
      min-height:130px;position:relative;overflow:hidden;text-align:center;
      display:flex;flex-direction:column;justify-content:flex-end;
      border:2px solid rgba(143,149,169,.14);border-radius:17px;
      color:#f5f4f8;cursor:pointer;
      background:linear-gradient(180deg,#373b4d,#202129 75%,#191a20);
      box-shadow:0 12px 26px rgba(0,0,0,.26);
      padding:0;
    }
    #ks-body .ks-preset-landscape {
      display:block;width:100%;height:86px;
      background:
        linear-gradient(135deg,transparent 0 32%,rgba(228,123,22,.38) 32% 38%,transparent 39%),
        linear-gradient(115deg,rgba(24,32,48,.15),rgba(255,150,13,.27)),
        repeating-linear-gradient(90deg,rgba(28,43,66,.90) 0 17px,rgba(58,68,84,.74) 17px 30px,rgba(22,31,49,.9) 30px 42px);
      mask-image:linear-gradient(black,rgba(0,0,0,.45));
    }
    #ks-body .ks-graphic-preset:nth-child(1) .ks-preset-landscape {filter:brightness(.52) saturate(.55);}
    #ks-body .ks-graphic-preset:nth-child(2) .ks-preset-landscape {filter:brightness(.75) saturate(.8);}
    #ks-body .ks-graphic-preset:nth-child(3) .ks-preset-landscape {filter:brightness(1.25) saturate(1.2);}
    #ks-body .ks-preset-name {
      display:flex;align-items:center;justify-content:center;gap:9px;
      width:100%;min-height:43px;padding:9px;
      font-size:14px;font-weight:800;line-height:1.2;
      background:linear-gradient(180deg,#202127,#191a20);
    }
    #ks-body .ks-graphic-preset.active {
      border-color:#ffad11;box-shadow:0 0 0 1px rgba(255,144,0,.5),0 0 23px rgba(255,140,0,.46);
    }
    #ks-body .ks-graphic-preset:hover {border-color:#ffad11;transform:translateY(-1px);}
    #ks-body .ks-preset-check {
      display:none;position:absolute;right:7px;top:7px;
      width:29px;height:29px;border-radius:50%;background:#ff9900;
      color:#fff;font-size:20px;line-height:29px;font-weight:950;text-align:center;
      box-shadow:0 2px 9px rgba(0,0,0,.38);
    }
    #ks-body .ks-graphic-preset.active .ks-preset-check {display:block;}
    #ks-foot {
      min-height:91px;flex:none;display:flex;justify-content:space-between;align-items:center;
      gap:20px;padding:14px 43px 18px 39px;
      background:linear-gradient(180deg,rgba(13,14,19,.92),rgba(9,9,14,.98));
      border-top:1px solid rgba(255,255,255,.085);
    }
    #ks-foot-actions {display:flex;align-items:center;gap:14px;}
    #ks-autosave-status {font-size:11px;color:#a0a2ae;margin-right:6px;}
    #ks-panel #ks-reset-main {min-height:44px;background:linear-gradient(180deg,#292a30,#1d1e25);}
    #ks-panel #ks-cancel {min-width:150px;min-height:48px;font-size:14px;}
    #ks-panel #ks-apply {min-width:177px;min-height:48px;font-size:14px;}
    #ks-discord-quick {
      /* Sit next to the existing KS gear, not over Kirka's bottom-right lobby buttons. */
      position:absolute;left:66px;top:16px;right:auto;bottom:auto;z-index:2;
      display:none;align-items:center;justify-content:center;
      min-height:35px;padding:8px 13px;border:1px solid rgba(255,157,24,.6);
      border-radius:10px;color:#fff;background:rgba(14,13,13,.92);
      font:760 12px 'Segoe UI',Arial,sans-serif;
      pointer-events:auto;cursor:pointer;box-shadow:0 6px 25px rgba(0,0,0,.38);
    }
    #ks-discord-quick:hover {background:linear-gradient(105deg,#ff7900,#ffad00);border-color:#ffc146;color:#17100a;}
    #ks-community-status {
      position:absolute;right:16px;bottom:60px;max-width:310px;
      padding:10px 14px;border-radius:10px;
      border:1px solid rgba(255,148,0,.57);background:rgba(10,11,16,.97);
      box-shadow:0 8px 30px rgba(0,0,0,.5);
      color:#fff;font:600 11px/1.5 'Segoe UI',Arial,sans-serif;
      pointer-events:none;z-index:4;
    }
    #ks-community-status[hidden] {display:none!important;}
    @media(max-width:1250px){
      #ks-panel {width:calc((100vw - 20px)/var(--ks-ui-scale,1));height:calc((100vh - 20px)/var(--ks-ui-scale,1));}
      #ks-top {height:94px;padding:12px 24px;}
      #ks-brand-icon {width:52px!important;height:52px!important;}
      #ks-brand-rule {height:52px;}
      #ks-brand-main {font-size:28px;}
      #ks-main {grid-template-columns:229px minmax(0,1fr);}
      #ks-nav {padding:12px 10px 12px 14px;}
      #ks-panel .ks-tab {font-size:13px;min-height:51px;gap:12px;}
      #ks-body {padding:9px 24px 25px;}
      #ks-body .ks-settings-columns {grid-template-columns:repeat(2,minmax(0,1fr));}
      #ks-foot {padding:12px 24px;}
    }
    @media(max-width:900px){
      #ks-main {display:grid;grid-template-columns:183px minmax(0,1fr);}
      #ks-nav {display:flex;flex-direction:column;max-height:none;overflow-y:auto;padding:10px 7px;}
      #ks-panel .ks-tab {gap:9px;min-height:44px;padding:8px 9px;font-size:12px;}
      #ks-panel .ks-tab-icon {width:22px;flex-basis:22px;}
      #ks-panel .ks-tab-icon svg {width:20px;height:20px;}
      #ks-body .ks-settings-columns,#ks-body .ks-grid,#ks-body .ks-comfort-grid {grid-template-columns:1fr;}
      #ks-body .ks-graphic-preset-grid {gap:8px;}
      #ks-body .ks-graphic-preset {min-height:112px;}
      #ks-body .ks-preset-landscape {height:65px;}
      #ks-panel #ks-reset-main {min-height:40px;}
      #ks-panel #ks-cancel,#ks-panel #ks-apply {min-width:95px;}
      #ks-autosave-status {display:none;}
    }
    @media(max-width:650px){
      #ks-panel {width:calc((100vw - 12px)/var(--ks-ui-scale,1));height:calc((100vh - 12px)/var(--ks-ui-scale,1));}
      #ks-top {height:69px;padding:8px 13px;}
      #ks-brand {gap:10px;}
      #ks-brand-icon {width:37px!important;height:37px!important;}
      #ks-brand-rule {height:32px;width:1px;}
      #ks-brand-main {font-size:22px;}
      #ks-brand-sub {font-size:10px;}
      #ks-panel #ks-close {width:36px;height:36px;font-size:21px;}
      #ks-panel .ks-top-discord {font-size:10px;padding:6px 8px;}
      #ks-main {display:flex;flex-direction:column;}
      #ks-nav {display:flex;flex-direction:column;max-height:155px;overflow-y:auto;flex:none;padding:6px 9px;}
      #ks-sidebar-groups {display:flex;flex-direction:row;gap:5px;overflow-x:auto;}
      #ks-panel .ks-tab {flex:0 0 auto;min-height:36px;width:auto;border-radius:9px;gap:6px;padding:6px 9px;font-size:11px;}
      #ks-panel .ks-tab.active {width:auto;transform:none;min-height:36px;clip-path:none;border-radius:9px;padding:6px 9px;}
      #ks-nav .ks-sidebar-caption,#ks-nav .ks-sidebar-foot {display:none;}
      #ks-menu-search-wrap {padding:0 0 6px;}
      #ks-menu-search {min-height:32px;}
      #ks-body {padding:10px 11px 18px;}
      #ks-body .ks-graphic-preset-grid {grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;}
      #ks-body .ks-graphic-preset {min-height:87px;}
      #ks-body .ks-preset-landscape {height:45px;}
      #ks-body .ks-preset-name {font-size:10px;min-height:35px;padding:4px;}
      #ks-body .ks-card {padding:8px 12px;}
      #ks-body .ks-row {flex-wrap:wrap;}
      #ks-foot {min-height:65px;padding:8px 12px;gap:6px;}
      #ks-panel #ks-reset-main {min-height:32px;padding:5px 8px;font-size:10px;}
      #ks-foot-actions {gap:6px;}
      #ks-panel #ks-cancel,#ks-panel #ks-apply {min-width:65px;min-height:35px;padding:5px 9px;font-size:11px;}
    }
    @media(prefers-reduced-motion:reduce){
      #ks-panel .ks-tab,#ks-body .ks-graphic-preset,#ks-body input[type="checkbox"],
      #ks-body input[type="checkbox"]::before {transition:none;}
    }

    /* KS 1.0.0 — both Kirka-lobby quick buttons are one matched component. */
    #ks-quick {display:flex;align-items:center;gap:8px;max-width:calc(100vw - 28px);}
    #ks-quick #ks-gear,#ks-quick #ks-discord-quick {
      position:relative;inset:auto;right:auto;bottom:auto;left:auto;top:auto;
      min-height:36px;height:36px;
      border:1px solid rgba(255,157,24,.60);border-radius:10px;
      background:rgba(14,13,13,.92);color:#fff;
      font:760 12px/1 'Segoe UI',Arial,sans-serif;
      box-shadow:0 6px 25px rgba(0,0,0,.38);
      cursor:pointer;pointer-events:auto;
      align-items:center;justify-content:center;
      transition:background-color .18s ease,border-color .18s ease,color .18s ease,box-shadow .18s ease,transform .18s ease;
    }
    #ks-quick #ks-gear {width:36px;min-width:36px;padding:0;}
    #ks-quick #ks-gear .ks-gear-icon {font-size:18px;line-height:1;color:inherit;}
    #ks-quick #ks-discord-quick {min-width:91px;width:auto;padding:0 13px;}
    #ks-quick #ks-gear:hover,#ks-quick #ks-discord-quick:hover {
      background:linear-gradient(105deg,#ff7900,#ffad00);border-color:#ffc146;
      color:#17100a;transform:translateY(-1px);box-shadow:0 9px 26px rgba(255,132,0,.19);
    }
    #ks-quick :is(#ks-gear,#ks-discord-quick):active {transform:scale(.96);}
    #ks-quick :is(#ks-gear,#ks-discord-quick):focus-visible {outline:2px solid #ffb838;outline-offset:3px;}

    /* Animated Settings interactions: no layout jumps, only opacity/transform. */
    @keyframes ks123-panel-in {
      from {opacity:0;transform:translateY(13px) scale(.982);}
      to {opacity:1;transform:translateY(0) scale(1);}
    }
    @keyframes ks123-content-in {
      from {opacity:0;transform:translateY(9px);}
      to {opacity:1;transform:translateY(0);}
    }
    @keyframes ks123-pop-in {
      from {opacity:0;transform:translateY(-5px) scale(.985);}
      to {opacity:1;transform:translateY(0) scale(1);}
    }
    @keyframes ks123-glow-in {
      from {box-shadow:0 0 0 rgba(255,145,0,0);}
      to {box-shadow:0 0 0 1px rgba(255,145,0,.22),0 0 14px rgba(255,145,0,.20);}
    }
    #ks-dimmer.visible #ks-panel {animation:ks123-panel-in .24s cubic-bezier(.2,.72,.25,1) both;}
    #ks-body .ks-title,#ks-body .ks-subtabs {animation:ks123-content-in .20s cubic-bezier(.22,.78,.34,1) both;}
    #ks-body .ks-card,#ks-body .ks-graphic-presets,#ks-body .ks-settings-columns {
      animation:ks123-content-in .25s cubic-bezier(.22,.78,.34,1) both;
    }
    #ks-body .ks-graphic-presets {animation-delay:30ms;}
    #ks-panel .ks-tab,#ks-panel .ks-subtab {
      transition:background .19s ease,border-color .19s ease,box-shadow .19s ease,color .19s ease,transform .19s ease;
    }
    #ks-panel .ks-subtab.active {animation:ks123-glow-in .24s ease-out both;}
    #ks-panel :is(.ks-btn,.ks-top-discord,#ks-close),#ks-body .ks-graphic-preset,#ks-body .ks-select-trigger {
      transition:background .18s ease,background-color .18s ease,box-shadow .2s ease,border-color .18s ease,color .18s ease,transform .18s ease;
    }
    #ks-panel :is(.ks-btn,.ks-top-discord,#ks-close):hover,#ks-body .ks-select-trigger:hover {
      transform:translateY(-1px);
    }
    #ks-panel :is(.ks-btn,.ks-top-discord,#ks-close):active,#ks-body .ks-graphic-preset:active {
      transform:translateY(0) scale(.975);
    }
    #ks-body input[type="checkbox"],#ks-body input[type="checkbox"]::before {
      transition:background .20s ease,box-shadow .20s ease,transform .20s cubic-bezier(.2,.8,.3,1);
    }
    #ks-body input[type="checkbox"]:hover {box-shadow:0 0 0 3px rgba(255,144,0,.10);}
    #ks-body input[type="range"] {transition:filter .17s ease;}
    #ks-body input[type="range"]:hover {filter:brightness(1.22);}
    #ks-screen .ks-select-popup {animation:ks123-pop-in .16s ease-out both;}
    #ks-panel .ks-graphic-preset.active {animation:ks123-glow-in .24s ease-out both;}

    /* Honor both in-app controls (Low Latency / UI Animations / Reduced Motion)
       and the operating system's reduced-motion preference. */
    #ks-screen.no-motion *,#ks-screen.no-motion *::before,#ks-screen.no-motion *::after {
      animation:none!important;transition:none!important;
    }
    @media(prefers-reduced-motion:reduce){
      #ks-screen *,#ks-screen *::before,#ks-screen *::after{
        animation:none!important;transition:none!important;
      }
    }

    /* Beta 1.0.0: unified unobtrusive HUD / KS shortcut visual language. */
    #ks-fps,#ks-break-reminder,#ks-community-status {
      border:1px solid rgba(255,157,24,.60)!important;
      background:rgba(14,13,13,.92)!important;
      color:#f8f8fa!important;
      border-radius:10px!important;
      box-shadow:0 6px 25px rgba(0,0,0,.38)!important;
      font-family:'Segoe UI',Arial,sans-serif!important;
      font-size:12px!important;font-weight:760!important;letter-spacing:0!important;
    }
    #ks-fps {
      display:none;min-height:36px;line-height:18px;padding:8px 13px!important;
      pointer-events:none!important;font-variant-numeric:tabular-nums;
      border-left:3px solid #ff9200!important;
    }
    #ks-break-reminder {max-width:min(340px,calc(100vw - 36px));}
    #ks-break-text {line-height:1.5;}
    #ks-break-dismiss {
      display:grid;place-items:center;flex:0 0 29px;width:29px;height:29px;
      background:#171513!important;color:#fff!important;
      border:1px solid rgba(255,157,24,.60)!important;border-radius:8px!important;
      font:750 16px 'Segoe UI',sans-serif!important;transition:background .16s,color .16s,transform .16s;
    }
    #ks-break-dismiss:hover {background:#ff9200!important;color:#151009!important;transform:scale(1.05);}
    #ks-panel #ks-close {
      display:grid;place-items:center;flex:0 0 38px;
      width:38px!important;min-width:38px;height:38px!important;min-height:38px;
      padding:0!important;border:1px solid rgba(255,157,24,.60)!important;
      border-radius:10px!important;background:rgba(14,13,13,.92)!important;color:#fff!important;
      font:760 20px/1 'Segoe UI',Arial,sans-serif!important;
      box-shadow:0 6px 25px rgba(0,0,0,.38)!important;
      transition:background .18s,color .18s,border-color .18s,transform .18s,box-shadow .18s;
    }
    #ks-panel #ks-close:hover {
      background:linear-gradient(105deg,#ff7900,#ffad00)!important;
      color:#17100a!important;border-color:#ffc146!important;
      transform:translateY(-1px);box-shadow:0 9px 26px rgba(255,132,0,.19)!important;
    }
    #ks-panel #ks-close:active {transform:scale(.96);}
    #ks-panel #ks-close:focus-visible {outline:2px solid #ffb838;outline-offset:3px;}
    #ks-panel .ks-tab[data-group="Workshop"] {gap:9px;flex-wrap:wrap;}
    #ks-panel .ks-tab[data-group="Workshop"]>span:nth-child(2) {margin-right:auto;}
    #ks-panel .ks-experimental-badge {
      flex:none;display:inline-flex;align-items:center;justify-content:center;
      padding:4px 6px;border:1px solid rgba(255,184,68,.46);
      border-radius:6px;background:rgba(255,147,0,.14);
      color:#ffb83b;font:780 8px/1 'Segoe UI',sans-serif;letter-spacing:.5px;
    }
    #ks-panel .ks-tab.active .ks-experimental-badge {border-color:rgba(255,255,255,.65);background:rgba(0,0,0,.2);color:#fff;}
    #ks-panel .ks-workshop-experimental {
      display:flex;align-items:center;gap:12px;flex-wrap:wrap;
      padding:12px 15px;margin-bottom:17px;background:rgba(255,144,0,.08);
      border:1px solid rgba(255,159,25,.38);border-radius:12px;
      color:#e6d1b3;font:500 11px/1.6 'Segoe UI',sans-serif;
    }
    #ks-panel .ks-workshop-experimental strong {
      color:#ffb83b;font-size:10px;font-weight:850;letter-spacing:.6px;
    }
    @media(max-width:1250px) {#ks-panel .ks-experimental-badge {font-size:7px;padding:3px 5px;}}
    @media(max-width:900px) {#ks-panel .ks-tab[data-group="Workshop"] {gap:6px;}}
    @media(max-width:650px) {#ks-panel #ks-close {width:35px!important;min-width:35px;height:35px!important;min-height:35px;}}
    @media(prefers-reduced-motion:reduce){#ks-panel #ks-close,#ks-break-dismiss {transition:none!important;}}
    #ks-panel .ks-palette-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(94px,1fr));gap:9px;margin:12px 0 16px;}
    #ks-panel .ks-palette-tile{display:flex;flex-direction:column;gap:5px;align-items:stretch;cursor:pointer;
      padding:7px;border:1px solid rgba(180,193,210,.19);background:rgba(0,0,0,.15);color:var(--ks-text);
      font:600 11px 'Segoe UI',sans-serif;transition:border-color .18s,transform .18s;}
    #ks-panel .ks-palette-tile:hover{transform:translateY(-2px);border-color:var(--ks-accent);}
    #ks-panel .ks-palette-tile:focus-visible{outline:2px solid var(--ks-accent);outline-offset:2px;}
    #ks-panel .ks-palette-preview{height:29px;display:flex;align-items:center;gap:5px;padding:5px;
      border:1px solid;border-radius:5px;}
    #ks-panel .ks-palette-preview i{display:block;height:13px;flex:1;border-radius:3px;}
  </style>
  <div id="ks-screen">
    <div id="ks-fps" aria-label="Estimated frame rate"></div>
    <div id="ks-break-reminder" role="status" aria-live="polite" hidden><span id="ks-break-text"></span><button type="button" id="ks-break-dismiss" aria-label="Dismiss">✕</button></div>
    <div id="ks-crosshair"></div>
    <div id="ks-badge" aria-label="KS Client ${CLIENT_LABEL}">KS · ${CLIENT_VERSION}</div>
    <div id="ks-quick">
      <button id="ks-gear" class="ks-quick-btn" aria-label="Open KS Client settings" title="KS Client Settings"><span class="ks-gear-icon" aria-hidden="true">⚙</span></button>
      <button type="button" id="ks-discord-quick" class="ks-quick-btn" aria-label="Open KS Client Discord in default browser">KS Discord</button>
    </div>
    <div id="ks-community-status" role="status" aria-live="polite" hidden></div>
    <div id="ks-dimmer"><div id="ks-panel" role="dialog" aria-label="KS Client Settings" aria-modal="true">
      <div id="ks-top">
        <div id="ks-brand"><img id="ks-brand-icon" alt="KS Client Logo"><span id="ks-brand-rule"></span><div id="ks-brand-copy"><div id="ks-brand-main">Settings</div><div id="ks-brand-sub">Customize your game experience</div></div></div>
        <div class="ks-stack"><button id="ks-discord-menu" class="ks-top-discord" type="button" aria-label="Open KS Client Discord in default browser">KS Discord</button><button id="ks-close" aria-label="Close Settings">✕</button></div>
      </div>
      <div id="ks-main"><div id="ks-nav"></div>
      <div id="ks-body"></div></div>
      <div id="ks-foot"><button type="button" id="ks-reset-main" class="ks-btn ks-reset-button">↺ &nbsp; Reset to Default</button><div id="ks-foot-actions"><span id="ks-autosave-status">Settings preview instantly</span><button type="button" id="ks-cancel" class="ks-btn">Cancel</button><button type="button" id="ks-apply" class="ks-btn primary">✓ &nbsp; Apply</button></div></div>
    </div></div>
  </div>`;

  const DEFAULT_LOGO_DATA = 'data:image/png;base64,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';
  const $ = id => shadow.getElementById(id);
  // Topic-first navigation: every existing settings tab appears exactly once.
  // Icon paths are local SVG markup and never originate from game content.
  const navIcons=Object.freeze({
    Graphics:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    Display:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m5 17 5-6 4 4 3-3 3 4"/><circle cx="8" cy="8" r="1"/>',
    Gameplay:'<path d="M6 7h12l3 11-3 2-4-4h-4l-4 4-3-2L6 7Z"/><path d="M7 11h6M10 8v6"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="15.5" cy="13" r="1"/>',
    Workshop:'<path d="M15 4a5 5 0 0 0-6 6L3 16l5 5 6-6a5 5 0 0 0 6-6l-4 3-4-4 3-4Z"/>',
    Controls:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
    Interface:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    Advanced:'<circle cx="12" cy="12" r="3.3"/><path d="m10 2-.6 2.1-2 1-2.1-.7-2 3.5 1.5 1.5v2.3L3.4 13l2 3.5 2.1-.7 2 1L10 19h4l.6-2.2 2-1 2.1.7 2-3.5-1.5-1.5V9.3L20.6 8l-2-3.5-2.1.7-2-1L14 2Z"/>'
  });
  const groupIcon=key=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+navIcons[key]+'</svg>';
  const groups = [
    {key:'Graphics', items:['Performance','Frame Stability','Browser Graphics','Browser GPU Info']},
    {key:'Display', items:['Display','Eye Comfort','Crosshair']},
    {key:'Gameplay', items:['Game Integration','Lobby','Friends & Profiles']},
    {key:'Workshop', items:['Weapon Studio','Resource Swapper','Plugins','Inventory & Market']},
    {key:'Controls', items:['Browser Controls']},
    {key:'Interface', items:['Appearance','Interface','Resources','CSS Editor']},
    {key:'Advanced', items:['General','Updates','Sharing','Diagnostics']}
  ];
  const tabs = groups.flatMap(group=>group.items);
  const currentGroup = () => groups.find(group=>group.items.includes(selectedTab)) || groups[0];
  // Complete English/Hungarian KS Client interface translation. Internal
  // preference values and game data are deliberately not translated.
  const languageNames = {
    en:'English',hu:'Magyar',de:'Deutsch',fr:'Français',es:'Español',
    pt:'Português',it:'Italiano',ru:'Русский',zh:'简体中文',ja:'日本語'
  };
  let browserPrefs = { gpu:'enabled', angle:'default', devTools:false, contextMenu:false, uncapFps:false };
  let browserActive = { ...browserPrefs };
  let browserPrefsLoaded = false;
  let browserPendingRestart = false;
  let updateStatus={state:'idle',message:'Updates have not been checked yet.',current:CLIENT_LABEL,channel:'beta'};
  let updateRequestId=0;
  let lastUpdateNotice='';
  let updateNoticeTimer=null;
  function announceAvailableUpdate(release) {
    if(!release || release===lastUpdateNotice)return;
    lastUpdateNotice=release;
    let note=shadow.querySelector('#ks-update-notice');
    if(!note){note=document.createElement('div');note.id='ks-update-notice';note.setAttribute('role','status');
      note.style.cssText='position:fixed;bottom:20px;left:18px;max-width:330px;padding:11px 14px;border:1px solid rgba(255,157,24,.65);border-radius:10px;background:rgba(14,13,13,.94);color:#f5eadd;font:600 12px Segoe UI,Arial,sans-serif;box-shadow:0 8px 25px rgba(0,0,0,.35);z-index:2147483647;pointer-events:none;';shadow.appendChild(note);}
    note.textContent='KS Client '+release+' available · F1 → Updates';note.hidden=false;
    if(updateNoticeTimer)clearTimeout(updateNoticeTimer);
    updateNoticeTimer=setTimeout(()=>{if(note)note.hidden=true;},13000);
  }
  function updateStateText(){
    if(updateStatus.state==='available')return 'New release available: '+String(updateStatus.version||'');
    if(updateStatus.state==='current')return 'You are up to date.';
    if(updateStatus.state==='checking')return 'Checking GitHub Releases…';
    return String(updateStatus.message||'Not checked');
  }
  let browserStatus = 'Waiting for native Electron/CEF settings…';
  let fpsNativeInfo=null;
  function fpsDiagnosticText(){
    if(!fpsNativeInfo)return 'Native startup flags: waiting for engine response';
    const x=fpsNativeInfo;
    return String(x.engine||'Unknown')+
      ' · Chromium uncap switches: '+(x.frameRateLimitSwitch&&x.gpuVsyncSwitch?'REQUESTED':'NOT BOTH REQUESTED')+
      ' · Applied at launch: '+(x.activeAtStartup?'ON':'OFF')+
      ' · Saved setting: '+(x.requested?'ON':'OFF');
  }
  let browserWebGL = { webgl:'Not tested', webgl2:'Not tested', renderer:'Not checked', compositing:'Not accessible from WebGL' };
  const browserGroups = new Set(['Browser Graphics','Browser Controls','Browser GPU Info']);
  function browserSelect(label, description, key, options) {
    return `<div class="ks-row"><div><div class="ks-label">${label}</div><div class="ks-desc">${description}</div></div><select class="ks-input" data-browser="${key}" ${!browserPrefsLoaded?'disabled':''}>${options.map(o=>`<option value="${esc(o.value)}" ${browserPrefs[key]===o.value?'selected':''}>${o.label}</option>`).join('')}</select></div>`;
  }
  function browserCheckbox(label, description, key) {
    return `<div class="ks-row"><div><div class="ks-label">${label}</div><div class="ks-desc">${description}</div></div><input type="checkbox" data-browser="${key}" ${browserPrefs[key]?'checked':''} ${!browserPrefsLoaded?'disabled':''} aria-label="${label}"></div>`;
  }
  function browserStatusBox() {
    return `<div class="ks-status" id="ks-browser-status">${esc(L(browserStatus))}</div>` +
      `${browserPendingRestart ? `<div class="ks-note">${L('GPU or ANGLE changes are pending a restart. The old backend is still active.')}</div>`:''}`;
  }
  function browserResetButton(section) {
    return `<div class="ks-section-reset"><span>${L('Restore only these browser settings to defaults.')}</span><button class="ks-btn danger" data-action="browser-reset" data-browser-section="${esc(section)}">${L('Reset browser settings')}</button></div>`;
  }
  const hu = {
  "Live preview":"Élő előnézet",
  "Crosshair shape":"Célkereszt formája",
  "Select one of 12 shapes":"Válassz a 12 célkeresztforma közül",
  "Cross (4 arms)":"Kereszt (4 szár)",
  "Plus (connected)":"Plusz (összefüggő)",
  "X (diagonal)":"X (átlós)",
  "T-shaped":"T alakú",
  "Chevron (4 corners)":"Négy saroknyíl",
  "Square":"Négyzet",
  "Diamond":"Rombusz",
  "Triangle":"Háromszög",
  "Bullseye":"Körös célkereszt",
  "Four dots":"Négy pont",
  "Single dot":"Egyetlen pont",
  "Crosshair color":"Célkereszt színe",
  "Center shape":"Középpont formája",
  "Choose the center point shape":"Válaszd ki a középpont alakját",
  "Center dot color":"Középpont színe",
  "Center dot size":"Középpont mérete",
  "Center dot outline":"Középpont körvonala",
  "Separate dark/light outline for the center":"Különálló sötét vagy világos körvonal a középpontnak",
  "Center outline color":"Középpont körvonalának színe",
  "Center outline thickness":"Középpont körvonalvastagsága",
  "Outline & shadow":"Körvonal és árnyék",
  "Crosshair outline":"Célkereszt körvonala",
  "Add a separate outline color around the main shape":"Külön színű körvonal a fő alakzat köré",
  "Outline color":"Körvonal színe",
  "Outline thickness":"Körvonal vastagsága",
  "Drop shadow":"Vetett árnyék",
  "Add a soft shadow to improve visibility":"Lágy árnyék a jobb láthatóságért",
  "Shadow color":"Árnyék színe",
  "Shadow blur":"Árnyék elmosása",
  "Shadow X offset":"Árnyék vízszintes eltolása",
  "Shadow Y offset":"Árnyék függőleges eltolása",
  "Independent color, size and shape.":"Külön állítható szín, méret és forma.",
  "Create a fully customized visual overlay. No aim assistance or gameplay automation.":"Teljesen személyre szabható célkereszt. Nem biztosít célzássegítést vagy játékautomatizálást.",
  "Disable the original Kirka.io crosshair to avoid doubling.":"Kapcsold ki a Kirka.io saját célkeresztjét, hogy ne legyen két jelölés.",
  "Saved profiles":"Elmentett profilok",
  "Save, load or delete up to 12 complete presets, including outlines and shadows.":"Legfeljebb 12 teljes profilt menthetsz, betölthetsz vagy törölhetsz, körvonallal és árnyékkal együtt.",
  "Preview uses the same vector drawing as the in-game overlay. Center dot and outlines are independent.":"Az előnézet ugyanazt a vektoros rajzolást használja, mint a játék feletti jelölés. A középpont és a körvonal külön beállítható.",
  "Beta 1.0.0":"Beta 1.0.0",
    "Gameplay":"Játékmenet","Personalization":"Testreszabás","Client":"Kliens",
    "Graphics":"Grafika","Controls":"Vezérlés","Advanced":"Haladó","Workshop":"Műhely","Interface":"Felület",
    "Customize accent, surface, text and typography for the client interface.":"A kliens kiemelőszíneinek, hátterének, szövegének és betűtípusának testreszabása.",
    "Color palette":"Színpaletta","Accent color of active elements":"Az aktív elemek kiemelőszíne",
    "Ready-made color palettes":"Előre összeállított színpaletták",
    "Complete ready-made color palettes and optional visual-only effects. Your gameplay settings never change.":"Teljes színpaletták és különleges megjelenési effektek. A játékbeállítások nem változnak.",
    "Apply a complete palette or keep custom colors":"Teljes színpaletta kiválasztása vagy egyéni színek megőrzése",
    "Custom colors":"Egyéni színek","Extra visual effects":"Extra megjelenési effektek",
    "Surface style":"Felület stílusa","Flat, frosted glass or subtle neon frame":"Sima, üveghatású vagy neonos megjelenés",
    "Solid / Classic":"Egyszerű / klasszikus","Frosted Glass":"Matt üveghatás",
    "Neon Edge":"Neonkeret","Background texture":"Háttérminta",
    "Pattern inside KS Settings only":"Csak a KS Beállításokon belüli minta",
    "None":"Nincs","Fine Grid":"Finom rács","Soft Dots":"Finom pontminta",
    "Spacing density":"Menü elrendezésének sűrűsége",
    "Only adjusts menu row spacing":"Csak a menü sorainak távolságát módosítja",
    "Compact":"Kompakt","Comfortable":"Kényelmes","Spacious":"Tágas",
    "Accent glow":"Kiemelés ragyogása","Corner rounding":"Sarkok lekerekítése",
    "Visual-only effects: no changes to game rendering, mouse control, hit detection, network or performance presets.":"Csak a kinézetet módosítja: az egérkezelés, a játék, a hálózat és a teljesítményprofilok változatlanok.",
    "Background color":"Háttérszín","Panel color":"Panelek színe","Text color":"Szöveg színe","Muted text color":"Másodlagos szöveg színe",
    "Typography & motion":"Betűk és animációk","Colors update instantly. Settings are saved automatically on this device.":"A színek azonnal változnak. A beállításokat a kliens helyben automatikusan menti.",
  "General": "Általános",
  "Sharing": "Megosztás",
  "Display": "Kijelző",
  "Performance": "Teljesítmény",
  "Diagnostics": "Diagnosztika",
  "Crosshair": "Célkereszt",
  "Appearance": "Megjelenés",
  "Resources": "Erőforrások",
  "CSS Editor": "CSS-szerkesztő",
  "Interface": "Felület",
  "Settings": "Beállítások",
  "Updates": "Frissítések",
  "Software Updates": "Szoftverfrissítések",
  "Check for updates": "Frissítések keresése",
  "Install update & restart": "Frissítés telepítése és újraindítás",
  "Automatically check for updates": "Frissítések automatikus keresése",
  "Download updates automatically": "Frissítések automatikus letöltése",
  "Update channel": "Frissítési csatorna",
  "Stable only": "Csak stabil kiadások",
  "Alpha / Beta": "Alfa / béta",
  "Current version": "Jelenlegi verzió",
  "Update status": "Frissítés állapota",
  "Open KS Client settings": "KS Client beállításainak megnyitása",
  "KS Client Settings": "KS Client beállítások",
  "Custom Kirka.io Client · Beta 1.0.7": "Egyedi Kirka.io-kliens · Beta 1.0.7",
  "F1 Settings · F10 Hide Client HUD · F11 Fullscreen": "F1 Beállítások · F10 Kliens-HUD elrejtése · F11 Teljes képernyő",
  "Unofficial client inspired by your KirkaStats / clan tracker theme · Beta 1.0.7": "Nem hivatalos kliens a KirkaStats / klánkövető stílusában · Beta 1.0.7",
  "Close Settings": "Beállítások bezárása",
  "● ACTIVE": "● AKTÍV",
  "Client Overview": "A kliens áttekintése",
  "KS Client is a separate Windows app with an embedded Chromium Electron/CEF engine.": "A KS Client önálló Windows-alkalmazás, beépített Chromium Electron/CEF motorral.",
  "Active browser engine": "Aktív böngészőmotor",
  "Experimental engine, not available in this release": "Kísérleti motor, ebben a kiadásban még nem használható",
  "Borderless fullscreen": "Keret nélküli teljes képernyő",
  "Toggle fullscreen · F11": "Teljes képernyő be/ki · F11",
  "Reset client settings": "Kliensbeállítások visszaállítása",
  "Reset all settings": "Összes beállítás visszaállítása",
  "This build uses the visible label Beta 1.0.5. Game files and player data still come from Kirka.io.": "Ez a kiadás az Beta 1.0.5 verziójelzést használja. A játékfájlok és a játékosadatok továbbra is a Kirka.io-ról érkeznek.",
  "Settings Backup & Language": "Beállításmentés és nyelv",
  "Save and share your own KS Client preferences. JSON only; never import settings from an unknown person.": "Mentsd el és oszd meg a KS Client beállításait. Csak JSON-fájl használható; ismeretlen személy mentését ne importáld.",
  "Language": "Nyelv",
  "Choose the complete English or Hungarian KS Client interface.": "Válassz a teljes angol vagy magyar KS Client felület közül.",
  "English": "Angol",
  "Settings import/export": "Beállítások importálása és exportálása",
  "Export a JSON backup, including crosshair presets and visual settings. Uploaded binary assets are excluded.": "JSON-mentés készítése a célkeresztprofilokról és a megjelenési beállításokról. A feltöltött fájlok nem kerülnek bele.",
  "Export settings": "Beállítások exportálása",
  "Import settings": "Beállítások importálása",
  "Settings stay on your device until you export them.": "A beállítások a gépeden maradnak, amíg nem exportálod őket.",
  "Export leaves out the update-feed URL and local image/audio/font files. Imported CSS stays disabled until you review and enable it.": "A mentés nem tartalmazza a frissítési URL-t, sem a helyi kép-, hang- vagy betűkészletfájlokat. Az importált CSS ellenőrzésig kikapcsolva marad.",
  "Settings JSON exported. No account token or local image/audio/font was included.": "A beállítások JSON-mentése elkészült. Fióktoken és helyi kép-, hang- vagy betűkészletfájl nem került bele.",
  "Display & Resolution": "Kijelző és felbontás",
  "Separate presets for the KS Client menu area and the Kirka.io game rendering density.": "Külön felbontásbeállítások a KS Client ablakához és a Kirka.io megjelenítési részletességéhez.",
  "Menu resolution preset": "Menüfelbontás",
  "Controls the client window preset used for the KS menu and browsing pages.": "A kliensablak célméretét állítja be a menühöz és a weboldalakhoz.",
  "Game resolution preset": "Játékfelbontás",
  "Controls the Electron/CEF rasterization target for Kirka.io rendering.": "A Kirka.io Electron/CEF-megjelenítésének célfelbontását állítja be.",
  "Native / automatic": "Natív / automatikus",
  "Settings menu scale": "Beállításmenü méretezése",
  "Show FPS counter": "FPS-számláló megjelenítése",
  "Approximate browser animation-frame rate (not direct GPU FPS)": "A böngésző animációs képkockáinak becsült száma (nem közvetlen GPU-FPS).",
  "FPS position": "FPS-számláló helye",
  "Top left": "Bal felső sarok",
  "Top right": "Jobb felső sarok",
  "Bottom right": "Jobb alsó sarok",
  "Automatic is recommended: the menu fits your monitor work area and the game uses the native engine/Windows display scale. When monitor information is unavailable, 1080p is used as a fallback. Fixed presets adjust browser page zoom, not the game engine’s internal render resolution.": "A játékfelbontás a Electron/CEF megjelenítési sűrűségét akár 4K-ig növeli. A menübeállítás a kliensablak célméretét módosítja; a tényleges méret a monitortól és a Windows nagyításától is függ.",
  "Performance Settings": "Teljesítménybeállítások",
  "Best-effort game animation pacing, measured frametimes, and client-side performance profiles.": "Kísérleti képkocka-időzítés, mért képkockaidők és kliensoldali teljesítményprofilok.",
  "FPS Limiter": "FPS-korlátozó",
  "Attempts to pace game requestAnimationFrame callbacks. The game engine, WebGL and monitor may ignore the target.": "Megpróbálja szabályozni a játék requestAnimationFrame-hívásait. A játékmotor, a WebGL vagy a monitor figyelmen kívül hagyhatja a célt.",
  "Unlimited / Native": "Korlátlan / natív",
  "Performance Preset": "Teljesítményprofil",
  "Low targets 1080p / 60 FPS; Balanced uses native resolution; High Performance reduces client effects.": "Az Alacsony profil 1080p/60 FPS-t céloz, a Kiegyensúlyozott natív felbontást használ, a Nagy teljesítmény csökkenti a kliens effektjeit.",
  "Low": "Alacsony",
  "Balanced": "Kiegyensúlyozott",
  "High Performance": "Nagy teljesítmény",
  "Low Latency Mode": "Alacsony késleltetésű mód",
  "Removes client blur and animation effects; cannot guarantee lower game input or network latency.": "Kikapcsolja a kliens elmosási és animációs effektjeit; nem garantál alacsonyabb bemeneti vagy hálózati késleltetést.",
  "UI Animations": "Felületi animációk",
  "Allow animations and blur in the KS Client interface.": "Animációk és elmosási effektusok engedélyezése a KS Clientben.",
  "Real-time FPS & Frametime graphs": "Valós idejű FPS- és képkockaidő-grafikonok",
  "Show live sampled browser/game callback timing graphs while this tab is open.": "Élő, mintavételezett böngészős/játékos időzítési grafikonok megjelenítése, amíg ez a fül nyitva van.",
  "Measured callback rate": "Mért animációs hívási gyakoriság",
  "Browser animation ticks (not game GPU FPS)": "Böngésző-animációs ütem (nem a játék GPU-FPS-e)",
  "Estimated game rAF callback rate (not presented GPU frames)": "Becsült játékon belüli animációs hívási gyakoriság (nem GPU-képkockaszám)",
  "Most recent callback interval": "Legutóbbi hívások közötti idő",
  "FPS history (last ~60 samples)": "FPS-előzmények (utolsó ~60 mérés)",
  "Frametime history (milliseconds)": "Képkockaidő-előzmények (ezredmásodperc)",
  "The FPS limit is a best-effort JavaScript frame pacing mechanism, not a driver-level cap. Graphs display animation callback timings, not confirmed GPU presentation times. For stable gameplay try 120 or 144 FPS.": "Az FPS-korlát kísérleti JavaScript-időzítés, nem illesztőprogram-szintű korlátozás. A grafikonok animációs hívási időket mutatnak, nem igazolt GPU-megjelenítési adatokat. Stabil játékhoz próbáld a 120 vagy 144 FPS-t.",
  "Advanced Diagnostics": "Részletes diagnosztika",
  "Live measurements of KS Client and its Chromium/Electron/CEF child processes. Refreshes every two seconds.": "A KS Client és a Chromium/Electron/CEF alfolyamatainak élő mérései. Két másodpercenként frissülnek.",
  "Browser CPU": "Böngésző CPU-használata",
  "Browser RAM": "Böngésző memóriahasználata",
  "Browser Processes": "Böngészőfolyamatok",
  "Client CPU": "Kliens CPU-használata",
  "Client RAM": "Kliens memóriahasználata",
  "Renderer": "Megjelenítő",
  "Not checked": "Még nincs ellenőrizve",
  "Hardware Acceleration Check": "Hardveres gyorsítás ellenőrzése",
  "Inspect WebGL context and software-renderer indicators. Electron/CEF uses GPU acceleration by default.": "A WebGL-környezet és a szoftveres megjelenítés jeleinek vizsgálata. A Electron/CEF alapból GPU-gyorsítást használ.",
  "Check GPU": "GPU ellenőrzése",
  "WebGL renderer": "WebGL-megjelenítő",
  "Press Check GPU to test WebGL": "Kattints a GPU ellenőrzése gombra a WebGL teszteléséhez",
  "Local Crash Reporter": "Helyi hibajelentések",
  "Logs app errors and identifies previously unclean shutdowns. Reports remain on your PC.": "Naplózza a programhibákat, és jelzi a korábbi szabálytalan leállásokat. A jelentések a gépeden maradnak.",
  "Open log folder": "Naplómappa megnyitása",
  "Checking local logs...": "Helyi naplók ellenőrzése…",
  "A visible WebGL renderer is not conclusive proof of full GPU acceleration. Fatal native crashes may not yield a full dump. Diagnostics are not uploaded.": "A WebGL-megjelenítő neve önmagában nem bizonyítja a teljes GPU-gyorsítást. Súlyos natív összeomlásnál nem mindig keletkezik teljes hibadump. A diagnosztikai adatok nem kerülnek feltöltésre.",
  "Custom Crosshair": "Egyedi célkereszt",
  "A visual center overlay. No aim assistance or game automation.": "Képernyőközépre rajzolt célkereszt. Nem nyújt célzási segítséget és nem automatizálja a játékot.",
  "Enable custom crosshair": "Egyedi célkereszt engedélyezése",
  "Turn off the in-game crosshair first if you see two.": "Ha két célkeresztet látsz, először kapcsold ki a játék saját célkeresztjét.",
  "Shape": "Forma",
  "Cross": "Kereszt",
  "Dot": "Pont",
  "Circle": "Kör",
  "Color": "Szín",
  "Size": "Méret",
  "Gap": "Rés",
  "Thickness": "Vastagság",
  "Opacity": "Átlátszatlanság",
  "Center dot": "Középpont",
  "Add a small dot in the middle": "Kis pont megjelenítése középen",
  "Crosshair drawing aligns to the center of the embedded page. Hide the original crosshair to avoid doubling.": "A célkereszt a beágyazott oldal közepére igazodik. A kettőződés elkerüléséhez rejtsd el az eredeti célkeresztet.",
  "Crosshair Presets": "Célkeresztprofilok",
  "Save, load and delete up to 12 custom presets.": "Legfeljebb 12 egyedi profil mentése, betöltése és törlése.",
  "Select a saved preset": "Válassz egy mentett profilt",
  "Save": "Mentés",
  "Load": "Betöltés",
  "Delete": "Törlés",
  "New preset name": "Új profil neve",
  "Appearance & Themes": "Megjelenés és témák",
  "Personalize the KS Client menu and, optionally, HTML elements of the game interface.": "Szabd testre a KS Client menüjét, valamint igény szerint a játék HTML-elemeit.",
  "Client theme": "Kliens témája",
  "Accent color used on KS menus and controls": "A KS menüiben és kezelőelemein használt kiemelőszín",
  "Amber / Gold": "Borostyán / arany",
  "Ember": "Parázs",
  "Ice Blue": "Jégkék",
  "Forest Green": "Erdőzöld",
  "Violet": "Lila",
  "Custom": "Egyéni",
  "Custom accent color": "Egyedi kiemelőszín",
  "Font family": "Betűtípus",
  "Fonts already available in Windows / Electron/CEF": "A Windowsban / Electron/CEF-ben elérhető betűtípusok",
  "Uploaded font (Resources)": "Feltöltött betűkészlet (Erőforrások)",
  "Client font size": "Kliens betűmérete",
  "Menu animations": "Menüanimációk",
  "Enable client transitions and blur effects.": "Kliensátmenetek és elmosási effektusok engedélyezése.",
  "The KS Client theme applies instantly. Game menu styling is limited to accessible HTML controls; Kirka.io may render some interface parts on canvas.": "A KS Client témája azonnal érvényesül. A játék menüstílusa csak az elérhető HTML-elemekre hat; a Kirka.io egyes részeket vászonra rajzolhat.",
  "Resource Swapper": "Erőforráscsere",
  "Load local UI image, background, sound or font. Files stay on your device.": "Helyi felületkép, háttér, hang vagy betűtípus betöltése. A fájlok a gépeden maradnak.",
  "Menu Background": "Menü háttérképe",
  "Image applied behind KS Client settings; optional game selector in CSS Editor.": "A KS Client beállításmenüje mögött látható kép; a játékhoz tartozó célzót a CSS-szerkesztőben találod.",
  "No local file selected": "Nincs kiválasztott helyi fájl",
  "Browse": "Tallózás",
  "Remove": "Eltávolítás",
  "Use custom settings background": "Egyéni beállításmenü-háttér használata",
  "Shows your uploaded background behind the dark menu overlay.": "A feltöltött háttérkép megjelenítése a sötét menü mögött.",
  "UI Image / Logo": "Felületkép / logó",
  "Replaces the KS Client header logo; optional game selector in CSS Editor.": "Lecseréli a KS Client fejlécének logóját; a játékhoz tartozó célzót a CSS-szerkesztőben találod.",
  "Menu Sound": "Menühang",
  "A short local sound played when opening Settings, if enabled.": "Rövid, helyi hang lejátszása a beállítások megnyitásakor, ha engedélyezett.",
  "Play custom menu sound": "Egyéni menühang lejátszása",
  "Requires a selected sound; browser playback policy applies.": "Kiválasztott hangfájl szükséges; a böngésző lejátszási szabályai érvényesek.",
  "Custom Font": "Egyedi betűkészlet",
  "Upload a .woff or .woff2 font for use in Appearance.": "Tölts fel .woff vagy .woff2 betűkészletet a Megjelenés fülhöz.",
  "Some local resources could not be loaded.": "Néhány helyi erőforrást nem sikerült betölteni.",
  "Assets are stored locally in this browser profile.": "Az erőforrásokat a böngészőprofil helyben tárolja.",
  "Local resource removed.": "A helyi erőforrás eltávolítva.",
  "Resource swapping here affects KS Client UI and optionally selected game HTML elements via CSS. It does not intercept Kirka.io network assets, replace 3D textures, or alter game data. Upload rights-cleared assets only.": "Az erőforráscsere a KS Client felületére és a CSS-sel kiválasztott játékbeli HTML-elemekre hat. Nem cseréli a Kirka.io hálózati fájljait, 3D textúráit vagy játékadatait. Csak jogtisztán használható fájlokat tölts fel.",
  "Client HUD & Style": "Kliens-HUD és stílus",
  "Choose which KS Client widgets appear over the game.": "Válaszd ki, hogy a KS Client mely elemei jelenjenek meg a játék fölött.",
  "Client HUD enabled": "Kliens-HUD engedélyezése",
  "Master switch for FPS counter, badge, crosshair and quick settings button": "Főkapcsoló az FPS-számlálóhoz, jelvényhez, célkereszthez és gyorsbeállításokhoz",
  "Show KS Client badge": "KS Client jelvény megjelenítése",
  "Small KS Client label in the lower-left corner": "Kis KS Client jelvény a bal alsó sarokban",
  "Reduce client animations": "Kliensanimációk csökkentése",
  "Disable blur and decorative transitions in the KS interface": "Elmosás és díszítő átmenetek kikapcsolása a KS felületén",
  "Minimal HUD": "Minimális HUD",
  "Hide nonessential KS overlays while keeping Settings accessible.": "A nem szükséges KS-elemek elrejtése, a Beállítások megtartásával.",
  "Quick hide / show": "Gyors elrejtés / megjelenítés",
  "Toggle client HUD · F10": "Kliens-HUD be/ki · F10",
  "The KS menu theme now follows your black / orange KirkaStats and clan tracker style, including the darker panel cards and outlined action buttons.": "A KS Client menüje a fekete–narancs KirkaStats és klánkövető stílust használja, sötétebb panelekkel és körvonalas gombokkal.",
  "Custom CSS Editor": "Egyedi CSS-szerkesztő",
  "Personalize HTML-based Kirka.io menus with your own stylesheet.": "Szabd testre a Kirka.io HTML-alapú menüit saját CSS-stíluslappal.",
  "Game HTML styling options": "A játék HTML-felületének beállításai",
  "Apply theme to game HTML menus": "Téma alkalmazása a játék HTML-menüire",
  "Best effort CSS styling of HTML buttons only; does not recolor WebGL-rendered menus.": "Csak a HTML-gombok megjelenésének kísérleti módosítása; a WebGL-menük színét nem változtatja meg.",
  "Apply font to game HTML menus": "Betűtípus alkalmazása a játék HTML-menüire",
  "Optional HTML-only font override; not WebGL textures.": "Opcionális betűtípus-felülírás csak HTML-hez, nem WebGL-textúrákhoz.",
  "Game menu CSS selector (advanced)": "Játékmenü CSS-szelektora (haladó)",
  "UI image target selector (advanced)": "Felületkép célpontjának szelektora (haladó)",
  "Optional game HTML elements to hide (CSS selector)": "Elrejthető játékbeli HTML-elemek (CSS-szelektor)",
  "Custom stylesheet editor": "Egyedi stíluslap szerkesztése",
  "Enable custom CSS": "Egyedi CSS engedélyezése",
  "Applies only on pages using the KS Client overlay.": "Csak a KS Client felülettel megnyitott oldalakra vonatkozik.",
  "Custom stylesheet (max 12,000 characters)": "Egyedi stíluslap (legfeljebb 12 000 karakter)",
  "Apply CSS": "CSS alkalmazása",
  "Clear CSS": "CSS törlése",
  "Styles can change or break page layouts. Use Clear CSS to undo custom changes. Script execution is not supported by this editor.": "A CSS megváltoztathatja vagy elronthatja az oldalak elrendezését. A CSS törlése gombbal visszavonhatod a módosításokat. Ez a szerkesztő nem futtat JavaScriptet.",
  "Optional HTML element selector e.g. .menu-background": "Opcionális HTML-szelektor, pl. .menu-background",
  "Optional HTML element selector": "Opcionális HTML-szelektor",
  "e.g. .optional-panel": "pl. .optional-panel",
  "Reset all KS Client settings?": "Visszaállítod a KS Client összes beállítását?",
  "Import this settings backup? Personal CSS will remain disabled for safety. Local assets will not be changed.": "Importálod ezt a beállításmentést? A saját CSS biztonsági okból kikapcsolva marad. A helyi fájlok nem változnak.",
  "Download the SHA-256-verified update into your Downloads folder?": "Letöltöd az SHA-256-tal ellenőrzött frissítést a Letöltések mappába?",
  "Install the verified update and restart KS Client? The old EXE will be backed up.": "Telepíted az ellenőrzött frissítést, majd újraindítod a KS Clientet? A régi EXE-ről biztonsági másolat készül.",
  "Maximum 12 crosshair presets. Remove one first.": "Legfeljebb 12 célkeresztprofil menthető. Előbb törölj egyet.",
  "Please choose a JSON backup smaller than 256 KB.": "Válassz egy 256 KB-nál kisebb JSON-mentést.",
  "Unsupported KS Client settings format.": "Nem támogatott KS Client beállításformátum.",
  "WebGL unavailable": "WebGL nem érhető el",
  "Unknown": "Ismeretlen",
  "No WebGL context could be created": "Nem sikerült WebGL-környezetet létrehozni",
  "Software renderer detected": "Szoftveres megjelenítő észlelve",
  "WebGL available (GPU unconfirmed)": "WebGL elérhető (GPU nem ellenőrzött)",
  "The renderer reports software rendering.": "A megjelenítő szoftveres feldolgozást jelez.",
  "WebGL works; check Edge DevTools for compositing and all GPU feature status.": "A WebGL működik; az Edge fejlesztői eszközeiben ellenőrizheted a GPU-funkciókat.",
  "Not available": "Nem érhető el",
  "Collecting data…": "Adatok gyűjtése…",
  "Frame interval": "Képkockák közötti idő",
  "Personalize the KS Client menu colors and fonts. Advanced game HTML styling is under CSS Editor.": "Szabd testre a KS Client menüjének színeit és betűtípusait. A haladó játékbeli HTML-stílusok a CSS-szerkesztőben találhatók.",
  "The KS Client theme applies instantly. Game HTML styling is available in the CSS Editor at the bottom of the menu.": "A KS Client témája azonnal érvényesül. A játék HTML-felületének testreszabását a menü alján található CSS-szerkesztőben éred el.",
  "What's new": "Mi újság",
  "Background color": "Háttérszín",
  "Panel color": "Panelszín",
  "Text color": "Szövegszín",
  "Muted text color": "Másodlagos szövegszín",
  "Layout style": "Elrendezési stílus",
  "Inspired by the clean double-column layout you requested.": "A kért letisztult, kéthasábos elrendezés ihlette.",
  "REFRESHED": "FRISSÍTVE",
  "Personalize the KS Client menu colors, panels and fonts. Advanced game HTML styling is under CSS Editor.": "Szabd testre a KS Client menüjének színeit, paneljeit és betűtípusait. A haladó játékbeli HTML-stílusok a CSS-szerkesztőben találhatók.",
  "Match monitor / automatic": "Monitorhoz igazítás / automatikus",
  "Auto-fit the current monitor work area, or select a fixed window size.": "Az aktuális monitor használható területéhez igazítja az ablakot, vagy fix méretet állít be.",
  "Automatic uses monitor DPI and engine native scaling; fixed modes set a raster target.": "Automatikusan a monitor DPI- és Electron/CEF-skálázását használja; a fix módok megjelenítési célméretet állítanak.",
  "Automatic is recommended: the menu fits your monitor work area and the game uses the native engine/Windows display scale. When monitor information is unavailable, 1080p is used as a fallback. Fixed presets adjust browser page zoom, not the game engine’s internal render resolution.": "Az automatikus mód ajánlott: a menü a monitor használható területéhez igazodik, a játék pedig a natív Windows/Electron/CEF képernyőskálázást követi. Ha nem érhetők el monitoradatok, a tartalék felbontás 1080p. A fix módok a megjelenítési sűrűséget módosítják, nem a játékmotor belső felbontását.",
  "Audio test": "Hang tesztelése",
  "Play the uploaded menu sound now to confirm Electron/CEF allows playback.": "A feltöltött menühang lejátszásával ellenőrizheted, hogy a Electron/CEF engedélyezi-e a hangot.",
  "Test sound": "Hang kipróbálása",
  "Local assets check": "Helyi erőforrások ellenőrzése",
  "Verify which uploaded resources are currently available in this profile.": "Ellenőrzi, hogy a profilban mely feltöltött erőforrások érhetők el.",
  "Verify assets": "Erőforrások ellenőrzése",
  "No menu sound uploaded. Choose an audio file first.": "Nincs feltöltött menühang. Először válassz ki egy hangfájlt.",
  "Menu sound playback started successfully.": "A menühang lejátszása sikeresen elindult.",
  "No local asset loaded. Add a file above.": "Nincs betöltött helyi erőforrás. Fent adj hozzá egy fájlt.",
  "Paces browser requestAnimationFrame callbacks. This can limit games using the main-thread rAF loop, but is not a GPU driver cap.": "A böngésző requestAnimationFrame hívásait ütemezi. Ez korlátozhatja az ezen alapuló játékokat, de nem videokártya-szintű FPS-limit.",
  "Disables KS Client menu blur and animations. This reduces interface overhead only, not game network latency.": "Kikapcsolja a KS Client menüelmosását és animációit. Csak a felület terhelését csökkenti, a hálózati késleltetést nem.",
  "Limit lobby rendering":"Renderelés korlátozása az előszobában",
  "Cap page animation callbacks at 60 in the visible lobby.":"A látható előszobában legfeljebb 60 animációs hívás másodpercenként.",
  "Limit unfocused rendering":"Renderelés korlátozása inaktív ablakban",
  "Cap page animation callbacks at 30 when another window has focus.":"Ha másik ablak aktív, legfeljebb 30 animációs hívás másodpercenként.",
  "Reduce rendering in Settings":"Renderelés visszafogása a beállításokban",
  "Limit page animation callbacks to 30 per second while browsing Settings. Frame Stability uses the gameplay limit while measuring.":"A beállításokban a lap animációi legfeljebb 30-szor futnak másodpercenként. A Képkockastabilitás lap a játékhoz megadott korlát mellett mér.",
  "99th-percentile interval":"99. percentilis képkockaköz",
  "Game WebGL draws/s":"Játék WebGL rajzolási hívásai/s",
  "Measured requestAnimationFrame callback rate, not presented GPU FPS.": "Mért requestAnimationFrame hívási gyakoriság, nem a GPU által megjelenített FPS.",

  "Tip: disable the default crosshair elements in Kirka.io settings to prevent a double crosshair.": "Tipp: kapcsold ki a Kirka.io beállításaiban az alap célkereszt elemeit, hogy ne látszódjon két célkereszt!",
  "Preview background": "Előnézet háttere",
  "Change only the preview background; this does not affect the game.": "Csak az előnézet hátterét állítja; a játék hátterét nem módosítja.",
  "Default": "Alapértelmezett",
  "Black": "Fekete",
  "White": "Fehér",
  "Reset section settings": "Ezen rész beállításainak visszaállítása",
  "This resets only the open settings section.": "Csak az aktuális rész beállításait állítja vissza.",
  "Reset only the settings in this section? Other sections will stay unchanged.": "Csak az aktuális rész beállításait állítod vissza? A többi rész változatlan marad.",
  };

  Object.assign(hu, {
    'Browser':'Böngésző',
    'Saving browser settings…':'Böngészőbeállítások mentése…',
    'chrome://settings/system — the equivalent settings for this embedded runtime are here.':'chrome://settings/system — a beépített Electron/CEF megfelelő beállításai itt találhatók.',
    'chrome://flags/#use-angle — applies only when Electron/CEF starts.':'chrome://flags/#use-angle — csak a Electron/CEF indításakor alkalmazható.',
    'Browser settings loaded':'Böngészőbeállítások betöltve',
    'Browser settings saved. Live options applied.':'A böngészőbeállítások mentve. A közvetlenül módosítható opciók alkalmazva.',
    'Saved. Restart KS Client to apply GPU/ANGLE changes.':'Mentve. A GPU/ANGLE módosítások alkalmazásához indítsd újra a KS Clientet.',
    'Applied on browser startup':'A böngésző indításakor alkalmazva',
    'Disabled GPU may prevent Kirka.io from loading.':'Kikapcsolt GPU mellett a Kirka.io esetleg nem töltődik be.',
    'Browser Graphics':'Grafika bongeszo grafika hardvergyorsitas',
    'Browser Controls':'Böngészőfunkciók bongeszo vezerles eszkozok',
    'Browser GPU Info':'GPU diagnosztika videokartya gpu',
    'Graphics engine':'Grafikus motor',
    'Chromium / Electron/CEF Graphics':'Chromium / Electron/CEF grafika',
    'GPU hardware acceleration':'GPU-hardvergyorsítás',
    'Enabled (recommended)':'Bekapcsolva (ajánlott)',
    'Disabled (compatibility test)':'Kikapcsolva (hibakereséshez)',
    'ANGLE graphics backend':'ANGLE grafikus háttérrendszer',
    'Automatic / Default':'Automatikus / Alapértelmezett',
    'D3D11 (DirectX 11)':'D3D11 (DirectX 11)',
    'OpenGL (experimental)':'OpenGL (kísérleti)',
    'Chrome flags are applied to the embedded Electron/CEF process, not your installed Google Chrome.':'A Chromium-indítási opciók a beépített Electron/CEF folyamatra vonatkoznak, nem a telepített Google Chrome-ra.',
    'Disable GPU acceleration only to troubleshoot rendering defects; Kirka.io 3D can become slow or stop working.':'Csak grafikai hibakereséshez kapcsold ki a GPU-gyorsítást; a Kirka.io 3D lassulhat vagy működésképtelenné válhat.',
    'ANGLE changes and GPU startup flags require restarting KS Client.':'Az ANGLE és a GPU indítási beállításai a KS Client újraindítását igénylik.',
    'Restart KS Client now':'KS Client újraindítása',
    'Restart and apply changes?':'Újraindítod a klienst a grafikai módosítások alkalmazásához?',
    'Reset browser settings':'Böngészőbeállítások visszaállítása',
    'Restore only these browser settings to defaults.':'A Electron/CEF beállításainak visszaállítása az alapértékekre.',
    'Reset all browser settings?':'Visszaállítod az összes böngészőbeállítást?',
    'Waiting for native Electron/CEF settings…':'A Electron/CEF beállításainak lekérése…',
    'GPU or ANGLE changes are pending a restart. The old backend is still active.':'A GPU- vagy ANGLE-módosítás újraindításra vár. A korábbi grafikus motor még aktív.',
    'Electron/CEF Browser Controls':'Electron/CEF böngészőfunkciók',
    'Context menu':'Jobb kattintásos menü',
    'Enable the native Electron/CEF right-click menu.':'A Electron/CEF saját jobb kattintásos menüjének bekapcsolása.',
    'Developer tools (F12)':'Fejlesztői eszközök (F12)',
    'Allow opening Chromium DevTools for debugging.':'A Chromium fejlesztői eszközeinek engedélyezése hibakereséshez.',
    'These settings use the native Electron/CEF Settings API. Some changes become fully visible after reloading the page.':'Ezek a Electron/CEF natív beállítási API-ját használják. Egyes módosítások oldalfrissítés után válnak teljesen láthatóvá.',
    'Electron/CEF GPU Diagnostics':'Electron/CEF GPU-diagnosztika',
    'Run WebGL checks on this exact embedded browser process.':'WebGL-teszt futtatása a kliens saját beépített böngészőjében.',
    'Run GPU check':'GPU-ellenőrzés indítása',
    'WebGL status':'WebGL állapota',
    'WebGL2 status':'WebGL2 állapota',
    'WebGL renderer':'WebGL megjelenítő',
    'Compositing status':'Kompozitálás állapota',
    'WebGL does not expose the Chromium compositing feature status. edge://gpu in standalone Edge is not a measurement of this KS Client process.':'A WebGL nem szolgáltat adatot a Chromium kompozitálási állapotáról. A külön futó Edge edge://gpu oldala nem a KS Client folyamatát méri.',
    'Supported':'Elérhető',
    'Unavailable':'Nem érhető el',
    'Not tested':'Nincs ellenőrizve',
    'Not checked':'Nincs ellenőrizve',
    'Not accessible from WebGL':'WebGL-ből nem lekérdezhető',
    'FPS indicator source':'FPS-mutató forrása',
    'Choose the browser callback counter or use the in-game counter supplied by Kirka.io.':'Válaszd a böngészős képkockahívás-mérést vagy a Kirka.io saját játékbeli FPS-mutatóját.',
    'KS Client browser FPS (rAF)':'KS Client böngészős FPS (rAF)',
    'Kirka.io own FPS (game setting)':'Kirka.io saját FPS (játékbeállítás)',
    'The Kirka.io FPS reader recognizes visible HTML text only, not FPS painted inside a WebGL canvas. If unavailable it shows no value; use the in-game counter.':'A KS Client nem tudja kiolvasni a Kirka.io belső FPS-adatát. Kirka.io módban a kliens FPS-kijelzője eltűnik; kapcsold be a játék saját FPS-mutatóját a játék beállításaiban.',
    'Browser animation callback FPS':'Böngészős animációhívások FPS-értéke',
    'Game engine FPS (Kirka.io)':'Játékmotor FPS (Kirka.io)',
    'Available only in the Kirka.io game settings, not accessible through Electron/CEF.':'Csak a Kirka.io játékbeállításaiban érhető el; Electron/CEF-n keresztül nem olvasható ki.',
    'Applied on browser startup':'Böngészőindításkor alkalmazva',
    'The Chromium engine chooses automatically.':'A Chromium motor automatikusan választ.',
    'Enable the ANGLE D3D11 graphics path.':'Az ANGLE D3D11 grafikus útvonalának engedélyezése.',
    'Try the ANGLE OpenGL graphics path; it may fail or be slower.':'Az ANGLE OpenGL útvonalának kipróbálása; hibát vagy lassulást okozhat.',
    'Changes are stored per Windows user. Restart is required only for GPU/ANGLE.':'A beállítások Windows-felhasználónként tárolódnak. Csak a GPU/ANGLE módosításokhoz kell újraindítás.',
  });

  Object.assign(hu, {
    "Frame Stability": "Képkockastabilitás",
    "Eye Comfort": "Szemkomfort",
    "Smooth Rendering": "Egyenletes megjelenítés",
    "Native / no extra cap": "Natív / külön korlátozás nélkül",
    "Comfort – 120 FPS": "Kényelmes – 120 FPS",
    "Balanced – 144 FPS": "Kiegyensúlyozott – 144 FPS",
    "High Smoothness – 165 FPS": "Folyamatos – 165 FPS",
    "Smoothness profile": "Megjelenítési profil",
    "Choose a browser callback pacing target. It cannot guarantee the displayed GPU frame rate.": "Válassz böngészős képkockahívási célértéket. A kijelző tényleges GPU-FPS-ét nem garantálja.",
    "Native resolution / Pixel Perfect": "Natív felbontás / Pixel Perfect",
    "Use native monitor scaling": "Natív monitorméretezés alkalmazása",
    "Resets page zoom to 100%; does not change the game engine framebuffer.": "A böngésző oldalnagyítását 100%-ra állítja; a játékmotor képkockapufferét nem módosítja.",
    "Frame Stability Monitor": "Képkockastabilitás-figyelő",
    "Measures browser animation intervals, not GPU presentation or Kirka.io engine frames.": "A böngésző animációs időközeit méri, nem a GPU megjelenített képkockáit vagy a Kirka.io motorját.",
    "Median frame interval": "Medián képkockaidő",
    "95th-percentile interval": "95. percentilis idő",
    "Browser interval jitter": "Böngészős időingadozás",
    "Long intervals": "Hosszú képkockaidők",
    "Not enough samples": "Még nincs elég mérési adat",
    "Intervals over 1.5× median during visible playback. A browser measurement, not confirmed stutter in the game.": "Látható lejátszás közben a medián 1,5-szeresénél hosszabb időközök. Böngészős mérés, nem igazolt játékbeli akadozás.",
    "Anti-aliasing / WebGL inspector": "Élsimítás / WebGL-vizsgálat",
    "Inspect observed game WebGL contexts": "A játék észlelt WebGL-környezetének vizsgálata",
    "AA requested": "Kért élsimítás",
    "AA reported": "Jelzett élsimítás",
    "Canvas resolution": "Canvas-felbontás",
    "No game WebGL context observed yet": "A játék WebGL-környezete még nem észlelhető",
    "Unknown (not observed)": "Ismeretlen (nincs adat)",
    "Enabled": "Bekapcsolva",
    "Disabled": "Kikapcsolva",
    "No game engine AA override is applied.": "A játék élsimítását a kliens nem írja felül.",
    "Adaptive Sync & Camera Comfort": "Adaptív szinkron és kamerakényelem",
    "Check G-SYNC Compatible / FreeSync in your monitor and GPU driver settings; the client cannot switch these on itself.": "A G-SYNC Compatible / FreeSync funkciót a monitor és a videokártya illesztőprogramjának beállításaiban ellenőrizd; a kliens nem tudja helyetted bekapcsolni.",
    "For more comfortable camera movement, test a lower in-game mouse sensitivity and FOV if Kirka.io offers it. The client does not alter your camera input.": "Kényelmesebb kameramozgáshoz próbálj alacsonyabb játékbeli egérérzékenységet és FOV-ot, ha a Kirka.io támogatja. A kliens nem módosítja a kamera bemenetét.",
    "Color and Softness": "Színek és lágyítás",
    "Optional canvas-only CSS filters; not true anti-aliasing and may lower performance.": "Opcionális, csak a játék canvasára ható CSS-szűrők; nem valódi élsimítás, és csökkenthetik a teljesítményt.",
    "Enable comfort filters": "Szemkomfort-szűrők engedélyezése",
    "Changes color and optional softness of the game canvas only.": "Csak a játék canvasának színeit és opcionális lágyítását módosítja.",
    "Comfort preset": "Szemkomfortprofil",
    "Normal (no filter)": "Normál (szűrő nélkül)",
    "Soft": "Lágy",
    "Warm": "Meleg",
    "Custom settings": "Egyéni beállítások",
    "Brightness": "Fényerő",
    "Contrast": "Kontraszt",
    "Saturation": "Színtelítettség",
    "Warmth": "Meleg tónus",
    "Softness (CSS blur)": "Lágyítás (CSS-elmosás)",
    "Off": "Kikapcsolva",
    "Every 20 minutes": "20 percenként",
    "Every 30 minutes": "30 percenként",
    "Every 45 minutes": "45 percenként",
    "Every 60 minutes": "60 percenként",
    "Optional break reminder": "Opcionális szünetemlékeztető",
    "Counts visible gameplay minutes only; does not interrupt the game or collect data.": "Csak a látható játékmenet perceit számolja; nem szakítja meg a játékot és nem gyűjt adatot.",
    "Comfort filter preview": "Szemkomfort-szűrő előnézete",
    "Filter preview is illustrative. It does not apply until enabled.": "A szűrő-előnézet szemléltető jellegű. Engedélyezésig nem változik a játék.",
    "Take a short visual break. Look away from the screen for a moment.": "Tarts egy rövid szemkímélő szünetet! Nézz el a képernyőről egy kis időre.",
    "Settings menu scale": "Beállításmenü mérete",
    "Scale updates only when you release the slider to avoid repeated repaints.": "Az új méret csak a csúszka elengedésekor lép életbe, hogy ne akadjon a felület.",
    "Pixel-perfect mode uses native display scaling. WebGL anti-aliasing and internal render scale remain controlled by Kirka.io.": "A Pixel Perfect mód natív kijelzőskálázást használ. A WebGL élsimítását és a belső renderfelbontást továbbra is a Kirka.io szabályozza.",
    "Frame pacing, gentle canvas color filters, optional break reminders and visual diagnostics.": "Képkocka-időzítés, enyhe canvas-színszűrők, opcionális szünetemlékeztetők és képi diagnosztika.",
    "Use cautiously: CSS blur can make text less sharp and may add GPU work. Start with softness 0.": "Óvatosan használd: a CSS-elmosás életlenebbé teheti a szöveget és növelheti a GPU terhelését. Kezdd 0-s lágyítással.",
    "Browser timing spikes may indicate frame pacing problems; they do not prove the game actually stuttered.": "A böngészős időzítési kiugrások képkockaütemezési problémát jelezhetnek, de önmagukban nem bizonyítják a játék akadozását.",
    "Use this to compare FPS settings in the same scene; do not treat it as GPU frame presentation data.": "Azonos jelenetben összehasonlíthatod az FPS-beállításokat; ez nem a GPU tényleges megjelenítési adata."
});

  Object.assign(hu, {
    'Experimental Unlimited FPS (Chromium)': 'Kísérleti korlátlan FPS (Chromium)',
    'Activate Unlimited FPS': 'Korlátlan FPS aktiválása',
    'Enable experimental unlock': 'Kísérleti feloldás engedélyezése',
    'Requests Chromium FPS unlocking and removes the KS JavaScript callback cap. Restart required; actual Kirka.io FPS is not guaranteed above monitor Hz.': 'Kéri a Chromium FPS-feloldását és megszünteti a KS JavaScript-korlátját. Újraindítás kell; a Kirka.io tényleges FPS-értéke nem garantált a monitor Hz-e fölött.',
    'Attempts to remove Chromium rAF/vsync limits. Requires a restart and may cause tearing, higher CPU load or network input delays.': 'Megpróbálja feloldani a Chromium rAF/VSync korlátját. Újraindítást igényel; képtörést, nagyobb CPU-terhelést vagy hálózati/egérkésést okozhat.',
    'Unlimited here only removes the KS JavaScript cap. For above-monitor-Hz FPS enable Experimental Chromium Uncap below and restart.': 'A korlátlan mód itt csak a KS JavaScript-korlátját oldja fel. A monitor Hz-értéke fölötti FPS kipróbálásához engedélyezd lent a kísérleti Chromium-feloldást, majd indítsd újra a klienst.',
    'Experimental uncap is a Electron/CEF startup request; the browser may ignore it. Test the Kirka.io in-game FPS counter (Show FPS, typically I).': 'A kísérleti feloldás a Electron/CEF-nek küldött indítási kérés; a böngésző figyelmen kívül hagyhatja. Ellenőrizd a Kirka.io saját FPS-mutatójával (Show FPS, általában I).',
    'Requested on startup': 'Indításkor kérve',
    'Off / normal sync': 'Ki / normál szinkron',
    'Kirka.io HUD FPS (HTML only, experimental)': 'Kirka.io HUD FPS (csak HTML, kísérleti)',
    'Kirka.io game FPS (native HUD)': 'Kirka.io játékbeli FPS (saját HUD)',
    'The Kirka.io FPS reader recognizes visible HTML text only, not FPS painted inside a WebGL canvas. If unavailable it shows no value; use the in-game counter.': 'A Kirka.io FPS-olvasó csak látható HTML-szöveget ismer fel, WebGL-canvasra rajzolt FPS-t nem. Ha nem érhető el, nem mutat számot; használd a játék saját kijelzőjét.',
    'Game FPS detected from HTML': 'Játék-FPS HTML-ből felismerve',
    'Kirka.io HUD FPS unavailable (possibly drawn on canvas)': 'A Kirka.io HUD FPS nem olvasható (lehet, hogy canvasra rajzolt)',
    'The game FPS indicator can be enabled in Kirka.io (Show FPS, usually I). Auto-reading only works for DOM/HTML text, not WebGL canvas.': 'A Kirka.io saját FPS-mutatója a játékban bekapcsolható (Show FPS, általában I). Automatikus kiolvasás csak DOM/HTML-szövegből működik, WebGL-canvasból nem.',
    'Browser FPS unlock': 'Böngészős FPS-feloldás',
    'Your selected engine startup request': 'A jelenlegi Electron/CEF indítási kérés',
    'Kirka HUD FPS value': 'Kirka HUD FPS-érték',
    'Searching visible HTML for FPS…': 'Látható HTML-ben FPS keresése…',
    'Enable experimental uncapped FPS in Performance or Browser Graphics. Restart required.': 'Kapcsold be a kísérleti korlátlan FPS-t a Teljesítmény vagy a Böngésző grafika részben. Újraindítás szükséges.'
  });

  Object.assign(hu,{
    'Workshop':'Műhely',
    'Weapon Studio':'Fegyverkészítő fegyver skin kinezet',
    'Resource Swapper':'Erőforráscsere eroforras csere',
    'Plugins':'Bővítmények',
    'Lobby':'Lobby',
    'Friends & Profiles':'Barátok és profilok baratok profilok',
    'Inventory & Market':'Raktár és piac raktar piac keszlet',
    'Keystroke position':'Billentyűkijelző helye',
    'Keystroke size':'Billentyűkijelző mérete',
    'Colored killfeed':'Színes találatlista',
    'Optional hitmarker image (HTTPS)':'Egyedi találatjelző-kép (HTTPS)'
  });
  Object.assign(hu,{
    'Import Kirka.io session (advanced)':'Kirka.io munkamenet importálása (haladó)',
    'Import session locally':'Munkamenet helyi importálása',
    'Kirka.io token (keep secret)':'Kirka.io token (titkos)',
    'I understand that a session token grants access to my Kirka account.':'Tudom, hogy a munkamenet-token hozzáférést ad a Kirka-fiókomhoz.',
    'Only the Kirka.io game page can import its own session.':'Csak a Kirka.io játékoldal importálhat munkamenetet.',
    'Confirm the security warning first.':'Előbb fogadd el a biztonsági figyelmeztetést.',
    'Invalid session format. Nothing was changed.':'Érvénytelen munkamenet-formátum. Semmi nem változott.',
    'Replace the current Kirka.io session on this engine?':'Felülírjuk az aktuális Kirka-munkamenetet ennél a motornál?',
    'Cancelled. Current session preserved.':'Megszakítva. A jelenlegi munkamenet megmaradt.',
    'Session stored locally. Reloading so Kirka can validate it.':'Munkamenet elmentve. Újratöltés után a Kirka ellenőrzi.',
    'Local import failed. No credentials were transmitted.':'Helyi importálás sikertelen. Nincs továbbított hitelesítő adat.'
  });
  // Settings-only translations; native Windows Setup/Uninstaller stay English.
  // Rare advanced diagnostics safely fall back to English, never machine-guess.
  const extraLocales={"de":{"Settings":"Einstellungen","SETTINGS":"EINSTELLUNGEN","Graphics":"Grafik","Display":"Anzeige","Gameplay":"Spiel","Workshop":"Werkstatt","Controls":"Steuerung","Interface":"Oberfläche","Advanced":"Erweitert","Performance":"Leistung","Frame Stability":"Bildstabilität","Browser Graphics":"Browsergrafik","Browser GPU Info":"Browser-GPU-Info","Eye Comfort":"Augenschonung","Crosshair":"Fadenkreuz","Game Integration":"Spielintegration","Lobby":"Lobby","Friends & Profiles":"Freunde & Profile","Weapon Studio":"Waffenstudio","Resource Swapper":"Ressourcenaustausch","Plugins":"Plugins","Inventory & Market":"Inventar & Markt","Browser Controls":"Browsersteuerung","Appearance":"Darstellung","Resources":"Ressourcen","CSS Editor":"CSS-Editor","General":"Allgemein","Updates":"Updates","Sharing":"Teilen","Diagnostics":"Diagnose","Language":"Sprache","Current version":"Aktuelle Version","Settings Backup & Language":"Sicherung & Sprache","Settings import/export":"Einstellungen importieren/exportieren","Export settings":"Einstellungen exportieren","Import settings":"Einstellungen importieren","Reset to Default":"Zurücksetzen","Cancel":"Abbrechen","Apply":"Übernehmen","Changes preview instantly":"Änderungen sofort sichtbar","Customize your game experience":"Passe dein Spielerlebnis an","Search settings":"Einstellungen suchen","No matching settings. Try another term.":"Keine Treffer. Anderes Wort versuchen.","FPS Limiter":"FPS-Begrenzung","Unlimited / Native":"Unbegrenzt / Nativ","Activate Unlimited FPS":"Unbegrenzte FPS aktivieren","Enable experimental unlock":"Experimentelle Freigabe aktivieren","Experimental Unlimited FPS (Chromium)":"Experimentelle unbegrenzte FPS","Restart KS Client now":"KS Client jetzt neu starten","FPS unlock verification":"FPS-Freigabe prüfen","Observed browser animation rate":"Gemessene Animationsrate","Low":"Niedrig","Medium":"Mittel","High":"Hoch","Balanced":"Ausgeglichen","High Performance":"Hohe Leistung","Low Latency Mode":"Modus mit geringer Latenz","UI Animations":"Oberflächenanimationen","Show FPS":"FPS anzeigen","Custom Crosshair":"Eigenes Fadenkreuz","Enable custom crosshair":"Fadenkreuz aktivieren","Crosshair color":"Fadenkreuzfarbe","Shape":"Form","Size":"Größe","Color":"Farbe","Opacity":"Deckkraft","Brightness":"Helligkeit","Contrast":"Kontrast","Saturation":"Sättigung","Warmth":"Wärme","Optional break reminder":"Pausenerinnerung","Client theme":"Client-Design","Color palette":"Farbpalette","Background color":"Hintergrundfarbe","Text color":"Textfarbe","Font family":"Schriftart","Menu animations":"Menüanimationen","Automatic updates":"Automatische Updates","Check for updates":"Nach Updates suchen","Install update & restart":"Update installieren und neu starten","Automatically check for updates":"Automatisch nach Updates suchen","Download updates automatically":"Updates automatisch herunterladen","Update channel":"Update-Kanal","Borderless fullscreen":"Randloses Vollbild","Toggle fullscreen · F11":"Vollbild umschalten · F11","Open log folder":"Protokollordner öffnen"},"fr":{"Settings":"Paramètres","SETTINGS":"PARAMÈTRES","Graphics":"Graphismes","Display":"Affichage","Gameplay":"Jeu","Workshop":"Atelier","Controls":"Commandes","Interface":"Interface","Advanced":"Avancé","Performance":"Performances","Frame Stability":"Stabilité des images","Browser Graphics":"Graphismes du navigateur","Browser GPU Info":"Infos GPU du navigateur","Eye Comfort":"Confort visuel","Crosshair":"Réticule","Game Integration":"Intégration au jeu","Lobby":"Salon","Friends & Profiles":"Amis et profils","Weapon Studio":"Studio d'armes","Resource Swapper":"Remplacement de ressources","Plugins":"Extensions","Inventory & Market":"Inventaire et marché","Browser Controls":"Contrôles du navigateur","Appearance":"Apparence","Resources":"Ressources","CSS Editor":"Éditeur CSS","General":"Général","Updates":"Mises à jour","Sharing":"Partage","Diagnostics":"Diagnostics","Language":"Langue","Current version":"Version actuelle","Settings Backup & Language":"Sauvegarde et langue","Settings import/export":"Importer/exporter les paramètres","Export settings":"Exporter les paramètres","Import settings":"Importer les paramètres","Reset to Default":"Réinitialiser","Cancel":"Annuler","Apply":"Appliquer","Changes preview instantly":"Aperçu instantané","Customize your game experience":"Personnalisez votre jeu","Search settings":"Rechercher un paramètre","No matching settings. Try another term.":"Aucun résultat. Essayez un autre mot.","FPS Limiter":"Limiteur de FPS","Unlimited / Native":"Illimité / Natif","Activate Unlimited FPS":"Activer les FPS illimités","Enable experimental unlock":"Activer le déverrouillage expérimental","Experimental Unlimited FPS (Chromium)":"FPS illimités expérimentaux","Restart KS Client now":"Redémarrer KS Client","FPS unlock verification":"Vérification du déverrouillage FPS","Observed browser animation rate":"Fréquence d'animation mesurée","Low":"Faible","Medium":"Moyen","High":"Élevé","Balanced":"Équilibré","High Performance":"Performances élevées","Low Latency Mode":"Mode faible latence","UI Animations":"Animations de l'interface","Show FPS":"Afficher les FPS","Custom Crosshair":"Réticule personnalisé","Enable custom crosshair":"Activer le réticule","Crosshair color":"Couleur du réticule","Shape":"Forme","Size":"Taille","Color":"Couleur","Opacity":"Opacité","Brightness":"Luminosité","Contrast":"Contraste","Saturation":"Saturation","Warmth":"Chaleur","Optional break reminder":"Rappel de pause","Client theme":"Thème du client","Color palette":"Palette de couleurs","Background color":"Couleur d'arrière-plan","Text color":"Couleur du texte","Font family":"Police","Menu animations":"Animations du menu","Automatic updates":"Mises à jour automatiques","Check for updates":"Rechercher des mises à jour","Install update & restart":"Installer et redémarrer","Automatically check for updates":"Vérifier les mises à jour automatiquement","Download updates automatically":"Télécharger automatiquement les mises à jour","Update channel":"Canal de mise à jour","Borderless fullscreen":"Plein écran sans bordure","Toggle fullscreen · F11":"Activer le plein écran · F11","Open log folder":"Ouvrir les journaux"},"es":{"Settings":"Configuración","SETTINGS":"CONFIGURACIÓN","Graphics":"Gráficos","Display":"Pantalla","Gameplay":"Juego","Workshop":"Taller","Controls":"Controles","Interface":"Interfaz","Advanced":"Avanzado","Performance":"Rendimiento","Frame Stability":"Estabilidad de fotogramas","Browser Graphics":"Gráficos del navegador","Browser GPU Info":"Información de GPU","Eye Comfort":"Confort visual","Crosshair":"Mira","Game Integration":"Integración del juego","Lobby":"Sala","Friends & Profiles":"Amigos y perfiles","Weapon Studio":"Estudio de armas","Resource Swapper":"Intercambio de recursos","Plugins":"Complementos","Inventory & Market":"Inventario y mercado","Browser Controls":"Controles del navegador","Appearance":"Apariencia","Resources":"Recursos","CSS Editor":"Editor CSS","General":"General","Updates":"Actualizaciones","Sharing":"Compartir","Diagnostics":"Diagnóstico","Language":"Idioma","Current version":"Versión actual","Settings Backup & Language":"Copia de seguridad e idioma","Settings import/export":"Importar/exportar ajustes","Export settings":"Exportar ajustes","Import settings":"Importar ajustes","Reset to Default":"Restablecer","Cancel":"Cancelar","Apply":"Aplicar","Changes preview instantly":"Vista previa inmediata","Customize your game experience":"Personaliza tu juego","Search settings":"Buscar ajustes","No matching settings. Try another term.":"Sin resultados. Prueba otra palabra.","FPS Limiter":"Límite de FPS","Unlimited / Native":"Ilimitado / Nativo","Activate Unlimited FPS":"Activar FPS ilimitados","Enable experimental unlock":"Activar desbloqueo experimental","Experimental Unlimited FPS (Chromium)":"FPS ilimitados experimentales","Restart KS Client now":"Reiniciar KS Client","FPS unlock verification":"Verificar desbloqueo FPS","Observed browser animation rate":"Frecuencia de animación","Low":"Bajo","Medium":"Medio","High":"Alto","Balanced":"Equilibrado","High Performance":"Alto rendimiento","Low Latency Mode":"Modo de baja latencia","UI Animations":"Animaciones de interfaz","Show FPS":"Mostrar FPS","Custom Crosshair":"Mira personalizada","Enable custom crosshair":"Activar mira","Crosshair color":"Color de mira","Shape":"Forma","Size":"Tamaño","Color":"Color","Opacity":"Opacidad","Brightness":"Brillo","Contrast":"Contraste","Saturation":"Saturación","Warmth":"Calidez","Optional break reminder":"Recordatorio de descanso","Client theme":"Tema del cliente","Color palette":"Paleta de colores","Background color":"Color de fondo","Text color":"Color del texto","Font family":"Fuente","Menu animations":"Animaciones de menú","Automatic updates":"Actualizaciones automáticas","Check for updates":"Buscar actualizaciones","Install update & restart":"Instalar y reiniciar","Automatically check for updates":"Buscar actualizaciones automáticamente","Download updates automatically":"Descargar actualizaciones automáticamente","Update channel":"Canal de actualización","Borderless fullscreen":"Pantalla completa sin bordes","Toggle fullscreen · F11":"Alternar pantalla completa · F11","Open log folder":"Abrir carpeta de registros"},"pt":{"Settings":"Configurações","SETTINGS":"CONFIGURAÇÕES","Graphics":"Gráficos","Display":"Ecrã","Gameplay":"Jogo","Workshop":"Oficina","Controls":"Controlos","Interface":"Interface","Advanced":"Avançado","Performance":"Desempenho","Frame Stability":"Estabilidade dos fotogramas","Browser Graphics":"Gráficos do navegador","Browser GPU Info":"Informações da GPU","Eye Comfort":"Conforto visual","Crosshair":"Mira","Game Integration":"Integração do jogo","Lobby":"Lobby","Friends & Profiles":"Amigos e perfis","Weapon Studio":"Estúdio de armas","Resource Swapper":"Troca de recursos","Plugins":"Plugins","Inventory & Market":"Inventário e mercado","Browser Controls":"Controlos do navegador","Appearance":"Aparência","Resources":"Recursos","CSS Editor":"Editor CSS","General":"Geral","Updates":"Atualizações","Sharing":"Partilha","Diagnostics":"Diagnóstico","Language":"Idioma","Current version":"Versão atual","Settings Backup & Language":"Cópia e idioma","Settings import/export":"Importar/exportar definições","Export settings":"Exportar definições","Import settings":"Importar definições","Reset to Default":"Repor padrões","Cancel":"Cancelar","Apply":"Aplicar","Changes preview instantly":"Pré-visualização imediata","Customize your game experience":"Personaliza o teu jogo","Search settings":"Pesquisar definições","No matching settings. Try another term.":"Sem resultados. Tenta outra palavra.","FPS Limiter":"Limite de FPS","Unlimited / Native":"Ilimitado / Nativo","Activate Unlimited FPS":"Ativar FPS ilimitados","Enable experimental unlock":"Ativar desbloqueio experimental","Experimental Unlimited FPS (Chromium)":"FPS ilimitados experimentais","Restart KS Client now":"Reiniciar KS Client","FPS unlock verification":"Verificar desbloqueio FPS","Observed browser animation rate":"Frequência de animação","Low":"Baixo","Medium":"Médio","High":"Alto","Balanced":"Equilibrado","High Performance":"Alto desempenho","Low Latency Mode":"Modo de baixa latência","UI Animations":"Animações da interface","Show FPS":"Mostrar FPS","Custom Crosshair":"Mira personalizada","Enable custom crosshair":"Ativar mira","Crosshair color":"Cor da mira","Shape":"Forma","Size":"Tamanho","Color":"Cor","Opacity":"Opacidade","Brightness":"Brilho","Contrast":"Contraste","Saturation":"Saturação","Warmth":"Calor","Optional break reminder":"Lembrete de pausa","Client theme":"Tema do cliente","Color palette":"Paleta de cores","Background color":"Cor de fundo","Text color":"Cor do texto","Font family":"Tipo de letra","Menu animations":"Animações do menu","Automatic updates":"Atualizações automáticas","Check for updates":"Procurar atualizações","Install update & restart":"Instalar e reiniciar","Automatically check for updates":"Procurar atualizações automaticamente","Download updates automatically":"Transferir atualizações automaticamente","Update channel":"Canal de atualização","Borderless fullscreen":"Ecrã inteiro sem bordas","Toggle fullscreen · F11":"Alternar ecrã inteiro · F11","Open log folder":"Abrir pasta de registos"},"it":{"Settings":"Impostazioni","SETTINGS":"IMPOSTAZIONI","Graphics":"Grafica","Display":"Schermo","Gameplay":"Gioco","Workshop":"Laboratorio","Controls":"Controlli","Interface":"Interfaccia","Advanced":"Avanzate","Performance":"Prestazioni","Frame Stability":"Stabilità fotogrammi","Browser Graphics":"Grafica browser","Browser GPU Info":"Informazioni GPU","Eye Comfort":"Comfort visivo","Crosshair":"Mirino","Game Integration":"Integrazione gioco","Lobby":"Lobby","Friends & Profiles":"Amici e profili","Weapon Studio":"Studio armi","Resource Swapper":"Sostituzione risorse","Plugins":"Plugin","Inventory & Market":"Inventario e mercato","Browser Controls":"Controlli browser","Appearance":"Aspetto","Resources":"Risorse","CSS Editor":"Editor CSS","General":"Generale","Updates":"Aggiornamenti","Sharing":"Condivisione","Diagnostics":"Diagnostica","Language":"Lingua","Current version":"Versione attuale","Settings Backup & Language":"Backup e lingua","Settings import/export":"Importa/esporta impostazioni","Export settings":"Esporta impostazioni","Import settings":"Importa impostazioni","Reset to Default":"Ripristina","Cancel":"Annulla","Apply":"Applica","Changes preview instantly":"Anteprima immediata","Customize your game experience":"Personalizza il gioco","Search settings":"Cerca impostazioni","No matching settings. Try another term.":"Nessun risultato. Prova un altro termine.","FPS Limiter":"Limite FPS","Unlimited / Native":"Illimitato / Nativo","Activate Unlimited FPS":"Attiva FPS illimitati","Enable experimental unlock":"Abilita sblocco sperimentale","Experimental Unlimited FPS (Chromium)":"FPS illimitati sperimentali","Restart KS Client now":"Riavvia KS Client","FPS unlock verification":"Verifica sblocco FPS","Observed browser animation rate":"Frequenza animazione","Low":"Basso","Medium":"Medio","High":"Alto","Balanced":"Bilanciato","High Performance":"Prestazioni elevate","Low Latency Mode":"Modalità bassa latenza","UI Animations":"Animazioni interfaccia","Show FPS":"Mostra FPS","Custom Crosshair":"Mirino personalizzato","Enable custom crosshair":"Attiva mirino","Crosshair color":"Colore mirino","Shape":"Forma","Size":"Dimensione","Color":"Colore","Opacity":"Opacità","Brightness":"Luminosità","Contrast":"Contrasto","Saturation":"Saturazione","Warmth":"Calore","Optional break reminder":"Promemoria pausa","Client theme":"Tema del client","Color palette":"Tavolozza colori","Background color":"Colore sfondo","Text color":"Colore testo","Font family":"Tipo di carattere","Menu animations":"Animazioni menu","Automatic updates":"Aggiornamenti automatici","Check for updates":"Controlla aggiornamenti","Install update & restart":"Installa e riavvia","Automatically check for updates":"Controllo automatico aggiornamenti","Download updates automatically":"Scarica aggiornamenti automaticamente","Update channel":"Canale aggiornamenti","Borderless fullscreen":"Schermo intero senza bordi","Toggle fullscreen · F11":"Attiva schermo intero · F11","Open log folder":"Apri cartella log"},"ru":{"Settings":"Настройки","SETTINGS":"НАСТРОЙКИ","Graphics":"Графика","Display":"Экран","Gameplay":"Игра","Workshop":"Мастерская","Controls":"Управление","Interface":"Интерфейс","Advanced":"Дополнительно","Performance":"Производительность","Frame Stability":"Стабильность кадров","Browser Graphics":"Графика браузера","Browser GPU Info":"Информация о GPU","Eye Comfort":"Комфорт для глаз","Crosshair":"Прицел","Game Integration":"Интеграция с игрой","Lobby":"Лобби","Friends & Profiles":"Друзья и профили","Weapon Studio":"Оружейная студия","Resource Swapper":"Замена ресурсов","Plugins":"Плагины","Inventory & Market":"Инвентарь и рынок","Browser Controls":"Управление браузером","Appearance":"Внешний вид","Resources":"Ресурсы","CSS Editor":"Редактор CSS","General":"Общие","Updates":"Обновления","Sharing":"Обмен","Diagnostics":"Диагностика","Language":"Язык","Current version":"Текущая версия","Settings Backup & Language":"Резервная копия и язык","Settings import/export":"Импорт и экспорт настроек","Export settings":"Экспорт настроек","Import settings":"Импорт настроек","Reset to Default":"Сбросить","Cancel":"Отмена","Apply":"Применить","Changes preview instantly":"Предпросмотр сразу","Customize your game experience":"Настройте свою игру","Search settings":"Поиск настроек","No matching settings. Try another term.":"Ничего не найдено. Попробуйте другое слово.","FPS Limiter":"Ограничение FPS","Unlimited / Native":"Без ограничений / Стандарт","Activate Unlimited FPS":"Включить FPS без ограничений","Enable experimental unlock":"Включить экспериментальный режим","Experimental Unlimited FPS (Chromium)":"Экспериментальный FPS без ограничений","Restart KS Client now":"Перезапустить KS Client","FPS unlock verification":"Проверка снятия лимита FPS","Observed browser animation rate":"Частота анимации браузера","Low":"Низкий","Medium":"Средний","High":"Высокий","Balanced":"Сбалансированный","High Performance":"Высокая производительность","Low Latency Mode":"Режим низкой задержки","UI Animations":"Анимации интерфейса","Show FPS":"Показать FPS","Custom Crosshair":"Настраиваемый прицел","Enable custom crosshair":"Включить прицел","Crosshair color":"Цвет прицела","Shape":"Форма","Size":"Размер","Color":"Цвет","Opacity":"Непрозрачность","Brightness":"Яркость","Contrast":"Контраст","Saturation":"Насыщенность","Warmth":"Теплота","Optional break reminder":"Напоминание о перерыве","Client theme":"Тема клиента","Color palette":"Палитра цветов","Background color":"Цвет фона","Text color":"Цвет текста","Font family":"Шрифт","Menu animations":"Анимации меню","Automatic updates":"Автообновление","Check for updates":"Проверить обновления","Install update & restart":"Установить и перезапустить","Automatically check for updates":"Автоматически проверять обновления","Download updates automatically":"Автоматически загружать обновления","Update channel":"Канал обновлений","Borderless fullscreen":"Полный экран без рамок","Toggle fullscreen · F11":"Полный экран · F11","Open log folder":"Открыть папку журналов"},"zh":{"Settings":"设置","SETTINGS":"设置","Graphics":"图形","Display":"显示","Gameplay":"游戏","Workshop":"工坊","Controls":"控制","Interface":"界面","Advanced":"高级","Performance":"性能","Frame Stability":"帧稳定性","Browser Graphics":"浏览器图形","Browser GPU Info":"浏览器 GPU 信息","Eye Comfort":"护眼","Crosshair":"准星","Game Integration":"游戏集成","Lobby":"大厅","Friends & Profiles":"好友与资料","Weapon Studio":"武器工坊","Resource Swapper":"资源替换","Plugins":"插件","Inventory & Market":"背包与市场","Browser Controls":"浏览器控制","Appearance":"外观","Resources":"资源","CSS Editor":"CSS 编辑器","General":"常规","Updates":"更新","Sharing":"共享","Diagnostics":"诊断","Language":"语言","Current version":"当前版本","Settings Backup & Language":"设置备份与语言","Settings import/export":"导入/导出设置","Export settings":"导出设置","Import settings":"导入设置","Reset to Default":"恢复默认","Cancel":"取消","Apply":"应用","Changes preview instantly":"即时预览更改","Customize your game experience":"自定义游戏体验","Search settings":"搜索设置","No matching settings. Try another term.":"无结果，请换个关键词。","FPS Limiter":"FPS 限制","Unlimited / Native":"无限制 / 原生","Activate Unlimited FPS":"启用无限 FPS","Enable experimental unlock":"启用实验性解锁","Experimental Unlimited FPS (Chromium)":"实验性无限 FPS","Restart KS Client now":"立即重启 KS Client","FPS unlock verification":"FPS 解锁验证","Observed browser animation rate":"浏览器动画速率","Low":"低","Medium":"中","High":"高","Balanced":"平衡","High Performance":"高性能","Low Latency Mode":"低延迟模式","UI Animations":"界面动画","Show FPS":"显示 FPS","Custom Crosshair":"自定义准星","Enable custom crosshair":"启用自定义准星","Crosshair color":"准星颜色","Shape":"形状","Size":"大小","Color":"颜色","Opacity":"不透明度","Brightness":"亮度","Contrast":"对比度","Saturation":"饱和度","Warmth":"色温","Optional break reminder":"休息提醒","Client theme":"客户端主题","Color palette":"调色板","Background color":"背景颜色","Text color":"文本颜色","Font family":"字体","Menu animations":"菜单动画","Automatic updates":"自动更新","Check for updates":"检查更新","Install update & restart":"安装并重启","Automatically check for updates":"自动检查更新","Download updates automatically":"自动下载更新","Update channel":"更新频道","Borderless fullscreen":"无边框全屏","Toggle fullscreen · F11":"切换全屏 · F11","Open log folder":"打开日志文件夹"},"ja":{"Settings":"設定","SETTINGS":"設定","Graphics":"グラフィック","Display":"表示","Gameplay":"ゲーム","Workshop":"ワークショップ","Controls":"操作","Interface":"インターフェース","Advanced":"詳細","Performance":"パフォーマンス","Frame Stability":"フレーム安定性","Browser Graphics":"ブラウザー描画","Browser GPU Info":"ブラウザー GPU 情報","Eye Comfort":"目の快適さ","Crosshair":"クロスヘア","Game Integration":"ゲーム連携","Lobby":"ロビー","Friends & Profiles":"フレンドとプロフィール","Weapon Studio":"武器スタジオ","Resource Swapper":"リソース置換","Plugins":"プラグイン","Inventory & Market":"インベントリと市場","Browser Controls":"ブラウザー操作","Appearance":"外観","Resources":"リソース","CSS Editor":"CSS エディター","General":"一般","Updates":"更新","Sharing":"共有","Diagnostics":"診断","Language":"言語","Current version":"現在のバージョン","Settings Backup & Language":"設定バックアップと言語","Settings import/export":"設定のインポート・エクスポート","Export settings":"設定を書き出す","Import settings":"設定を読み込む","Reset to Default":"初期設定に戻す","Cancel":"キャンセル","Apply":"適用","Changes preview instantly":"変更をすぐにプレビュー","Customize your game experience":"ゲーム体験をカスタマイズ","Search settings":"設定を検索","No matching settings. Try another term.":"見つかりません。別の単語を試してください。","FPS Limiter":"FPS 上限","Unlimited / Native":"無制限 / 標準","Activate Unlimited FPS":"無制限 FPS を有効化","Enable experimental unlock":"実験的解除を有効化","Experimental Unlimited FPS (Chromium)":"実験的な無制限 FPS","Restart KS Client now":"KS Client を再起動","FPS unlock verification":"FPS 制限解除の確認","Observed browser animation rate":"ブラウザー描画頻度","Low":"低","Medium":"中","High":"高","Balanced":"バランス","High Performance":"高パフォーマンス","Low Latency Mode":"低遅延モード","UI Animations":"UI アニメーション","Show FPS":"FPS を表示","Custom Crosshair":"カスタムクロスヘア","Enable custom crosshair":"クロスヘアを有効化","Crosshair color":"クロスヘアの色","Shape":"形","Size":"サイズ","Color":"色","Opacity":"不透明度","Brightness":"明るさ","Contrast":"コントラスト","Saturation":"彩度","Warmth":"暖かさ","Optional break reminder":"休憩リマインダー","Client theme":"クライアントのテーマ","Color palette":"カラーパレット","Background color":"背景色","Text color":"文字色","Font family":"フォント","Menu animations":"メニューアニメーション","Automatic updates":"自動更新","Check for updates":"更新を確認","Install update & restart":"更新をインストールして再起動","Automatically check for updates":"自動更新チェック","Download updates automatically":"更新を自動ダウンロード","Update channel":"更新チャンネル","Borderless fullscreen":"ボーダーレス全画面","Toggle fullscreen · F11":"全画面切り替え · F11","Open log folder":"ログフォルダーを開く"}};
  Object.assign(hu,{
    'Reset to Default':'Alapértékek visszaállítása',
    'Cancel':'Mégse','Apply':'Alkalmaz',
    'Changes preview instantly':'A változások azonnal látszanak',
    'Customize your game experience':'Szabd személyre a játékélményt',
    'Search settings':'Beállítások keresése',
    'SETTINGS':'BEÁLLÍTÁSOK',
    'No matching settings. Try another term.':'Nincs találat. Próbálj másik kifejezést.'
  });
  function L(input) {
    const str=String(input ?? '');
    if(state.language==='en')return str;
    const v=str.trim();
    if(state.language!=='hu') {
      const dict=extraLocales[state.language];
      return dict && Object.hasOwn(dict,v) ? str.replace(v,dict[v]) : str;
    }
    if(Object.hasOwn(hu,v))return str.replace(v,hu[v]);
    let m;
    if((m=/^Imported (\d+) settings\. Review Custom CSS before enabling it\.$/.exec(v)))
      return `${m[1]} beállítás importálva. Engedélyezés előtt ellenőrizd az egyedi CSS-t.`;
    if((m=/^Import failed: (.+)$/.exec(v)))return 'Sikertelen importálás: '+L(m[1]);
    if((m=/^Update check failed: (.+)$/.exec(v)))return 'Frissítéskeresési hiba: '+m[1];
    if((m=/^Download failed: (.+)$/.exec(v)))return 'Letöltési hiba: '+m[1];
    if((m=/^Installation could not start: (.+)$/.exec(v)))return 'A telepítés nem indítható: '+m[1];
    if((m=/^Unsupported file or too large\. Limit: (.+)$/.exec(v)))return 'Nem támogatott vagy túl nagy fájl. Korlát: '+m[1];
    if((m=/^Unable to store the file: (.+)$/.exec(v)))return 'A fájl nem menthető: '+m[1];
    if((m=/^Unable to delete local file: (.+)$/.exec(v)))return 'A helyi fájl nem törölhető: '+m[1];
    if((m=/^(.+) saved locally\.$/.exec(v)))return m[1]+' helyben elmentve.';
    return str;
  }
  function localizePanel(root) {
    if (!root || state.language === 'en') return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())) {
      const source=node.nodeValue.trim();
      if(source)node.nodeValue=L(node.nodeValue);
    }
    for(const el of root.querySelectorAll('[placeholder],[aria-label],[title]')) {
      for(const attr of ['placeholder','aria-label','title']) {
        const v=el.getAttribute(attr);
        if(v)el.setAttribute(attr,L(v));
      }
    }
  }
  function translateTab(tab) {return L(tab);}


  const releaseHistory = [
    {v:'Beta 1.0.15',en:['Game views and visible HUD values now share one event source across both engines.','Settings can reduce animation work, and WebGL diagnostics run on demand.'],hu:['A két motor közös eseményforrásból olvassa a játék látható nézeteit és HUD-adatait.','A Settings csökkentheti az animációk terhelését, a WebGL-diagnosztika igény szerint fut.']},
    {v:'Beta 1.0.14',en:['Fixed the Discord opening indicator so it automatically disappears even when CEF does not send an external-browser reply.','Repaired CEF borderless fullscreen using a trusted native navigation command, a Chromium F11 keyboard handler and Windows UI-thread marshaling.','Expanded fixed FPS targets to 200, 240, 300 and 360; selecting any finite cap now disables persistent Chromium uncap flags and clearly requests restart to reduce uncapped GPU work.','Reduced expensive Settings GPU compositing by removing full-screen backdrop blur, capping graph canvas resolution and avoiding unnecessary client RAF callbacks while settings tabs are open.','Added German, French, Spanish, Portuguese, Italian, Russian, Simplified Chinese and Japanese to Settings; English fallback for rare technical strings, with Windows Setup and Uninstaller remaining English.','Preserved both engines, Kirka native login, user settings, Workshop Experimental, local profiles and verified GitHub releases.']},
    {v:'Beta 1.0.13',en:['Fixed the Settings and sidebar version labels by using the current build version instead of old hard-coded 1.0.5 and 1.0.9 strings.','Protected CEF JavaScript calls when Chromium has not initialized or its IBrowser has been disposed; no uncaught WinForms browser-null dialog after game navigation.','CEF Discord and manual GitHub Releases use fixed client-owned same-origin navigation commands intercepted by the native host, without relying on a potentially dropped JavaScript bridge. Electron sign-in and external links are unchanged.','Clarified engine selection: CEF may provide more FPS but can be less stable; Electron generally favors stability at potentially lower FPS. Actual performance varies.']},
    {v:'Beta 1.0.12',en:['Replaced KS-managed Electron OAuth popup overrides and provider hostname allowlists with the default native Chromium window.open and navigation behavior, following the simpler Redline model.','Removed the CEF account popup lifetime handler, Google/Firebase domain allowlist and authentication-chain tracking; normal HTTP(S) sign-in navigation now belongs to CEF. Kept browser sandboxing, safe renderer preferences, local-file blocking, game pointer lock and only the exact KS-owned Discord invite.','Preserved original Kirka Google, Discord and email login buttons, native login passthrough, HUD, Workshop Experimental, themes, both engines, saved profiles and auto/manual updates. Google may still independently reject embedded OAuth under its official policies.']},
    {v:'Beta 1.0.11',en:['Kirka first-party sign-in is now left untouched: before a game session exists, Electron and CEF skip all injected KS overlays, input listeners and WebGL instrumentation. This allows the original email/password and provider buttons to receive their own browser events.','After Kirka itself creates its game session, the client reloads once and restores the full KS HUD, Workshop, presets, cosmetics, performance features and both browser engines. No user-entered tokens or passwords are required by KS.','Only explicit Discord invitation links open the KS community: game provider buttons with a plain Discord label can no longer be hijacked. Added browser-click and account-gate regression tests; Google may still reject embedded OAuth under its own policy.']},
    {v:'Beta 1.0.10',en:['Kept Kirka account login buttons separate from KS Discord community invitations in both Electron and CEF. Discord OAuth authorization pages now follow the normal allowed provider flow.','Preserved trusted Kirka-initiated Google/Firebase popup and main-frame navigation without opening Settings or requiring a manual session import for regular in-game sign-in. Google can still deny embedded OAuth due to provider policy.','Kept existing settings, Workshop Experimental, both browser engines, user profiles, pointer lock, HUD, in-place updater and complete earlier version history.']},
    {v:'Beta 1.0.9',en:['Google sign-in clicks no longer open the full KS Settings menu. A compact in-game dialog explains the embedded Google OAuth restriction and offers a quick Kirka.io session import.','Quick session recovery reuses the existing local-only importer: masked secret, explicit consent, Kirka origin validation, overwrite confirmation and in-game reload. No tokens are sent over native IPC.','Preserved both browser engines, account provider popups, update feed, Workshop, user settings and game controls. Direct Google OAuth still requires a supported Kirka return flow.']},
    {v:'Beta 1.0.8',en:['Kept allowlisted Kirka account popups inside Electron and CEF, including popup redirects, instead of forcing the user into Windows Chrome. Both engines preserve their own sessions and the original game window.','Supported identity providers can complete their native popup callbacks inside the client. Google OAuth may still reject embedded user agents under provider policy; this is not a guaranteed direct Google login.','Account help now opens KS Settings locally, and the existing user-consented Kirka session import remains available without sending tokens over native IPC.']},
    {v:'Beta 1.0.7',en:['Checks GitHub releases from the native startup screen even if Kirka.io loads slowly. Manual checks, release notes and verified update downloads remain available in Settings.','The updater honors saved auto-check, auto-download and release-channel choices across Electron and CEF. Both engines use the same SHA-256-verified offline installer.','Aligned network timeouts, kept in-place profile/Workshop upgrades, and preserved all previous gameplay and appearance features.']},
    {v:'Beta 1.0.6',en:['Added optional local Kirka.io session transfer for users logged in via their normal browser. The imported bearer token is never sent to native IPC or logs.','Google embedded OAuth remains unsupported; Kirka validates the imported session and may reject or expire it. Existing providers, engines, Workshop, HUD and settings are preserved.','Public release archives now exclude source code while keeping the source repository private.']},
    {v:'Beta 1.0.5',en:['Researched Google embedded OAuth restrictions affecting Gmail/YouTube account login. Google does not support login inside CEF or Electron embedded windows.','Added explicit secure Windows browser sign-in assistance; never copy account credentials, OAuth codes or cookies back to KS Client.','Preserved native non-Google sign-in popups and added safer Google redirect handling, sanitized diagnostics and regression tests. Full in-client Google login needs official Kirka OAuth callback support.']},
    {v:'Beta 1.0.4',en:['All new GitHub release notes, in-client update descriptions and version-history patch notes are in English.','Adjusted Electron and CEF loading screens with English text and complete, unclipped layouts.','Setup now reads the version from the actual bundled Electron/CEF release metadata; Windows install and uninstall dialogs no longer show a hard-coded version.']},
    {v:'Beta 1.0.3',en:['Improved GitHub update checks: reduced API payload, safer retry and corrected updater-process timeout.','13 complete ready-made visual themes plus advanced appearance-only patterns, corners, surface materials and glow.','Redesigned Electron/CEF splash screens and native Windows Setup/Uninstall windows to match the modern charcoal-amber Settings UI.'],hu:['Javított GitHub-frissítéskeresés kisebb lekérdezéssel, biztonságos újrapróbálkozással és hosszabb időkerettel.','13 teljes színpaletta és extra megjelenési beállítások: minták, lekerekítés, felületek és ragyogás.','Az Electron/CEF betöltőképernyő és a Windows telepítő/eltávolító megjelenése illeszkedik a sötét-narancssárga Beállításokhoz.']},
    {v:'Beta 1.0.2',en:['Fixed account selection completing in Google but not returning the sign-in to Kirka: trusted nested OAuth popup handling and scoped browser storage permissions.','Expanded Google/Firebase callback routing in both Electron and CEF without changing cross-origin security.','Added privacy-safe OAuth redirect diagnostics and dedicated regression tests.'],hu:['Javítva a Google-fiók kiválasztása utáni elakadás: hitelesítési ablakok továbbnyitása és célzott tárolóhozzáférési engedélyek.','Bővített Google/Firebase visszairányítás Electronban és CEF-ben a biztonsági korlátozások megtartásával.','Adatvédelmi szempontból biztonságos OAuth-naplózás és célzott tesztek.']},
    {v:'Beta 1.0.1',en:['Restored trusted Kirka OAuth popups and provider redirects in Electron and CEF while retaining security restrictions.','Enabled custom accent, surface and text colors across the refreshed HUD and Settings interface.','Improved live color selection, text contrast and font customization; existing profiles remain intact.'],hu:['Javított Kirka bejelentkezési ablakok és átirányítások Electronban és CEF-ben, a biztonsági korlátozások megtartásával.','Egyéni akcentus-, háttér-, panel- és szövegszínek a HUD-on és a Beállításokban.','Javított színválasztás, szövegkontraszt és betűtípusok, a meglévő profilok megtartásával.']},
    {v:'Beta 1.0.0',en:['Promoted KS Client to Beta with matching black/orange FPS, keystrokes, game statistics and break reminder widgets.','Matched the Settings X button to the KS gear and Discord shortcuts and marked the Workshop Experimental.','Added real verified public GitHub beta update checks, optional automatic download and manual installation with explicit approval.'],hu:['KS Client Beta: egységes fekete–narancssárga FPS-, billentyű-, játékstatisztika- és emlékeztető kijelzők.','Egységes X, fogaskerék és Discord gomb, Workshop Experimental jelölés.','Valódi, ellenőrzött nyilvános GitHub Beta frissítéskeresés, automatikus letöltés és kézi telepítés jóváhagyással.']},
    {v:'1.1.23',en:['Fixed the Electron Discord ReferenceError by sharing one native default-browser opener with the IPC and popup handlers.','Unified the upper-left settings gear and KS Discord buttons with the same styling and spacing.','Introduced motion for opening settings, tab changes, buttons, switches and option cards, respecting motion preferences.','Explained why private GitHub releases cannot serve anonymous auto-updates and improved publisher diagnostics.'],hu:['Javítva az Electron Discord ReferenceError: a főfolyamat és a felugróablakkezelő ugyanazt a natív böngészőmegnyitót használja.','Egységes megjelenésű bal felső fogaskerék és KS Discord-gomb.','Animált menünyitás, váltások, gombok, kapcsolók és kártyák, a mozgáscsökkentési beállításokat tiszteletben tartva.','Átláthatóbb magyarázat a privát GitHub-kiadások automatikus letöltési korlátjáról.']},
    {v:'1.1.22',en:['Rebuilt settings UI with full-window orange/black gamer dashboard, clear left navigation and topic-specific cards.','Seven related navigation categories and visual graphics presets with saved choices and functional footer actions.','Reliable KS Discord in the Windows default browser; protected CEF frame lifecycle on match/page transitions.'],hu:['A teljes beállításfelület új fekete-narancssárga gamer megjelenést, kategóriák szerinti oldalsávot és áttekinthető kártyákat kapott.','Hét tematikus kategória, grafikai presetkártyák, működő alsó műveletgombok.','Megbízható KS Discord-meghívó a Windows alapértelmezett böngészőjében és javított CEF IFrame-élettartam kezelés.']},
    {v:'1.1.21',en:['Prevent diagnostics errors from breaking the Settings gear.','Show actual Electron/CEF CPU, RAM and process counters.','Electron default, clearer update errors and removal of inactive hitmarker/colored killfeed options.'],hu:['A diagnosztika többé nem akadályozhatja a beállítások megnyitását.','Valódi Electron/CEF CPU-, memória- és folyamatadatok.','Electron az alapértelmezett motor, javított frissítési üzenetek, felesleges hitmarker és killfeed beállítások eltávolítva.']},
    {v:'1.1.20',en:['A calmer, more consistent menu layout with clearer categories, improved typography and responsive spacing.','Quick settings search finds existing sections without removing or resetting any options.','Subtle bottom-left version label and KS Client Discord community link in Kirka.io.'],hu:['Letisztultabb, egységesebb menü, jól áttekinthető kategóriák és kényelmesebb elrendezés.','Gyorskereső a meglévő beállításokhoz; semmi nem tűnik el és a mentett opciók nem változnak.','Visszafogott verziófelirat a bal alsó sarokban és a KS Client Discord-közössége a Kirka.io-ban.']},
    {v:'1.1.19',en:['Added GitHub release update checking and in-client installation requests.','Opt-in background downloads and Alpha/Stable release channels.','Files are checked against SHA256 and installed after user confirmation, preserving data.'],hu:['Kliensből elérhető GitHub-verzióellenőrzés és frissítés.','Választható automatikus letöltés és Alpha/Stable kiadási csatornák.','SHA256 ellenőrzés és felhasználói jóváhagyás a telepítés előtt.']},
    {v:'1.1.17',en:['CEF mouse fixes: Chrome-style embedded browser and native activation instead of passive Alloy focus.','Replaced competing manual Windows cursor hiding/focus with Chromium-owned pointer lock and game-first click ordering.','CEF mouse recovery only after trusted click when Kirka did not request lock; improved native input diagnostics.','Eye Comfort no longer applies compositor filters to the live CEF #game canvas; Electron settings remain unchanged.'],hu:['CEF egér: Chrome-stílusú böngésző és valódi natív ablakaktiválás.','A Windows-kurzor kézi elrejtése/fókusz-erőltetése megszűnt, a tényleges egérbefogást Chromium kezeli.','A Kirka saját kattintásos egérbefogása élvez elsőbbséget; CEF-ben csak szükség esetén lép életbe a kiegészítő kérés.','Szemkímélő CSS-szűrő CEF-ben nem vonatkozik a #game vászonra; az Electron működése nem változik.']},
    {v:'1.1.16',en:['Added Game Integration Runtime 2.0: shared visible game scenes, HUD/killfeed events, scoped observers and compatibility fingerprints.','Added passive GPU draw-call and matrix diagnostics, without changing opponent visibility or network/game state.','Kirka compatibility fingerprints, live shared runtime information and GPU diagnostics appear in Game Integration settings.','Direct ZIP and EXE distribution through a verified GitHub Release with SHA256 and truthful publisher-signing reports; Chrome warnings cannot be bypassed.'],hu:['Új Game Integration Runtime 2.0: közös játékállapotok, HUD/killfeed események, felszabaduló megfigyelők és kompatibilitási ujjlenyomatok.','Passzív WebGL-rajzolási és mátrixdiagnosztika; a játékadatokhoz és az ellenfelek láthatóságához nem nyúl.','A kompatibilitás és a közös játék-integráció állapota a Game Integration menüben is látszik.','Ellenőrzött, külön letölthető ZIP és EXE a GitHub Releases oldaláról, SHA256- és kiadói aláírásjelentéssel; a Chrome figyelmeztetéseit nem kerüli meg.']},
    {v:'1.1.15',en:['New animated dark-and-gold KS logo startup screen on both Electron and CEF.','CEF mouse: genuine game canvas pointer-lock request, native Chromium focus/cursor synchronization, and relative-motion diagnostics. Real-game behavior remains to be confirmed.','Single shared WebGL context observer; removes duplicate FPS watcher that previously prevented new integration subscribers from connecting.','Transparent optional publisher signing, unsigned-build warnings, and removal of encoded PowerShell shortcut commands.'],hu:['Új, sötét-arany KS logós betöltőanimáció Electronban és CEF-ben.','CEF egér: valódi játékbeli egérbefogás-kérés, natív Chromium-fókusz és kurzorállapot, relatív mozgás diagnosztikával. Az élő játékbeli működést még ellenőrizni kell.','Egyetlen közös WebGL-környezetfigyelő; a korábbi FPS-megfigyelő ütközésének megszüntetése.','Valódi kiadói aláírás támogatása, átlátható aláírásállapot és a kódolt PowerShell parancs eltávolítása.']},
    {v:'1.1.14',en:['Added optional WebGL exact-texture cosmetics and calibrated 3D viewmodel transforms; game compatibility varies by asset and CORS.','Earlier CEF V8 game integration and better native browser focus; pointer lock still needs live gameplay verification.','Native Kirka Join/Spectate UI, read-only game-event snapshots, visible profile/inventory/market data and sandboxed plugin snapshot API.','More local resource asset folders and optional mouse-held frame-yield workaround; all nonessential modules are opt-in.'],hu:['Választható WebGL 3D textúracsere és kalibrált fegyvermegjelenítés; az eredmény a játékfájloktól és a CORS-tól függ.','Korábbi CEF V8-integráció és jobb böngészőfókusz; az egérrögzítést élő játékban még ellenőrizni kell.','A Kirka saját Join/Spectate felülete, látható statisztika-, profil-, inventory- és marketadatok, korlátozott JS-plugin adatelérés.','További helyi erőforrásmappák és opcionális egérnyomásos fagyáscsökkentés.']},
    {v:'1.1.13',en:['Shared Kirka.io game-integration modules for match, lobby, profile, friends and inventory views.','HUD statistics augmentation, validated drag-and-drop Quick Join, and optional friend spectating when the game exposes a valid room URL.','Passive WebGL diagnostics, pointer lock event logging and improved CEF browser focus; 3D skin replacement and live CEF pointer lock still require testing.','Richer Workshop room presets for visible mode, map and weapon selectors.'],hu:['Közös Kirka.io-integrációs modulok a meccs, lobby, profil, barátlista és inventory képernyőkhöz.','HUD-statisztikák, ellenőrzött behúzható szobalink és feltételes megfigyelési gomb, ha a játék szobalinket mutat.','Passzív WebGL-diagnosztika, egérbefogási naplózás és CEF-fókuszjavítás; a 3D skincsere és a CEF éles egértesztje még hátravan.','Részletes szobapresetek a látható játékmód-, pálya- és fegyverválasztókhoz.']},
    {v:'1.1.12',en:['Local Workshop with weapon cosmetics, Custom Skin Link, room presets, player notes, inventory favorites and manual plugin previews.','Opt-in exact-path image/audio/CSS resource swapper in Electron and CEF.','Gameplay stat and quick-join improvements without changing server state.'],hu:['Helyi Workshop: fegyverkinézet, Custom Skin Link, szobapresetek, játékosjegyzetek, inventory-kedvencek és biztonságos plugin-előnézet.','Választható kép-, hang- és CSS-erőforráscsere Electronban és CEF-ben.','Játék-HUD és gyorscsatlakozás, a szerveradatok módosítása nélkül.']},
    {v:'1.1.12',en:['Fix Kirka.io mouse capture and game cursor release on both browser engines.','Add separate safe gameplay overlays for keystrokes, hitmarker style, game stats, quick join and screenshots in Electron.','Add feature status and native input diagnostics.'],hu:['Egérbefogás és egérkurzor-felszabadítás javítása mindkét motorban.','Biztonságos játékbeli kiegészítők: billentyűzet, találatjelzés, statisztika, gyorscsatlakozás és Electron-képernyőkép.','Funkció- és beviteli diagnosztika.']},
    {v:'1.1.10',en:['Fix CEF engine switching with a navigation fallback when JavaScript postMessage acknowledgement is missing.','Test the real CEF renderer-to-native bridge on Windows, not just the launcher.','Show actionable timeout feedback instead of an endless Requesting state.'],hu:['Javított CEF motorváltás tartalék natív útvonallal, ha a JavaScript üzenet nem jut el a programhoz.','Valódi CEF JavaScript→natív kommunikáció tesztje Windows alatt.','Végtelen kérésállapot helyett használható hibaüzenet.']},
    {v:'1.1.9',en:['Launcher supervises CEF/Electron native readiness and only then commits switches.','Native switch probes on Windows for both engine directions.','FPS startup flag verification and browser callback diagnostics, without promising GPU FPS.'],hu:['A launcher a natív indulásig felügyeli a CEF/Electron váltást.','Mindkét motorirány valódi Windowsos próbaindítása.','FPS-indítási kapcsolók és böngészős animációs ütem diagnosztikája, GPU-FPS ígérete nélkül.']},
    {v:'1.1.8',en:['Fixed active engine identification and acknowledged engine switching.','Unlimited FPS now enables the experimental Chromium uncapping request.','Preserves the old engine on restart failures.'],hu:['Javított motorfelismerés és visszaigazolt motorváltás.','Korlátlan FPS választásakor kísérleti Chromium-feloldás és újraindítás.','A régi motor nyitva marad hiba esetén.']},
    {v:'1.1.7',en:['Bundle both .NET 10 runtimes for CEF offline startup.','Fix CEF Windows smoke diagnostics and optional Electron graphics DLL.','Require passing engine tests before release packaging.'],hu:['A CEF mellé mindkét .NET 10 futtatókörnyezet bekerül.','Javított CEF-indítási hibakeresés és Electron-függőségek.','Csak mindkét motorteszt után készül telepítő.']},
    {v:'1.1.6',en:['Replaced the empty PowerShell window with a native English engine installer with visible logs.','Setup now automatically installs both engines online; CEF starts by default.','Switch between CEF and Electron in Client > General; changing engines restarts KS Client.'],hu:['Üres terminál helyett saját angol nyelvű motortelepítő ablak naplóval.','Telepítés után mindkét motor automatikusan települ az internetről; az alapmotor CEF.','Motorváltás a Kliens > Általános menüben, automatikus újraindítással.']},
    {v:'1.1.2',en:['Fixed existing-installation detection for upgrades, including previous WebView2 releases.','Reworked setup file replacement with rollback and Retry / Cancel recovery.','English-labelled native setup and uninstaller buttons, independent of Windows display language.'],hu:['Javított telepítési hely felismerés és verziófrissítés, régebbi WebView2 kiadásokról is.','Biztonságosabb fájlcsere visszaállítással és Újra / Mégse választással.','Saját angol feliratú telepítő- és eltávolító gombok a Windows nyelvétől függetlenül.']},
    {v:'1.1.1',en:['English-only Windows installer, engine selector, engine setup and maintenance messages.','Added Windows Installed apps registration and an English uninstaller with optional settings and profile removal.','Electron and CEF options and existing in-game settings are preserved.'],hu:['Angol nyelvű Windows-telepítő, motorválasztó és motortelepítő.','Windowsos eltávolító beállításmegtartással és opcionális profiltörléssel.','Az Electron/CEF motorok és korábbi beállítások megmaradtak.']},
    {v:'1.1.0',en:['Switched to selectable Electron and CEF engines.','Migrated the KS Client overlay and browser settings bridge.','The WebView2 host is no longer used.'],hu:['Választható Electron és CEF motorokra váltottunk.','Átkerült a KS Client menüje és a böngészőbeállítások kezelése.','A WebView2 motort az új kiadás már nem használja.']},
    {v:'1.0.11', en:['Removed nonfunctional Hitmarker, update downloader and Discord detection menu.','Moved version history to Client Overview.','Preserved Unlimited FPS, Eye Comfort and other gameplay settings.'], hu:['Eltávolítottuk a nem működő találatjelzőt, frissítésletöltőt és Discord-felismerés menüpontot.','A verziótörténet az Általános menübe került.','Megmaradt a korlátlan FPS, a Szemkomfort és a többi játékbeállítás.']},
    {v:'1.0.10',en:['Opt-in experimental Chromium FPS unlock with restart and recovery.','Restart clears stale Chromium launch flags when disabling the unlock.','Optional Kirka.io FPS reader for visible HTML HUD elements only.'],hu:['Külön kapcsolható kísérleti Chromium FPS-feloldás újraindítással és biztonságos visszaállítással.','Kikapcsoláskor az újraindítás eltávolítja a korábbi FPS-feloldó kapcsolókat.','Opcionális Kirka.io FPS-kiolvasás a látható HTML HUD-elemekből.']},
    {v:'1.0.9', en:['Reset default menu size to 100% and defer resizing until slider release to reduce redraw stutter.','Added Eye Comfort canvas color/softness filters, presets and optional break reminders.','Added Frame Stability diagnostics, measured WebGL antialiasing status and Pixel Perfect native-scaling action.','Added browser callback smoothness profiles and Adaptive Sync / camera comfort guidance.'], hu:['A menü alapmérete újra 100%, a méretezés csak a csúszka elengedésekor történik a szaggatás csökkentéséhez.','Szemkomfort-szín- és lágyítószűrők, profilok és opcionális szünetemlékeztetők.','Képkockastabilitás-diagnosztika, WebGL-élsimítás állapotának kijelzése és natív Pixel Perfect mód.','Böngészős képkockaütemezési profilok és útmutató az adaptív szinkronhoz és kamerakényelemhez.']},
    {v:'1.0.8',en:['Dedicated Electron/CEF browser graphics, controls and GPU diagnostics menus.','GPU acceleration and ANGLE backend settings with persistent per-user preferences.','Clearly differentiated browser rAF FPS and Kirka.io own in-game FPS.'],hu:['Külön Electron/CEF grafikai, böngészőfunkciós és GPU-diagnosztikai menük.','GPU-gyorsítás és ANGLE-választó felhasználónként mentve.','Böngészős rAF FPS és Kirka.io játékbeli FPS egyértelmű elkülönítése.']},
    {v:'1.0.7', en:['Added menu sound playback testing and local resource verification.','Fixed retry downloads and added a release-manifest generator for publishers.','Added Windows uninstaller support and improved crash-log handling.','Made theme colors more consistent and clarified browser callback FPS labels.'], hu:['Menühang-lejátszás tesztelése és helyi erőforrások ellenőrzése.','Ismételt frissítésletöltés javítása, valamint verziófájl-készítő segédeszköz a kiadónak.','Windowsos eltávolítóprogram és továbbfejlesztett hibanaplózás.','Egységesebb témaszínek és pontosabb böngészős FPS-feliratok.']},
    {v:'1.0.6', en:['Moved Performance under Gameplay and Interface under Personalization.','Increased the default settings menu size to 150% with crisp layout scaling.','Added 12 crosshair shapes, center-dot options, colored outlines and shadows.'], hu:['A Teljesítmény a Játékmenet, a Felület a Testreszabás csoportba került.','A beállításmenü alapmérete 150%-ra nőtt, éles elrendezési nagyítással.','12 célkeresztforma, állítható középpont, színes körvonalak és árnyékok.']},
    {v:'1.0.5', en:['Renamed the Windows window and application identity to KS Client for clearer Discord detection.','Added automatic monitor matching and 720p presets for both display modes.','Removed the unused browser-engine switch from the menu.'], hu:['Az ablak neve és a Windows-alkalmazásazonosító KS Client lett a Discord jobb felismeréséhez.','Automatikus monitorhoz igazítás és 720p a menü- és játékfelbontáshoz.','Eltávolítottuk a nem működő motorválasztó menüpontot.']},
    {v:'1.0.4', en:['Reorganized Settings into five main categories with related submenus.','Replaced native option popups with a custom dark selection menu.','Unified narrow scrollbars; moved the expandable release history into Updates.'], hu:['A beállítások öt áttekinthető főkategóriába és kapcsolódó almenükbe kerültek.','A natív választólistákat egyedi, sötét lenyíló menük váltották fel.','Egységes, keskeny görgetősávok; a lenyitható verziótörténet a Frissítések fülre került.']},
    {v:'1.0.3', en:['Refreshed dark interface and extended custom theme colors.','Added a built-in change summary and improved the EXE replacement workflow.'], hu:['Frissített sötét felület és több testreszabható témaszín.','Újdonságösszegzés és továbbfejlesztett EXE-csere a frissítőben.']},
    {v:'1.0.3', en:['Added the embedded orange K application icon and desktop shortcut installer.','Expanded Hungarian language support and simplified the Discord section.'], hu:['Beépített narancssárga K-ikon és asztali parancsikont készítő telepítő.','Bővített magyar nyelv és egyszerűsített Discord-rész.']},
    {v:'1.0.3', en:['Removed the native top menu and status bar from the game view.','Moved display settings first and updated the original selector styling.'], hu:['Eltűnt a natív felső menü- és állapotsor a játékablakból.','Előre kerültek a kijelzőbeállítások, és javult a választók megjelenése.']},
    {v:'1.0.0', en:['Introduced the Beta 1.0.0 branded KS Client build with the K logo.'], hu:['Megjelent az Beta 1.0.0 feliratú KS Client kiadás a K-logóval.']}
  ];
  function historyHTML() {
    return `<section class="ks-history" aria-label="Release history"><div class="ks-history-heading">Version history – click a version</div>`+
      releaseHistory.map(r=>`<details class="ks-release"><summary>${r.v.startsWith("Beta ")?"KS Client ":"KS Client alpha "}${esc(r.v)}</summary><div class="ks-release-body"><ul>`+
        r.en.map(item=>`<li>${esc(item)}</li>`).join('')+
      `</ul></div></details>`).join('')+`</section>`;
  }

  function updateShellLanguage() {
    // Only the gear icon is visible; its localized accessible name remains below.
    $('ks-gear').setAttribute('aria-label',L('Open KS Client settings'));
    $('ks-panel').setAttribute('aria-label',L('KS Client Settings'));
    $('ks-close').setAttribute('aria-label',L('Close Settings'));
    $('ks-brand-main').textContent=L('Settings');
    $('ks-brand-sub').textContent=L('Customize your game experience');
    $('ks-reset-main').textContent='↺  '+L('Reset to Default');
    $('ks-cancel').textContent=L('Cancel');
    $('ks-apply').textContent='✓  '+L('Apply');
    $('ks-autosave-status').textContent=L('Changes preview instantly');
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const toggleRow = (label, desc, key) => `<div class="ks-row"><div><div class="ks-label">${label}</div><div class="ks-desc">${desc}</div></div><input type="checkbox" data-setting="${key}" ${state[key] ? 'checked' : ''} aria-label="${label}"></div>`;
  const rangeRow = (label, key, min, max, suffix = '%') => `<div class="ks-row"><div class="ks-label">${label}</div><div class="ks-stack"><input aria-label="${label}" data-setting="${key}" type="range" min="${min}" max="${max}" value="${Number(state[key])}"><span class="ks-val" data-for="${key}">${state[key]}${suffix}</span></div></div>`;
  const selectRow = (label, desc, key, options) => `<div class="ks-row"><div><div class="ks-label">${label}</div><div class="ks-desc">${desc}</div></div><select class="ks-input" data-setting="${key}">${options.map(o => `<option value="${o.value}" ${String(state[key]) === String(o.value) ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>`;
  const title = (t, s) => `<h2 class="ks-title">${t}</h2><p class="ks-sub">${s}</p>`;

  function paletteTiles() {
    return '<div class="ks-palette-grid" role="group" aria-label="Color palette presets">'+
      Object.entries(themePalettes).map(([name,c])=>
        `<button type="button" class="ks-palette-tile ${state.themePreset===name?'selected':''}"
          data-palette="${esc(name)}" aria-pressed="${state.themePreset===name}">
          <span class="ks-palette-preview" style="background:${c.bg};border-color:${c.accent}">
            <i style="background:${c.accent}"></i><i style="background:${c.panel}"></i>
            <i style="background:${c.text}"></i>
          </span><span>${esc(name)}</span>
        </button>`).join('')+
      '</div>';
  }
  function currentAccent() {
    const candidate = themeColors[state.themePreset] || state.customAccent;
    return /^#[0-9a-f]{6}$/i.test(String(candidate)) ? candidate : '#f0aa35';
  }
  const themeColor = (color,fallback) => /^#[0-9a-f]{6}$/i.test(String(color)) ? String(color) : fallback;
  function themeContrast(hex) {
    const rgb=[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)/255)
      .map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722 > .19 ? '#101115' : '#ffffff';
  }
  function customPaletteEnabled() {
    return state.themePreset !== 'Amber' ||
      ['customBackground','customPanel','customText','customMuted'].some(k=>state[k]!==defaults[k]);
  }
  const savedPresets = () => Array.isArray(state.customCrosshairPresets) ? state.customCrosshairPresets : [];
  const assetLabel = key => assetMeta[key] || 'No local file selected';
  const uploadRow = (titleText, description, key, accept) => `<div class="ks-row"><div><div class="ks-label">${titleText}</div><div class="ks-desc">${description}</div><div class="ks-asset-summary" data-asset-summary="${key}">${esc(assetLabel(key))}</div></div><div class="ks-stack"><label class="ks-btn" style="cursor:pointer">Browse<input type="file" data-asset="${key}" accept="${accept}" hidden></label><button class="ks-btn" data-clear-asset="${key}">Remove</button></div></div>`;

  function tabContent() {
    if(["Weapon Studio","Resource Swapper","Plugins","Lobby","Friends & Profiles","Inventory & Market"].includes(selectedTab)) {
      return window.__KS_WORKSHOP__?.render(selectedTab) || '<p class="ks-hint">Workshop module is loading. Close and reopen Settings.</p>';
    }
    switch (selectedTab) {
      case 'Updates':
        return title('Software Updates','Update through GitHub Releases without losing your existing KS Client settings.')+
          '<div class="ks-card">'+
          '<div class="ks-row"><div><div class="ks-label">Current version</div><div class="ks-desc">KS Client '+esc(CLIENT_LABEL)+'</div></div><span class="ks-pill">● INSTALLED</span></div>'+
          toggleRow('Automatically check for updates','Check once per day when the client opens. Never automatically install.','autoCheckUpdates')+
          toggleRow('Download updates automatically','Download verified packages quietly when available. Installation always asks permission.','autoDownloadUpdates')+
          selectRow('Update channel','Beta is recommended. Beta includes Beta and Stable releases; Alpha also includes older experimental builds.','updateChannel',[
            {value:'beta',label:'Beta (recommended)'},{value:'stable',label:'Stable only'},{value:'alpha',label:'Alpha + Beta + Stable'}])+
          '<div class="ks-row"><div><div class="ks-label">Update status</div><div class="ks-desc" id="ks-update-status">'+esc(updateStateText())+'</div></div></div>'+
          (updateStatus.state==='available'?'<div class="ks-note">Release '+esc(String(updateStatus.version||''))+
            ' · '+(updateStatus.cached?'Downloaded and verified':'Size: '+Math.round(Number(updateStatus.bytes||0)/1048576)+' MB')+
            (updateStatus.notes?'<p style="white-space:pre-wrap;max-height:135px;overflow:auto">'+esc(String(updateStatus.notes||''))+'</p>':'')+
            '</div>':'')+
          '<div class="ks-stack" style="flex-wrap:wrap;margin-top:12px">'+
          '<button class="ks-btn primary" data-action="update-check" '+(updateStatus.state==='checking'?'disabled':'')+'>Check for updates</button>'+
          (updateStatus.state==='available'?'<button class="ks-btn" data-action="update-install">Install update &amp; restart</button>':'')+
          '<button class="ks-btn" data-action="update-open-release">Open GitHub Releases (manual)</button>'+
          '</div></div>'+
          '<div class="ks-card ks-update-feed"><h3 class="ks-section-heading">Update download source</h3>'+
          '<div class="ks-row"><div><div class="ks-label">Public binary release feed</div><div class="ks-desc">epicjatekosok/KS-Client-Updates · must be PUBLIC for anonymous downloads. The KS-Client source repository can stay PRIVATE.</div></div><span class="ks-pill">GITHUB</span></div>'+
          '<div class="ks-note">The public KS-Client-Updates repository now contains verified ZIP and EXE releases. Check for updates and automatic downloads use this feed without login. The actual installation always asks permission and preserves your settings. Open GitHub Releases is a public manual-download fallback.</div>'+
          '</div>';
      case 'General':
        return title('Client Overview', 'KS Client '+CLIENT_LABEL+' starts in Electron by default. Switching engines restarts the application.') +
          `<div class="ks-card">` +
          `<div class="ks-row"><div><div class="ks-label">Active browser engine</div><div class="ks-desc">${esc(activeEngine)}</div></div><span class="ks-pill">● ACTIVE</span></div>` +
          `<div class="ks-row"><div><div class="ks-label">Switch browser engine</div><div class="ks-desc">Choose CEF for potentially higher FPS, but it may be less stable. Choose Electron for potentially lower FPS, but generally more stable behavior. Actual FPS depends on your PC and game settings. Switching restarts KS Client; browser profiles may differ. Shortcuts: Ctrl+Alt+E for Electron, Ctrl+Alt+C for CEF.</div></div><div class="ks-stack"><button class="ks-btn" data-action="engine-electron" title="Electron: usually more stable, may run at lower FPS">Electron · Stable</button><button class="ks-btn" data-action="engine-cef" title="CEF: potentially higher FPS, may be less stable">CEF · Higher FPS (experimental)</button></div></div>` +
          `<div class="ks-row"><div><div class="ks-label">Kirka account sign-in</div><div class="ks-desc">Sign-in windows for supported providers stay inside KS Client, sharing the game's browser session. Google can refuse authentication in embedded apps by its own policy; KS does not spoof the browser or send you away to play in Chrome. A Chrome login alone does not sign in this separate profile. If you already have a Kirka game session in Chrome, the optional local import below can transfer it into the client.</div></div><span class="ks-pill">IN CLIENT</span></div>` +
          `<div class="ks-row"><div style="min-width:0;flex:1"><div class="ks-label">Import Kirka.io session (advanced)</div><div class="ks-desc">First sign in to https://kirka.io/ in your regular browser. On that exact page, open Developer Tools Console and run <code>copy(localStorage.getItem('token'))</code>. Paste below. Treat this session token like a password: never share it, including in chat or support. It is saved only in this engine's Kirka.io local storage, not sent to KS Client servers. Kirka may reject or expire it.</div><input class="ks-input" id="ks-account-session-token" type="password" maxlength="8192" autocomplete="new-password" spellcheck="false" placeholder="Kirka.io token (keep secret)" aria-label="Kirka.io session token" style="width:100%;margin-top:8px"><label class="ks-desc" style="display:block;margin-top:8px"><input id="ks-account-session-consent" type="checkbox"> I understand that a session token grants access to my Kirka account.</label><div id="ks-account-session-status" class="ks-desc" role="status" aria-live="polite"></div></div><button class="ks-btn" data-action="auth-import-session">Import session locally</button></div>` +
          (engineSwitchStatus ? `<p class="ks-hint" id="ks-engine-switch-status">${esc(engineSwitchStatus)}</p>` : '') +
          `<div class="ks-row"><div class="ks-label">Borderless fullscreen</div><button class="ks-btn" data-action="fullscreen">Toggle fullscreen · F11</button></div>` +
          `<div class="ks-row"><div class="ks-label">Reset client settings</div><button class="ks-btn danger" data-action="reset">Reset all settings</button></div>` +
          `</div>` +
          `<p class="ks-hint">This build uses the current KS Client build label. Game files and player data still come from Kirka.io.</p>` + historyHTML();
      case 'Sharing':
        return title('Settings Backup & Language','Save and share your own KS Client preferences. JSON only; never import settings from an unknown person.') +
          `<div class="ks-card">` +
          selectRow('Language','Choose your Settings language. Less common advanced technical labels may remain in English. The Windows Setup and Uninstaller remain English.','language',
            Object.entries(languageNames).map(([value,label])=>({value,label}))) +
          `<div class="ks-row"><div><div class="ks-label">Settings import/export</div><div class="ks-desc">Export a JSON backup, including crosshair presets and visual settings. Uploaded binary assets are excluded.</div></div><div class="ks-stack"><button class="ks-btn primary" data-action="export-settings">Export settings</button><button class="ks-btn" data-action="import-settings">Import settings</button></div></div>` +
          `<input id="ks-import-file" type="file" accept=".json,application/json" hidden>` +
          `<div class="ks-stat-details" id="ks-sharing-status">${esc(sharingStatus)}</div>` +
          `</div><p class="ks-hint">Export leaves out local image/audio/font files. Imported CSS stays disabled until you review and enable it.</p>`;
      case 'Display':
        return title('Display & Resolution', 'Separate presets for the KS Client menu area and the Kirka.io game rendering density.') +
          `<div class="ks-card">` +
          selectRow('Menu resolution preset', 'Auto-fit the current monitor work area, or select a fixed window size.', 'menuResolution', [
            { value: 'native', label: 'Match monitor / automatic' },
            { value: '720', label: '1280 × 720 (720p)' },
            { value: '1080', label: '1920 × 1080 (1080p)' },
            { value: '1440', label: '2560 × 1440 (1440p)' },
            { value: '2160', label: '3840 × 2160 (4K)' }
          ]) +
          selectRow('Game resolution preset', 'Automatic uses monitor DPI and engine native scaling; fixed modes set a raster target.', 'gameResolution', [
            { value: 'native', label: 'Match monitor / automatic' },
            { value: '720', label: '1280 × 720 (720p)' },
            { value: '1080', label: '1920 × 1080 (1080p)' },
            { value: '1440', label: '2560 × 1440 (1440p)' },
            { value: '2160', label: '3840 × 2160 (4K)' }
          ]) +
          rangeRow('Settings menu scale', 'uiScale', 100, 160, '%') +
          `<p class="ks-hint">Scale updates only when you release the slider to avoid repeated repaints.</p>` +
          toggleRow('Show FPS counter', 'Measured requestAnimationFrame callback rate, not presented GPU FPS.', 'showFPS') +
          selectRow('FPS indicator source','Choose the browser callback counter or use the in-game counter supplied by Kirka.io.','fpsSource',[
            {value:'browser',label:'KS Client browser FPS (rAF)'},{value:'kirka',label:'Kirka.io game FPS (native HUD)'},{value:'kirka-hud',label:'Kirka.io HUD FPS (HTML only, experimental)'}]) +
          `<p class="ks-hint">The Kirka.io FPS reader recognizes visible HTML text only, not FPS painted inside a WebGL canvas. If unavailable it shows no value; use the in-game counter.</p>` +
          `<div class="ks-row"><div class="ks-label">FPS position</div><select class="ks-input" data-setting="fpsPosition"><option value="top-left" ${state.fpsPosition === 'top-left' ? 'selected' : ''}>Top left</option><option value="top-right" ${state.fpsPosition === 'top-right' ? 'selected' : ''}>Top right</option><option value="bottom-right" ${state.fpsPosition === 'bottom-right' ? 'selected' : ''}>Bottom right</option></select></div>` +
          `</div>` +
          `<p class="ks-hint">Automatic is recommended: the menu fits your monitor work area and the game uses the native engine/Windows display scale. When monitor information is unavailable, 1080p is used as a fallback. Fixed presets adjust browser page zoom, not the game engine’s internal render resolution.</p>`;
      case 'Game Integration':
        return title('Kirka.io Game Integration','Optional browser-side game extras. All changes are visual/read-only, no gameplay automation.') +
          `<div class="ks-card"><h3 class="ks-section-heading">Mouse & keyboard</h3>`+
          toggleRow('Auto-capture mouse in game','Click the game canvas to request native pointer lock; ESC releases it. Browsers require a real user click.','gameAutoMouseCapture')+
          `<div class="ks-row"><div><div class="ks-label">Pointer lock status</div><div class="ks-desc">The cursor disappears only after the game canvas receives real browser pointer lock.</div></div><span id="ks-pointer-status" class="ks-code">Checking…</span></div>`+
          toggleRow('Keystroke overlay','Show held movement keys (WASD, space, shift) while playing.','gameKeystrokes')+
          selectRow('Keystroke position','Where the keys appear on top of the game.','gameKeysPosition',[
            {value:'bottom-left',label:'Bottom left'},{value:'bottom-right',label:'Bottom right'},
            {value:'top-left',label:'Top left'},{value:'top-right',label:'Top right'}])+
          rangeRow('Keystroke size','gameKeysScale',70,170,'%')+
          `</div><div class="ks-card"><h3 class="ks-section-heading">Optional game HUD</h3>`+
          toggleRow('Read-only game stats','Display kills, deaths, assists and headshot indicators where Kirka.io exposes them as HTML.','gameStats')+
          `</div><div class="ks-card"><h3 class="ks-section-heading">Convenience tools</h3>`+
          toggleRow('Quick join links','Allow joining a validated Kirka.io game link through the built-in navigator.','gameQuickJoin')+
          `<div class="ks-row"><div><div class="ks-label">Join a Kirka.io room URL</div><input id="ks-join-link" class="ks-input" placeholder="https://kirka.io/games/..." maxlength="400"><button class="ks-btn" data-action="quick-join">Join</button></div>`+
          `<div class="ks-row"><div><div class="ks-label">Screenshot</div><div class="ks-desc">Electron saves a PNG of the current game window. CEF captures the visible window area; overlapping windows may be included.</div></div><button class="ks-btn" data-action="game-screenshot">Save screenshot</button></div>`+
          `<p class="ks-hint">Deep integration: ${esc(JSON.stringify(window.__KS_DEEP__?.getStatus?.()||{}).slice(0,360))}</p>`+
          `<p class="ks-hint">KS Game Runtime 2.0 (shared scene + events): ${esc(JSON.stringify(window.__KS_GAME_RUNTIME__?.getStatus?.()||{}).slice(0,680))}</p>`+
          `<p class="ks-hint">Kirka UI compatibility fingerprint (not an official game version): ${esc(window.__KS_GAME_RUNTIME__?.getStatus?.()?.compatibility?.signature||'Not available')}</p>`+
          `<p class="ks-hint">Read-only WebGL draw telemetry: ${esc(JSON.stringify(window.__KS_RENDER_TELEMETRY__?.getStatus?.()||{}).slice(0,480))}</p>`+
          `<p class="ks-hint">3D WebGL: ${esc(JSON.stringify(window.__KS_WEBGL_COSMETICS__?.getStatus?.()||{}).slice(0,480))} · Configure in Workshop > Weapon Studio.</p>`+
          `<p class="ks-hint" id="ks-extra-status">Optional features are not game cheats or guaranteed cross-version Kirka.io selectors.</p>`+
          `</div>`;
      case 'Performance':
        return title('Graphics', 'Choose a performance profile, frame pacing and browser graphics options.') +
          '<div class="ks-graphic-presets"><div class="ks-graphic-presets-label">Graphics presets</div>'+
          '<div class="ks-graphic-preset-grid">'+
          [{id:'Low',label:'Low',icon:'▣'}, {id:'Balanced',label:'Medium',icon:'◇'}, {id:'High Performance',label:'High',icon:'♕'}]
            .map(p=>`<button type="button" class="ks-graphic-preset ${state.performancePreset===p.id?'active':''}" data-action="performance-preset" data-preset="${esc(p.id)}" aria-pressed="${state.performancePreset===p.id?'true':'false'}"><span class="ks-preset-landscape"></span><span class="ks-preset-name"><span>${p.icon}</span>${p.label}</span><span class="ks-preset-check">✓</span></button>`).join('')+
          '</div></div>'+
          `<div class="ks-card">` +
          selectRow('FPS Limiter', 'Paces browser requestAnimationFrame callbacks. This can limit games using the main-thread rAF loop, but is not a GPU driver cap.', 'fpsLimit', [
            { value: 0, label: 'Unlimited / Native' },
            { value: 60, label: '60 FPS' },
            { value: 120, label: '120 FPS' },
            { value: 144, label: '144 FPS' },
            { value: 165, label: '165 FPS' },
            { value: 180, label: '180 FPS' },
            { value: 200, label: '200 FPS' },
            { value: 240, label: '240 FPS' },
            { value: 300, label: '300 FPS' },
            { value: 360, label: '360 FPS' }
          ]) +
          `<div class="ks-row"><div><div class="ks-label">Activate Unlimited FPS</div><div class="ks-desc">Requests Chromium FPS unlocking and removes the KS JavaScript callback cap. Restart required; actual Kirka.io FPS is not guaranteed above monitor Hz.</div></div><button class="ks-btn primary" data-action="enable-unlimited-fps" ${!browserPrefsLoaded?'disabled':''}>Enable experimental unlock</button></div>` +
          `<div class="ks-row"><div><div class="ks-label">Experimental Unlimited FPS (Chromium)</div><div class="ks-desc">Attempts to remove Chromium rAF/vsync limits. Requires a restart and may cause tearing, higher CPU load or network input delays.</div></div><input type="checkbox" data-browser="uncapFps" ${browserPrefs.uncapFps?'checked':''} ${!browserPrefsLoaded?'disabled':''}></div>` +
          `<div class="ks-row"><div><div class="ks-label">FPS unlock verification</div><div class="ks-desc">Reports native startup requests, NOT measured Kirka.io GPU FPS.</div></div><span class="ks-code" id="ks-fps-native-diag">${esc(fpsDiagnosticText())}</span></div>`+
          `<div class="ks-row"><div><div class="ks-label">Observed browser animation rate</div><div class="ks-desc">JavaScript requestAnimationFrame callbacks; not necessarily the game's render rate.</div></div><span class="ks-code" id="ks-fps-callback-diag">Measuring…</span></div>`+
          `<p class="ks-hint">If the rAF rate equals 60/144/165 Hz, this indicates a browser scheduling ceiling. Compare Kirka.io's in-game FPS separately. Above-monitor GPU FPS cannot be guaranteed.</p>`+
          `<div class="ks-row"><div><div class="ks-label">Browser FPS unlock</div><div class="ks-desc">Your selected engine startup request</div></div><span class="ks-code">${browserActive.uncapFps ? L('Requested on startup') : L('Off / normal sync')}</span></div>`+
          (browserPendingRestart ? `<p class="ks-hint">${L('Restart KS Client now')}</p><button class="ks-btn primary" data-action="browser-restart">${L('Restart KS Client now')}</button>` : '') +
          `<p class="ks-hint">Unlimited here only removes the KS JavaScript cap. For above-monitor-Hz FPS enable Experimental Chromium Uncap below and restart.</p>`+
          (browserActive.uncapFps && state.fpsLimit>0 ? `<p class="ks-hint">${state.language==='hu'?'A Chromium FPS-feloldása aktív. A normál szinkronhoz kapcsold ki, majd indítsd újra a klienst.':'Chromium unlock is active alongside your callback cap. For normal sync, turn off the experimental unlock and restart.'}</p>` : '') +
          selectRow('Smoothness profile','Choose a browser callback pacing target. It cannot guarantee the displayed GPU frame rate.','smoothPreset',[
            {value:'Native',label:'Native / no extra cap'},{value:'Comfort',label:'Comfort – 120 FPS'},{value:'Balanced',label:'Balanced – 144 FPS'},{value:'Smooth',label:'High Smoothness – 165 FPS'}]) +
          toggleRow('Low Latency Mode', 'Disables KS Client menu blur and animations. This reduces interface overhead only, not game network latency.', 'lowLatency') +
          toggleRow('UI Animations', 'Allow animations and blur in the KS Client interface.', 'uiAnimations') +
          toggleRow('Reduce rendering in Settings', 'Limit page animation callbacks to 30 per second while browsing Settings. Frame Stability uses the gameplay limit while measuring.', 'limitSettingsFPS') +
          toggleRow('Limit lobby rendering', 'Cap page animation callbacks at 60 in the visible lobby.', 'limitLobbyFPS') +
          toggleRow('Limit unfocused rendering', 'Cap page animation callbacks at 30 when another window has focus.', 'limitUnfocusedFPS') +
          toggleRow('Real-time FPS & Frametime graphs', 'Show live sampled browser/game callback timing graphs while this tab is open.', 'showGraph') +
          `<div class="ks-row"><div><div class="ks-label">Measured callback rate</div><div class="ks-desc" id="ks-fps-source">${esc(measuredLabel)}</div></div><b class="ks-code" id="ks-current-gamefps">${displayedGameFPS} FPS</b></div>` +
          `<div class="ks-row"><div class="ks-label">Most recent callback interval</div><b class="ks-code" id="ks-current-ms">${displayedFrameMs.toFixed(1)} ms</b></div>` +
          `<div class="ks-row"><div><div class="ks-label">Kirka HUD FPS value</div><div class="ks-desc">HTML HUD reading if exposed; otherwise use the game's own counter.</div></div><span class="ks-code" id="ks-kirka-fps-value">—</span></div>` +
          `</div>` +
          `<div id="ks-graphs"><div class="ks-section-heading">FPS history (last ~60 samples)</div><canvas id="ks-graph-fps" aria-label="FPS graph"></canvas>` +
          `<div class="ks-section-heading">Frametime history (milliseconds)</div><canvas id="ks-graph-ms" aria-label="Frametime graph"></canvas></div>` +
          `<p class="ks-hint">The FPS limit is a best-effort JavaScript frame pacing mechanism. The optional Chromium uncap may allow FPS above monitor Hz, but Electron/CEF may ignore it or introduce mouse/network stalls. Verify with the game's own FPS HUD.</p>`;
      case 'Diagnostics':
        return title('Advanced Diagnostics', 'Live measurements of KS Client and its Chromium/Electron/CEF child processes. Refreshes every two seconds.') +
          `<div class="ks-metric-grid">` +
          `<div class="ks-metric"><div class="ks-metric-name">Game WebGL draws/s</div><div class="ks-metric-value" id="ks-game-draws">—</div></div>` +
          `<div class="ks-metric"><div class="ks-metric-name">Browser CPU</div><div class="ks-metric-value" id="ks-browser-cpu">—</div></div>` +
          `<div class="ks-metric"><div class="ks-metric-name">Browser RAM</div><div class="ks-metric-value" id="ks-browser-ram">—</div></div>` +
          `<div class="ks-metric"><div class="ks-metric-name">Browser Processes</div><div class="ks-metric-value" id="ks-browser-processes">—</div></div>` +
          `<div class="ks-metric"><div class="ks-metric-name">Client CPU</div><div class="ks-metric-value" id="ks-client-cpu">—</div></div>` +
          `<div class="ks-metric"><div class="ks-metric-name">Client RAM</div><div class="ks-metric-value" id="ks-client-ram">—</div></div>` +
          `<div class="ks-metric"><div class="ks-metric-name">Renderer</div><div class="ks-metric-value" style="font-size:13px;line-height:1.35;overflow-wrap:anywhere" id="ks-gpu-state">${esc(gpuInfo.status)}</div></div>` +
          `</div>` +
          `<div class="ks-card">` +
          `<div class="ks-row"><div><div class="ks-label">Hardware Acceleration Check</div><div class="ks-desc">Inspect WebGL context and software-renderer indicators. Electron/CEF uses GPU acceleration by default.</div></div><button class="ks-btn primary" data-action="check-gpu">Check GPU</button></div>` +
          `<div class="ks-row"><div class="ks-label">WebGL renderer</div><span class="ks-code" style="max-width:62%;text-align:right" id="ks-gpu-renderer">${esc(gpuInfo.renderer)}</span></div>` +
          `<div class="ks-stat-details" id="ks-diagnostics-note">CPU percentages are fractions of total logical CPU capacity. Browser RAM is summed working-set memory of the client-owned Electron/CEF process tree. First CPU sample may show zero.</div>` +
          `</div>` +
          `<div class="ks-card" style="margin-top:12px"><div class="ks-row"><div><div class="ks-label">Local Crash Reporter</div><div class="ks-desc">Logs app errors and identifies previously unclean shutdowns. Reports remain on your PC.</div></div><button class="ks-btn" data-action="open-logs">Open log folder</button></div><div class="ks-stat-details" id="ks-crash-status">${esc(crashStatus)}</div></div>` +
          `<p class="ks-hint">A visible WebGL renderer is not conclusive proof of full GPU acceleration. Fatal native crashes may not yield a full dump. Diagnostics are not uploaded.</p>`;
      case 'Frame Stability':
        return title('Frame Stability Monitor', 'Measures browser animation intervals, not GPU presentation or Kirka.io engine frames.') +
          `<div class="ks-note" id="ks-stability-native-fps">${esc(fpsDiagnosticText())}</div>`+
          `<p class="ks-hint">Browser callbacks, native Chromium flag requests and Kirka.io GPU FPS are three different measurements.</p>`+
          `<div class="ks-stability-grid">`+
            `<div class="ks-stability-stat"><div class="ks-metric-name">Median frame interval</div><div class="ks-metric-value" id="ks-stability-median">—</div></div>`+
            `<div class="ks-stability-stat"><div class="ks-metric-name">95th-percentile interval</div><div class="ks-metric-value" id="ks-stability-p95">—</div></div>`+
            `<div class="ks-stability-stat"><div class="ks-metric-name">99th-percentile interval</div><div class="ks-metric-value" id="ks-stability-p99">—</div></div>`+
            `<div class="ks-stability-stat"><div class="ks-metric-name">Browser interval jitter</div><div class="ks-metric-value" id="ks-stability-jitter">—</div></div>`+
            `<div class="ks-stability-stat"><div class="ks-metric-name">Long intervals</div><div class="ks-metric-value" id="ks-stability-stutter">—</div></div>`+
          `</div>`+
          `<div class="ks-comfort-grid"><div class="ks-card"><h3 class="ks-section-heading">Anti-aliasing / WebGL inspector</h3>`+
          `<div class="ks-row"><div class="ks-label">AA requested</div><span class="ks-code" id="ks-observed-aa-requested">—</span></div>`+
          `<div class="ks-row"><div class="ks-label">AA reported</div><span class="ks-code" id="ks-observed-aa-reported">—</span></div>`+
          `<div class="ks-row"><div class="ks-label">Canvas resolution</div><span class="ks-code" id="ks-observed-canvas-size">—</span></div>`+
          `<p class="ks-hint">No game engine AA override is applied.</p></div>`+
          `<div class="ks-card"><h3 class="ks-section-heading">Adaptive Sync & Camera Comfort</h3>`+
          `<p class="ks-note">Check G-SYNC Compatible / FreeSync in your monitor and GPU driver settings; the client cannot switch these on itself.</p>`+
          `<p class="ks-note">For more comfortable camera movement, test a lower in-game mouse sensitivity and FOV if Kirka.io offers it. The client does not alter your camera input.</p></div></div>`+
          `<p class="ks-hint">Browser timing spikes may indicate frame pacing problems; they do not prove the game actually stuttered.</p>`;
      case 'Eye Comfort':
        return title('Eye Comfort', 'Frame pacing, gentle canvas color filters, optional break reminders and visual diagnostics.') +
          `<div class="ks-comfort-grid"><div class="ks-card"><h3 class="ks-section-heading">Color and Softness</h3>`+
          toggleRow('Enable comfort filters','Changes color and optional softness of the game canvas only.','eyeEnabled')+
          selectRow('Comfort preset','Optional canvas-only CSS filters; not true anti-aliasing and may lower performance.','eyePreset',[
            {value:'Normal',label:'Normal (no filter)'},{value:'Soft',label:'Soft'},{value:'Warm',label:'Warm'},{value:'Custom',label:'Custom settings'}])+
          rangeRow('Brightness','eyeBrightness',80,115,'%')+
          rangeRow('Contrast','eyeContrast',70,115,'%')+
          rangeRow('Saturation','eyeSaturation',70,115,'%')+
          rangeRow('Warmth','eyeWarmth',0,60,'%')+
          rangeRow('Softness (CSS blur)','eyeSoftness',0,6,'/10 px')+
          `</div><div class="ks-card"><h3 class="ks-section-heading">Comfort filter preview</h3>`+
          `<div id="ks-comfort-preview" class="ks-comfort-preview"><span>KIRKA.IO</span><span>◈ ◇ △ ▰</span></div>`+
          `<p class="ks-hint">Filter preview is illustrative. It does not apply until enabled.</p>`+
          selectRow('Optional break reminder','Counts visible gameplay minutes only; does not interrupt the game or collect data.','breakReminderMinutes',[
            {value:0,label:'Off'},{value:20,label:'Every 20 minutes'},{value:30,label:'Every 30 minutes'},{value:45,label:'Every 45 minutes'},{value:60,label:'Every 60 minutes'}])+
          `<div class="ks-row"><div><div class="ks-label">Native resolution / Pixel Perfect</div><div class="ks-desc">Resets page zoom to 100%; does not change the game engine framebuffer.</div></div><button class="ks-btn primary" data-action="pixel-perfect">Use native monitor scaling</button></div>`+
          `</div></div><p class="ks-hint">Use cautiously: CSS blur can make text less sharp and may add GPU work. Start with softness 0.</p>`+
          `<p class="ks-hint">Pixel-perfect mode uses native display scaling. WebGL anti-aliasing and internal render scale remain controlled by Kirka.io.</p>`;
      case 'Crosshair':
        return title('Custom Crosshair', 'Create a fully customized visual overlay. No aim assistance or gameplay automation.') +
          `<div class="ks-note ks-crosshair-advice">${L('Tip: disable the default crosshair elements in Kirka.io settings to prevent a double crosshair.')}</div>` +
          `<div class="ks-crosshair-editor">` +
          `<div class="ks-crosshair-controls">` +
          `<div class="ks-card"><h3 class="ks-section-heading">Crosshair shape</h3>` +
          toggleRow('Enable custom crosshair','Disable the original Kirka.io crosshair to avoid doubling.','crosshairEnabled') +
          selectRow('Shape','Select one of 12 shapes','shape',[
            {value:'cross',label:'Cross (4 arms)'},{value:'plus',label:'Plus (connected)'},{value:'x',label:'X (diagonal)'},
            {value:'t',label:'T-shaped'},{value:'chevron',label:'Chevron (4 corners)'},{value:'circle',label:'Circle'},
            {value:'square',label:'Square'},{value:'diamond',label:'Diamond'},{value:'triangle',label:'Triangle'},
            {value:'bullseye',label:'Bullseye'},{value:'four-dots',label:'Four dots'},{value:'dot',label:'Single dot'}
          ]) +
          `<div class="ks-row"><div class="ks-label">Crosshair color</div><input data-setting="color" type="color" value="${esc(state.color)}"></div>` +
          rangeRow('Size','size',4,36,'px') + rangeRow('Gap','gap',0,24,'px') + rangeRow('Thickness','thickness',1,9,'px') + rangeRow('Opacity','opacity',20,100,'%') +
          `</div><div class="ks-card"><h3 class="ks-section-heading">Center dot</h3>` +
          toggleRow('Center dot','Independent color, size and shape.','centerDot') +
          `${state.centerDot ? (
            selectRow('Center shape','Choose the center point shape','centerDotShape',[{value:'circle',label:'Circle'},{value:'square',label:'Square'},{value:'diamond',label:'Diamond'}]) +
            `<div class="ks-row"><div class="ks-label">Center dot color</div><input data-setting="centerDotColor" type="color" value="${esc(state.centerDotColor)}"></div>` +
            rangeRow('Center dot size','centerDotSize',1,14,'px') +
            toggleRow('Center dot outline','Separate dark/light outline for the center','centerDotOutline') +
            (state.centerDotOutline ? `<div class="ks-row"><div class="ks-label">Center outline color</div><input data-setting="centerDotOutlineColor" type="color" value="${esc(state.centerDotOutlineColor)}"></div>` + rangeRow('Center outline thickness','centerDotOutlineThickness',1,5,'px') : '')
          ) : ''}` +
          `</div><div class="ks-card"><h3 class="ks-section-heading">Outline & shadow</h3>` +
          toggleRow('Crosshair outline','Add a separate outline color around the main shape','outlineEnabled') +
          `${state.outlineEnabled ? `<div class="ks-row"><div class="ks-label">Outline color</div><input data-setting="outlineColor" type="color" value="${esc(state.outlineColor)}"></div>` + rangeRow('Outline thickness','outlineThickness',1,6,'px') : ''}` +
          toggleRow('Drop shadow','Add a soft shadow to improve visibility','shadowEnabled') +
          `${state.shadowEnabled ? `<div class="ks-row"><div class="ks-label">Shadow color</div><input data-setting="shadowColor" type="color" value="${esc(state.shadowColor)}"></div>` + rangeRow('Shadow blur','shadowBlur',0,12,'px') + rangeRow('Shadow X offset','shadowOffsetX',-8,8,'px') + rangeRow('Shadow Y offset','shadowOffsetY',-8,8,'px') : ''}` +
          `</div>` +
          `<div class="ks-card"><h3 class="ks-section-heading">Crosshair Presets</h3>` +
          `<div class="ks-row"><div><div class="ks-label">Saved profiles</div><div class="ks-desc">Save, load or delete up to 12 complete presets, including outlines and shadows.</div></div></div>` +
          `<div class="ks-row"><select id="ks-preset-select" class="ks-input"><option value="">Select a saved preset</option>${savedPresets().map((p,i)=>`<option value="${i}">${esc(p.name)}</option>`).join('')}</select></div>` +
          `<div class="ks-row"><input id="ks-preset-name" class="ks-input" placeholder="New preset name" maxlength="30"><div class="ks-stack"><button class="ks-btn primary" data-action="preset-save">Save</button><button class="ks-btn" data-action="preset-load">Load</button><button class="ks-btn danger" data-action="preset-delete">Delete</button></div></div>` +
          `</div></div>` +
          `<aside class="ks-crosshair-preview-column"><div class="ks-card ks-preview-sticky">` +
          `<h3 class="ks-section-heading">Live preview</h3>` +
          `<div id="ks-preview-background" class="ks-preview ks-preview-large"><svg id="ks-preview-svg" viewBox="0 0 160 160"></svg></div>` +
          selectRow('Preview background','Change only the preview background; this does not affect the game.','previewBackground',[
            {value:'default',label:'Default'},{value:'black',label:'Black'},{value:'white',label:'White'}]) +
          `<p class="ks-hint">Preview uses the same vector drawing as the in-game overlay. Center dot and outlines are independent.</p>` +
          `</div></aside></div>`;
      case 'Appearance':
        return title('Appearance & Themes','Complete ready-made color palettes and optional visual-only effects. Your gameplay settings never change.') +
          `<div class="ks-grid"><div class="ks-card"><h3 class="ks-section-heading">Ready-made color palettes</h3>`+
          paletteTiles() +
          selectRow('Client theme','Apply a complete palette or keep custom colors','themePreset',Object.keys(themePalettes).map(name=>({value:name,label:name})).concat([{value:'Custom',label:'Custom colors'}])) +
          `<div class="ks-row"><div class="ks-label">Custom accent color</div><input data-setting="customAccent" type="color" value="${esc(state.customAccent)}"></div>` +
          `<div class="ks-row"><div class="ks-label">Background color</div><input data-setting="customBackground" type="color" value="${esc(state.customBackground)}"></div>` +
          `<div class="ks-row"><div class="ks-label">Panel color</div><input data-setting="customPanel" type="color" value="${esc(state.customPanel)}"></div>` +
          `<div class="ks-row"><div class="ks-label">Text color</div><input data-setting="customText" type="color" value="${esc(state.customText)}"></div>` +
          `<div class="ks-row"><div class="ks-label">Muted text color</div><input data-setting="customMuted" type="color" value="${esc(state.customMuted)}"></div>` +
          `</div><div class="ks-card"><h3 class="ks-section-heading">Extra visual effects</h3>`+
          selectRow('Surface style','Flat, frosted glass or subtle neon frame','themeSurface',[{value:'Solid',label:'Solid / Classic'},{value:'Frosted',label:'Frosted Glass'},{value:'Neon',label:'Neon Edge'}]) +
          selectRow('Background texture','Pattern inside KS Settings only','themePattern',[{value:'None',label:'None'},{value:'Grid',label:'Fine Grid'},{value:'Dots',label:'Soft Dots'}]) +
          selectRow('Spacing density','Only adjusts menu row spacing','themeDensity',[{value:'Compact',label:'Compact'},{value:'Comfortable',label:'Comfortable'},{value:'Spacious',label:'Spacious'}]) +
          rangeRow('Accent glow','themeGlow',0,100,'%') +
          rangeRow('Corner rounding','themeRadius',6,24,'px') +
          `<p class="ks-hint">Visual-only effects: no changes to game rendering, mouse control, hit detection, network or performance presets.</p></div>` +
          `<div class="ks-card"><h3 class="ks-section-heading">Typography & motion</h3>`+
          selectRow('Font family','Fonts already available in Windows / Electron/CEF','fontFamily',[{value:'Segoe UI',label:'Segoe UI'},{value:'Arial',label:'Arial'},{value:'Verdana',label:'Verdana'},{value:'Tahoma',label:'Tahoma'},{value:'Consolas',label:'Consolas'},{value:'KS Custom Font',label:'Uploaded font (Resources)'}]) +
          rangeRow('Client font size','fontSize',90,150,'%') +
          toggleRow('Menu animations','Enable client transitions and blur effects.','uiAnimations') +
          `<p class="ks-hint">Colors update instantly. Settings are saved automatically on this device.</p>`+
          `</div></div>`;
      case 'Resources':
        return title('Resource Swapper','Load local UI image, background, sound or font. Files stay on your device.') +
          `<div class="ks-card">` +
          uploadRow('Menu Background','Image applied behind KS Client settings; optional game selector in CSS Editor.','menuBackground','image/png,image/jpeg,image/webp') +
          toggleRow('Use custom settings background','Shows your uploaded background behind the dark menu overlay.','menuImageEnabled') +
          uploadRow('UI Image / Logo','Replaces the KS Client header logo; optional game selector in CSS Editor.','uiImage','image/png,image/jpeg,image/webp') +
          uploadRow('Menu Sound','A short local sound played when opening Settings, if enabled.','menuSound','audio/mpeg,audio/wav,audio/ogg,audio/mp4') +
          toggleRow('Play custom menu sound','Requires a selected sound; browser playback policy applies.','menuSoundEnabled') +
          `<div class="ks-row"><div><div class="ks-label">Audio test</div><div class="ks-desc">Play the uploaded menu sound now to confirm Electron/CEF allows playback.</div></div><button class="ks-btn primary" data-action="test-menu-sound">Test sound</button></div>` +
          `<div class="ks-row"><div><div class="ks-label">Local assets check</div><div class="ks-desc">Verify which uploaded resources are currently available in this profile.</div></div><button class="ks-btn" data-action="verify-assets">Verify assets</button></div>` +
          uploadRow('Custom Font','Upload a .woff or .woff2 font for use in Appearance.','localFont','.woff,.woff2,font/woff,font/woff2') +
          `</div><p class="ks-hint" id="ks-resource-status">${esc(resourceStatus)}</p>` +
          `<p class="ks-note">Resource swapping here affects KS Client UI and optionally selected game HTML elements via CSS. It does not intercept Kirka.io network assets, replace 3D textures, or alter game data. Upload rights-cleared assets only.</p>`;
      case 'CSS Editor':
        return title('Custom CSS Editor','Personalize HTML-based Kirka.io menus with your own stylesheet.') +
          `<div class="ks-card"><h3 class="ks-section-heading">Game HTML styling options</h3>` +
          toggleRow('Apply theme to game HTML menus','Best effort CSS styling of HTML buttons only; does not recolor WebGL-rendered menus.','gameThemeEnabled') +
          toggleRow('Apply font to game HTML menus','Optional HTML-only font override; not WebGL textures.','gameFontEnabled') +
          `<label class="ks-field"><span class="ks-label">Game menu CSS selector (advanced)</span><input class="ks-input" data-setting="menuSelector" value="${esc(state.menuSelector)}" placeholder="Optional HTML element selector e.g. .menu-background" maxlength="120"></label>` +
          `<label class="ks-field"><span class="ks-label">UI image target selector (advanced)</span><input class="ks-input" data-setting="uiImageSelector" value="${esc(state.uiImageSelector)}" placeholder="Optional HTML element selector" maxlength="120"></label>` +
          `<label class="ks-field"><span class="ks-label">Optional game HTML elements to hide (CSS selector)</span><input class="ks-input" data-setting="minimalSelectors" value="${esc(state.minimalSelectors)}" maxlength="120" placeholder="e.g. .optional-panel"></label>` +
          `<h3 class="ks-section-heading">Custom stylesheet editor</h3>` +
          toggleRow('Enable custom CSS','Applies only on pages using the KS Client overlay.','customCSSEnabled') +
          `<label class="ks-field"><span class="ks-label">Custom stylesheet (max 12,000 characters)</span><textarea class="ks-input" data-setting="customCSS" maxlength="12000" style="min-height:250px;font-family:Consolas,monospace" spellcheck="false" placeholder="/* Example: button { border-radius: 6px; } */">${esc(state.customCSS)}</textarea></label>` +
          `<div class="ks-stack"><button class="ks-btn primary" data-action="css-apply">Apply CSS</button><button class="ks-btn danger" data-action="css-clear">Clear CSS</button></div>` +
          `</div><p class="ks-hint">Styles can change or break page layouts. Use Clear CSS to undo custom changes. Script execution is not supported by this editor.</p>`;
      case 'Interface':
        return title('Client HUD & Style', 'Choose which KS Client widgets appear over the game.') +
          `<div class="ks-card">` +
          toggleRow('Client HUD enabled', 'Master switch for FPS counter, badge, crosshair and quick settings button', 'showHUD') +
          toggleRow('Show KS Client badge', 'Small KS Client label in the lower-left corner', 'showBadge') +
          toggleRow('Reduce client animations', 'Disable blur and decorative transitions in the KS interface', 'reduceMotion') +
          toggleRow('Minimal HUD', 'Hide nonessential KS overlays while keeping Settings accessible.', 'minimalHUD') +
          `<div class="ks-row"><div class="ks-label">Quick hide / show</div><button class="ks-btn" data-action="hud">Toggle client HUD · F10</button></div>` +
          `</div>` +
          `<p class="ks-hint">The KS menu theme now follows your black / orange KirkaStats and clan tracker style, including the darker panel cards and outlined action buttons.</p>`;
      case 'Browser Graphics':
        return title('Chromium / Electron/CEF Graphics', 'Chrome flags are applied to the embedded Electron/CEF process, not your installed Google Chrome.') +
          `<div class="ks-settings-columns"><div class="ks-card"><h3 class="ks-section-heading">GPU hardware acceleration</h3>`+
          browserSelect('GPU hardware acceleration','Disable GPU acceleration only to troubleshoot rendering defects; Kirka.io 3D can become slow or stop working.','gpu',[
            {value:'enabled',label:'Enabled (recommended)'},{value:'disabled',label:'Disabled (compatibility test)'}])+
          `<p class="ks-hint">chrome://settings/system — the equivalent settings for this embedded runtime are here.</p></div>`+
          `<div class="ks-card"><h3 class="ks-section-heading">ANGLE graphics backend</h3>`+
          browserSelect('ANGLE graphics backend','ANGLE changes and GPU startup flags require restarting KS Client.','angle',[
            {value:'default',label:'Automatic / Default'},{value:'d3d11',label:'D3D11 (DirectX 11)'},{value:'opengl',label:'OpenGL (experimental)'}])+
          `<p class="ks-hint">chrome://flags/#use-angle — applies only when Electron/CEF starts.</p>`+
          browserCheckbox('Experimental Unlimited FPS (Chromium)','Attempts to remove Chromium rAF/vsync limits. Requires a restart and may cause tearing, higher CPU load or network input delays.','uncapFps')+
          `</div></div>`+
          browserStatusBox()+
          `<div class="ks-stack" style="flex-wrap:wrap"><button class="ks-btn primary" data-action="browser-restart" ${!browserPrefsLoaded?'disabled':''}>Restart KS Client now</button></div>`+
          browserResetButton('graphics')+
          `<p class="ks-hint">Changes are stored per Windows user. Restart is required only for GPU/ANGLE.</p>`;
      case 'Browser Controls':
        return title('Electron/CEF Browser Controls','These settings use the native Electron/CEF Settings API. Some changes become fully visible after reloading the page.')+
          `<div class="ks-settings-columns"><div class="ks-card">`+
          browserCheckbox('Context menu','Enable the native Electron/CEF right-click menu.','contextMenu')+
          `</div><div class="ks-card">`+
          browserCheckbox('Developer tools (F12)','Allow opening Chromium DevTools for debugging.','devTools')+
          `</div></div>`+browserStatusBox()+browserResetButton('controls');
      case 'Browser GPU Info':
        return title('Electron/CEF GPU Diagnostics','Run WebGL checks on this exact embedded browser process.')+
          `<div class="ks-card"><div class="ks-row"><div><div class="ks-label">Graphics engine</div><div class="ks-desc">WebGL / WebGL2 / renderer</div></div><button class="ks-btn primary" data-action="browser-check-gpu">Run GPU check</button></div>`+
          `<div class="ks-row"><div class="ks-label">WebGL status</div><span class="ks-code" id="ks-browser-webgl">${esc(L(browserWebGL.webgl))}</span></div>`+
          `<div class="ks-row"><div class="ks-label">WebGL2 status</div><span class="ks-code" id="ks-browser-webgl2">${esc(L(browserWebGL.webgl2))}</span></div>`+
          `<div class="ks-row"><div class="ks-label">WebGL renderer</div><span class="ks-code" style="max-width:55%;overflow-wrap:anywhere;text-align:right" id="ks-browser-renderer">${esc(browserWebGL.renderer)}</span></div>`+
          `<div class="ks-row"><div class="ks-label">Compositing status</div><span class="ks-code" id="ks-browser-compositing">${esc(L(browserWebGL.compositing))}</span></div>`+
          `</div><p class="ks-hint">WebGL does not expose the Chromium compositing feature status. edge://gpu in standalone Edge is not a measurement of this KS Client process.</p>`;
    }
    return '';
  }

  function crosshairExtent() {
    const main = Number(state.size) + Number(state.gap) + Number(state.thickness);
    const dot = Number(state.centerDotSize) + Number(state.centerDotOutlineThickness);
    const edge = state.outlineEnabled ? Number(state.outlineThickness) * 2 : 0;
    const shadow = state.shadowEnabled ? Number(state.shadowBlur) * 2 + Math.max(Math.abs(Number(state.shadowOffsetX)),Math.abs(Number(state.shadowOffsetY))) : 0;
    return Math.max(50, Math.ceil(main + dot / 2 + edge + shadow + 8));
  }
  function drawCrosshair(svg, size = 160) {
    if (!svg) return;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
    const hex=v=>/^#[0-9a-f]{6}$/i.test(String(v))?String(v):'#ffffff';
    const c=hex(state.color), t=clamp(state.thickness,1,9), s=clamp(state.size,4,36), g=clamp(state.gap,0,24);
    const mid=size/2;
    const outline=!!state.outlineEnabled;
    const oc=hex(state.outlineColor), ot=clamp(state.outlineThickness,1,6);
    let parts=[];
    function strokeShape(tag, attrs) {
      if(outline) parts.push(`<${tag} ${attrs} fill="none" stroke="${oc}" stroke-width="${t+2*ot}" stroke-linecap="round" stroke-linejoin="round"/>`);
      parts.push(`<${tag} ${attrs} fill="none" stroke="${c}" stroke-width="${t}" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
    function fillShape(tag,attrs) {
      if(outline) parts.push(`<${tag} ${attrs} fill="${c}" stroke="${oc}" stroke-width="${ot*2}" stroke-linejoin="round" paint-order="stroke"/>`);
      else parts.push(`<${tag} ${attrs} fill="${c}"/>`);
    }
    const d4=`M ${mid} ${mid-g-s} V ${mid-g} M ${mid} ${mid+g} V ${mid+g+s} M ${mid-g-s} ${mid} H ${mid-g} M ${mid+g} ${mid} H ${mid+g+s}`;
    switch(state.shape) {
      case 'dot': fillShape('circle',`cx="${mid}" cy="${mid}" r="${Math.max(2,t+1)}"`);break;
      case 'circle': strokeShape('circle',`cx="${mid}" cy="${mid}" r="${Math.max(3,s+g/2)}"`);break;
      case 'square': strokeShape('rect',`x="${mid-s-g/2}" y="${mid-s-g/2}" width="${(s+g/2)*2}" height="${(s+g/2)*2}" rx="1"`);break;
      case 'diamond': {let q=s+g/2;strokeShape('path',`d="M ${mid} ${mid-q} L ${mid+q} ${mid} L ${mid} ${mid+q} L ${mid-q} ${mid} Z"`);break;}
      case 'triangle': {let q=s+g/2;strokeShape('path',`d="M ${mid} ${mid-q} L ${mid+q} ${mid+q} L ${mid-q} ${mid+q} Z"`);break;}
      case 'bullseye': strokeShape('circle',`cx="${mid}" cy="${mid}" r="${Math.max(4,s)}"`);strokeShape('circle',`cx="${mid}" cy="${mid}" r="${Math.max(2,s/2)}"`);break;
      case 'x': {let q=s+g;strokeShape('path',`d="M ${mid-q} ${mid-q} L ${mid-g/1.4} ${mid-g/1.4} M ${mid+g/1.4} ${mid+g/1.4} L ${mid+q} ${mid+q} M ${mid+q} ${mid-q} L ${mid+g/1.4} ${mid-g/1.4} M ${mid-g/1.4} ${mid+g/1.4} L ${mid-q} ${mid+q}"`);break;}
      case 't': strokeShape('path',`d="M ${mid} ${mid-g-s} V ${mid-g} M ${mid-g-s} ${mid} H ${mid-g} M ${mid+g} ${mid} H ${mid+g+s}"`);break;
      case 'chevron': {let q=s+g;strokeShape('path',`d="M ${mid-q} ${mid-q} L ${mid-g} ${mid-g} M ${mid+q} ${mid-q} L ${mid+g} ${mid-g} M ${mid+q} ${mid+q} L ${mid+g} ${mid+g} M ${mid-q} ${mid+q} L ${mid-g} ${mid+g}"`);break;}
      case 'four-dots': {let q=s+g;for(const [dx,dy] of [[0,-q],[q,0],[0,q],[-q,0]])fillShape('circle',`cx="${mid+dx}" cy="${mid+dy}" r="${Math.max(2,t)}"`);break;}
      case 'plus': strokeShape('path',`d="M ${mid} ${mid-s-g} V ${mid+s+g} M ${mid-s-g} ${mid} H ${mid+s+g}"`);break;
      default: strokeShape('path',`d="${d4}"`);
    }
    if(state.centerDot) {
      const r=clamp(state.centerDotSize,1,14), cc=hex(state.centerDotColor),
            dOutline=!!state.centerDotOutline,
            da= dOutline ? `stroke="${hex(state.centerDotOutlineColor)}" stroke-width="${clamp(state.centerDotOutlineThickness,1,5)*2}" paint-order="stroke"` : '';
      if(state.centerDotShape==='square')parts.push(`<rect x="${mid-r}" y="${mid-r}" width="${2*r}" height="${2*r}" rx="0" fill="${cc}" ${da}/>`);
      else if(state.centerDotShape==='diamond')parts.push(`<path d="M ${mid} ${mid-r} L ${mid+r} ${mid} L ${mid} ${mid+r} L ${mid-r} ${mid} Z" fill="${cc}" ${da}/>`);
      else parts.push(`<circle cx="${mid}" cy="${mid}" r="${r}" fill="${cc}" ${da}/>`);
    }
    const blur=clamp(state.shadowBlur,0,12),dx=clamp(state.shadowOffsetX,-8,8),dy=clamp(state.shadowOffsetY,-8,8);
    // CSS drop-shadow works reliably inside Electron/CEF Shadow DOM. SVG url(#filter)
    // references can fail to resolve across that boundary and hide the drawing.
    svg.setAttribute('viewBox',`0 0 ${size} ${size}`);
    svg.style.filter=state.shadowEnabled?`drop-shadow(${dx}px ${dy}px ${blur}px ${hex(state.shadowColor)})`:'none';
    svg.innerHTML=`<g opacity="${clamp(state.opacity,20,100)/100}">${parts.join('')}</g>`;
  }

  // Per-origin IndexedDB stores local UI assets as Blobs (no upload or external server).
  function openAssetDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('KSClientLocalResourcesAlpha', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('assets');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || Error('IndexedDB unavailable'));
    });
  }
  async function assetOp(mode, key, value) {
    const db = await openAssetDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assets', mode);
      const store = tx.objectStore('assets');
      const request = mode === 'readonly' ? store.get(key) : value === null ? store.delete(key) : store.put(value, key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
      tx.onerror = () => { db.close();reject(tx.error); };
    });
  }
  async function saveAsset(key,file) { return assetOp('readwrite',key,file); }
  async function deleteAsset(key) { return assetOp('readwrite',key,null); }
  function setAssetURL(key,blob) {
    if (assetURLs[key]) URL.revokeObjectURL(assetURLs[key]);
    delete assetURLs[key];
    if (blob instanceof Blob) assetURLs[key]=URL.createObjectURL(blob);
  }
  async function loadLocalAssets() {
    for (const key of assetKeys) {
      try {
        const blob = await assetOp('readonly',key);
        if(blob instanceof Blob) {setAssetURL(key,blob);assetMeta[key]=blob.name||'Saved local resource';}
      } catch(error) {resourceStatus='Some local resources could not be loaded.';}
    }
    apply();renderTab();
  }
  function updateResourcesInUI() {
    const status=$('ks-resource-status'); if(status) status.textContent=L(resourceStatus);
    shadow.querySelectorAll('[data-asset-summary]').forEach(el=>{el.textContent=L(assetLabel(el.dataset.assetSummary));});
  }
  function safeSelector(raw) {
    const selector=String(raw||'').trim().slice(0,120);
    if(!selector || /[{};\x00-\x1f]/.test(selector))return '';
    try {document.querySelector(selector);}catch(_){return '';}
    return selector;
  }
  function buildPageStyles() {
    const css=[];
    const accent=currentAccent();
    if(state.customCSSEnabled)css.push(String(state.customCSS).slice(0,12000));
    if(state.gameThemeEnabled)css.push(`button:not([disabled]),[role="button"]{accent-color:${accent};}button:focus-visible{outline-color:${accent} !important;}`);
    if(state.gameFontEnabled) {
      let family=state.fontFamily;
      if(family==='KS Custom Font' && assetURLs.localFont) {
        css.push(`@font-face{font-family:"KS Custom Font";src:url("${assetURLs.localFont}");font-display:swap;}`);
        family='KS Custom Font';
      }
      if(family==='KS Custom Font'&&!assetURLs.localFont) family='Segoe UI';
      css.push(`button,input,select,textarea{font-family:"${family}" !important;font-size:calc(1em * ${Math.max(.9,Math.min(1.5,Number(state.fontSize)/100))}) !important;}`);
    }
    const menuSelector=safeSelector(state.menuSelector);
    if(state.menuImageEnabled && assetURLs.menuBackground && menuSelector) css.push(`${menuSelector}{background-image:url("${assetURLs.menuBackground}") !important;background-size:cover !important;background-position:center !important;}`);
    const imageSelector=safeSelector(state.uiImageSelector);
    if(assetURLs.uiImage && imageSelector) css.push(`${imageSelector}{background-image:url("${assetURLs.uiImage}") !important;background-size:contain !important;background-repeat:no-repeat !important;background-position:center !important;}`);
    const minimSelector=safeSelector(state.minimalSelectors);
    if(state.minimalHUD && minimSelector)css.push(`${minimSelector}{visibility:hidden !important;}`);
    return css.join('\n');
  }
  function checkGPU() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 2;
      const gl = canvas.getContext('webgl2', { antialias:false }) || canvas.getContext('webgl', { antialias:false });
      if (!gl) {
        gpuInfo = { status:'WebGL unavailable', renderer:'Unknown', note:'No WebGL context could be created' };
      } else {
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        const vendor = debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
        const software = /swiftshader|llvmpipe|software rasterizer|softpipe|mesa offscreen/i.test(String(renderer));
        gpuInfo = {
          status: software ? 'Software renderer detected' : 'WebGL available (GPU unconfirmed)',
          renderer: String(vendor) + ' · ' + String(renderer),
          note: software ? 'The renderer reports software rendering.' : 'WebGL works; check Edge DevTools for compositing and all GPU feature status.'
        };
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    } catch (error) {
      gpuInfo = { status:'Unknown', renderer:'Not available', note:String(error) };
    }
    updateDiagnosticsUI();
  }

  function checkBrowserGPU() {
    const getContext = id => {
      const canvas=document.createElement('canvas');canvas.width=canvas.height=2;
      try{return canvas.getContext(id,{failIfMajorPerformanceCaveat:false});}catch(_){return null;}
    };
    const one=getContext('webgl'); const two=getContext('webgl2');
    const gl=two||one;
    browserWebGL={
      webgl: one ? 'Supported' : 'Unavailable',
      webgl2: two ? 'Supported' : 'Unavailable',
      renderer: 'Unavailable',
      compositing: 'Not accessible from WebGL'
    };
    if(gl){
      try {
        const ext=gl.getExtension('WEBGL_debug_renderer_info');
        browserWebGL.renderer=String(ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER));
      }catch(e){browserWebGL.renderer='Not checked';}
    }
    one?.getExtension('WEBGL_lose_context')?.loseContext();
    two?.getExtension('WEBGL_lose_context')?.loseContext();
    for(const [id,value] of [['ks-browser-webgl',browserWebGL.webgl],['ks-browser-webgl2',browserWebGL.webgl2],['ks-browser-renderer',browserWebGL.renderer],['ks-browser-compositing',browserWebGL.compositing]]){
      const n=$(id);if(n)n.textContent=L(value);
    }
    checkGPU();
  }

  function updateDiagnosticsUI() {
    // Native samples may be incomplete. Never let missing fields break Settings.
    const d=diagnostics;
    const set=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
    const valid=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
    const cpu=value=>valid(value)?value.toFixed(1)+'%':'—';
    const ram=value=>valid(value)?Math.round(value)+' MB':'—';
    const render=window.__KS_RENDER_TELEMETRY__?.getStatus();
    set('ks-game-draws',render?.active && render.attached?String(render.drawsPerSecond):'—');
    set('ks-browser-cpu',cpu(d?.browserCPU));
    set('ks-client-cpu',cpu(d?.clientCPU));
    set('ks-browser-ram',ram(d?.browserRAM));
    set('ks-client-ram',ram(d?.clientRAM));
    set('ks-browser-processes',Number.isInteger(d?.browserProcesses)&&d.browserProcesses>=0?String(d.browserProcesses):'—');
    set('ks-gpu-state',L(gpuInfo.status));
    set('ks-gpu-renderer',gpuInfo.renderer);
    set('ks-diagnostics-note',[d?.sampling,L(gpuInfo.note)].filter(Boolean).join('. '));
  }

  function drawLineGraph(canvasId, values, label, maxValue, suffix) {
    const canvas = $(canvasId);
    if (!canvas || !state.showGraph) return;
    const width = Math.max(250,Math.round(canvas.clientWidth));
    const height = Math.max(100,Math.round(canvas.clientHeight));
    const dpr = Math.min(1.5,window.devicePixelRatio || 1);
    if(canvas.width!==Math.round(width*dpr))canvas.width=Math.round(width*dpr);
    if(canvas.height!==Math.round(height*dpr))canvas.height=Math.round(height*dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,width,height);
    ctx.strokeStyle = '#3f3219'; ctx.lineWidth = 1;
    for(let y=1;y<4;y++) { const py=(height-25)*y/4; ctx.beginPath();ctx.moveTo(42,py);ctx.lineTo(width-10,py);ctx.stroke(); }
    const high = Math.max(1,maxValue);
    ctx.fillStyle='#b9ab8d';ctx.font='11px Segoe UI';ctx.textAlign='left';
    ctx.fillText(label,12,15);ctx.fillText('0',13,height-15);
    ctx.fillText(`${Math.round(high)} ${suffix}`,12,31);
    if(values.length<2) { ctx.fillText('Collecting data…',width/2-50,height/2);return; }
    const left=45,right=width-12,top=22,bottom=height-25;
    ctx.strokeStyle='#f4a61c';ctx.lineWidth=2;ctx.beginPath();
    values.forEach((value,i)=>{
      const x=left+(right-left)*(i/Math.max(1,values.length-1));
      const y=bottom-(bottom-top)*Math.min(1,Math.max(0,value)/high);
      if(i===0) ctx.moveTo(x,y);else ctx.lineTo(x,y);
    });
    ctx.stroke();
  }

  function paintGraphs() {
    const graphs=$('ks-graphs');
    if(graphs) graphs.style.display=state.showGraph?'block':'none';
    if(!open || selectedTab!=='Performance' || !state.showGraph)return;
    drawLineGraph('ks-graph-fps',fpsHistory,'FPS',Math.max(60,Number(state.fpsLimit)||0,...fpsHistory),'FPS');
    drawLineGraph('ks-graph-ms',frameHistory,L('Frame interval'),Math.max(20,...frameHistory),'ms');
  }

  function applyPerformancePreset(preset) {
    const profiles={
      'Low': {gameResolution:'720',fpsLimit:60,uiAnimations:false,showGraph:false,lowLatency:true},
      'Balanced': {gameResolution:'native',fpsLimit:0,uiAnimations:true,showGraph:true,lowLatency:false},
      'High Performance': {gameResolution:'native',fpsLimit:0,uiAnimations:false,showGraph:false,lowLatency:true}
    };
    if (!profiles[preset]) return;
    state={...state,...profiles[preset],smoothPreset:'Native',performancePreset:preset};
    save();
    window.__KS_FRAME_PACER__?.setLimit(state.fpsLimit);
    notify('game-resolution',{preset:state.gameResolution});
    apply(); renderTab();
  }


  function updatePreviewBackground() {
    const el = $('ks-preview-background');
    if (!el) return;
    const choices = { default:'#111820', black:'#000000', white:'#ffffff' };
    el.style.backgroundColor = choices[state.previewBackground] || choices.default;
    el.style.backgroundImage = 'none';
    el.style.borderColor = state.previewBackground === 'white' ? '#b2bac5' : 'rgba(255,255,255,.12)';
  }

  // Find existing settings by section name and common option names; never
  // reconstruct or delete controls while searching.
  const settingsSearchTerms = {
    Display:'resolution fullscreen scaling zoom monitor screen felbontas kepernyo kijelzo',
    Performance:'fps unlimited uncap limit low latency high performance renderer frame pacing cpu teljesitmeny sebesseg korlatlan',
    'Frame Stability':'stutter frametime jitter webgl antialiasing sync fps graph kepkocka stabilitas akadas',
    'Game Integration':'stats keystrokes quick join mouse lock screenshot hud jatekintegracio billentyu statisztika talalat eger',
    'Eye Comfort':'brightness contrast warmth saturation softness blue light break reminders szemkimelo szemkomfort fenyero szinhomerseklet',
    Crosshair:'crosshair dot color shape outline shadow thickness gap celkereszt szin korvonal arnyek',
    Appearance:'theme accent dark colors background text font megjelenes tema betutipus',
    Interface:'menu size ui scale motion animations interface felulet menu nagyitas animacio',
    Resources:'custom image font sound backgrounds audio eroforras kep hang',
    'CSS Editor':'custom css styles selectors css szerkeszto stilus',
    General:'client engine cef electron restart settings language altalanos nyelv ujrainditas',
    Updates:'update auto download install version channel frissites letoltes telepites',
    Sharing:'export import backup restore settings megosztas biztonsagi mentes',
    Diagnostics:'logs memory cpu gpu crashes renderer diagnosztika naplo memoria',
    'Browser Graphics':'gpu hardware acceleration angle directx opengl',
    'Browser Controls':'devtools shortcuts context menu',
    'Browser GPU Info':'gpu webgl diagnostics renderer',
    'Weapon Studio':'weapon skin link cosmetics color presets',
    'Resource Swapper':'resource swapping assets image audio css',
    Plugins:'javascript sandbox extensions bovitmeny',
    Lobby:'quick join favorite rooms map modes weapon szoba csatlakozas palya jatekmod',
    'Friends & Profiles':'friend player spectate profile',
    'Inventory & Market':'inventory favorites market price items'
  };
  const normalizeSettingsQuery = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  function updateSettingsSearch(value) {
    const results=$('ks-search-results'),categories=$('ks-sidebar-groups');
    if(!results||!categories)return;
    const query=normalizeSettingsQuery(String(value||'').trim());
    if(!query){results.hidden=true;results.innerHTML='';categories.hidden=false;return;}
    const matching=tabs.filter(name=>{
      const category=groups.find(g=>g.items.includes(name));
      return [name,translateTab(name),category?.key||'',translateTab(category?.key||''),settingsSearchTerms[name]||'']
        .some(text=>normalizeSettingsQuery(text).includes(query));
    });
    results.innerHTML=matching.length ? matching.map(name=>{
      const category=groups.find(g=>g.items.includes(name));
      return `<button type="button" class="ks-search-result" data-tab="${esc(name)}"><span>${esc(translateTab(name))}</span><span class="ks-search-path">${esc(translateTab(category?.key||''))}</span></button>`;
    }).join('') : `<div class="ks-search-empty">${L('No matching settings. Try another term.')}</div>`;
    categories.hidden=true;results.hidden=false;
  }

  function renderTab() {
    window.__KS_WORKSHOP__?.stopPlugin?.();
    syncMeasurement();
    closeCustomSelect();
    const group=currentGroup();
    $('ks-nav').innerHTML = `<div class="ks-sidebar-caption">${L('SETTINGS')}</div>`+
      `<div id="ks-menu-search-wrap"><input id="ks-menu-search" type="search" autocomplete="off" spellcheck="false" aria-label="${L('Search settings')}" placeholder="${state.language==='hu'?'Keresés a beállításokban…':'Search settings…'}"></div>`+
      `<div id="ks-search-results" role="group" hidden></div>`+
      `<div id="ks-sidebar-groups">`+
      groups.map(g=>`<button class="ks-tab ${group.key===g.key?'active':''}" data-group="${esc(g.key)}" aria-current="${group.key===g.key?'page':'false'}"><span class="ks-tab-icon" aria-hidden="true">${groupIcon(g.key)}</span><span>${translateTab(g.key)}</span>${g.key==='Workshop'?'<span class="ks-experimental-badge">EXPERIMENTAL</span>':''}</button>`).join('')+
      `</div><div class="ks-sidebar-foot">KS CLIENT <span>${esc(CLIENT_LABEL.toUpperCase())}</span><div style="opacity:.7;margin-top:5px">F1 · ${L('Settings')} &nbsp; F10 · HUD</div></div>`;
    $('ks-body').innerHTML = `<nav class="ks-subtabs" aria-label="Settings section">`+
      group.items.map(t=>`<button class="ks-subtab ${selectedTab===t?'active':''}" data-tab="${esc(t)}" aria-current="${selectedTab===t?'page':'false'}">${translateTab(t)}</button>`).join('')+
      `</nav>`+tabContent()+sectionResetMarkup()+
      (["Weapon Studio","Resource Swapper","Plugins","Lobby","Friends & Profiles","Inventory & Market"].includes(selectedTab)
        ? `<div class="ks-note" id="ks-wk-status">${esc(window.__KS_WORKSHOP__?.getStatus()||'Ready')}</div>`:'');
    if(group.key==='Workshop')$('ks-body').querySelector('.ks-subtabs')?.insertAdjacentHTML('afterend',
      '<div class="ks-workshop-experimental" role="note"><strong>EXPERIMENTAL · BETA</strong><span>Workshop features are still in testing. Back up your profiles before importing resources or running plugins.</span></div>');
    localizePanel($('ks-body'));
    layoutSettingsCards();
    enhanceCustomSelects();
    updateShellLanguage();
    const preview = $('ks-preview-svg');
    if (preview) drawCrosshair(preview);
    updatePreviewBackground();
    updateDiagnosticsUI();
    updateStabilityDiagnostics();
    updateComfortPreview();
    paintGraphs();
  }

  function layoutSettingsCards() {
    // Related settings stay together instead of splitting option lists in the
    // middle. All nodes (including selects, descriptions and buttons) move
    // intact; event delegation continues working across both Chromium engines.
    const splits={
      Display:['showFPS','Window & Resolution','FPS Counter & Overlay'],
      Performance:['smoothPreset','Frame Rate & Browser','Smoothness & Visual Effects'],
      Interface:['reduceMotion','HUD & In-game Labels','Motion & Compact UI'],
      Appearance:['fontFamily','Colors & Theme','Fonts & Typography'],
      General:['fullscreen','Browser Engine','Client & Maintenance']
    };
    const spec=splits[selectedTab];
    if(!spec)return;
    const primary=$('ks-body').querySelector('.ks-card');
    if(!primary)return;
    const children=Array.from(primary.children);
    const marker=children.findIndex(node=>node.querySelector?.('[data-setting="'+spec[0]+'"],[data-action="'+spec[0]+'"]'));
    if(marker<1 || marker>=children.length)return;
    const wrap=document.createElement('div');
    wrap.className='ks-settings-columns ks-related-groups';
    const make=(heading,nodes)=>{
      const card=document.createElement('section');
      card.className='ks-card';
      const h=document.createElement('h3');h.className='ks-section-heading';h.textContent=heading;
      card.appendChild(h);
      nodes.forEach(node=>card.appendChild(node));
      return card;
    };
    wrap.append(make(spec[1],children.slice(0,marker)),make(spec[2],children.slice(marker)));
    primary.replaceWith(wrap);
  }

  // The browser's native select popup is rendered outside the page style system;
  // implement an accessible select popup entirely within the client Shadow DOM.
  let activeSelect=null, activePopup=null;
  function closeCustomSelect() {
    if (activeSelect) activeSelect.querySelector('.ks-select-trigger')?.setAttribute('aria-expanded','false');
    if (activePopup) {activePopup.remove();activePopup=null;}
    activeSelect=null;
  }
  function enhanceCustomSelects() {
    $('ks-body').querySelectorAll('select.ks-input,select[data-setting]').forEach(select=>{
      const shell=document.createElement('span');shell.className='ks-select-shell';
      select.parentNode.insertBefore(shell,select);shell.appendChild(select);
      select.tabIndex=-1;select.setAttribute('aria-hidden','true');
      const button=document.createElement('button');button.type='button';button.className='ks-select-trigger';
      button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');
      const selected=select.options[select.selectedIndex];
      button.innerHTML=`<span class="ks-select-value"></span><span class="ks-select-chevron">▾</span>`;
      button.querySelector('.ks-select-value').textContent=selected?.textContent||'';
      button.setAttribute('aria-label',select.dataset.setting||'Choose option');
      shell.appendChild(button);
      button.addEventListener('click',()=>{if(activeSelect===shell) closeCustomSelect();else openCustomSelect(shell,select);});
      button.addEventListener('keydown',e=>{
        if(['ArrowDown','ArrowUp',' ','Enter'].includes(e.key)) {e.preventDefault(); if(activeSelect!==shell)openCustomSelect(shell,select);}
        if(e.key==='Escape'){e.preventDefault();closeCustomSelect();}
      });
    });
  }
  function openCustomSelect(shell,select) {
    closeCustomSelect();
    const trigger=shell.querySelector('.ks-select-trigger');
    const popup=document.createElement('div');popup.className='ks-select-popup';popup.setAttribute('role','listbox');
    popup.setAttribute('aria-label',select.dataset.setting||'Options');
    Array.from(select.options).forEach((option,i)=>{
      const b=document.createElement('button');b.type='button';b.setAttribute('role','option');
      b.setAttribute('aria-selected',String(option.selected));b.textContent=option.textContent;
      b.disabled=option.disabled;
      b.addEventListener('click',()=>{select.selectedIndex=i;trigger.querySelector('.ks-select-value').textContent=option.textContent;closeCustomSelect();select.dispatchEvent(new Event('change',{bubbles:true}));trigger.focus();});
      popup.appendChild(b);
    });
    $('ks-screen').appendChild(popup);
    const r=trigger.getBoundingClientRect();
    const maxWidth=Math.max(165,Math.min(310,window.innerWidth-26));
    const width=Math.min(maxWidth,Math.max(r.width,215));
    const height=Math.min(275,popup.scrollHeight+12);
    const below=window.innerHeight-r.bottom-14,above=r.top-14;
    const putAbove=below<Math.min(height,160)&&above>below;
    popup.style.width=width+'px';
    popup.style.left=Math.max(12,Math.min(r.left,window.innerWidth-width-12))+'px';
    popup.style.top=(putAbove?Math.max(10,r.top-height-5):Math.min(window.innerHeight-height-10,r.bottom+5))+'px';
    activeSelect=shell;activePopup=popup;trigger.setAttribute('aria-expanded','true');
    const selectedButton=popup.querySelector('button[aria-selected="true"]');
    selectedButton?.scrollIntoView({block:'nearest'});
    (selectedButton||popup.querySelector('button'))?.focus({preventScroll:true});
  }

  function comfortFilterCSS() {
    const b=Math.max(80,Math.min(115,Number(state.eyeBrightness)||100))/100;
    const c=Math.max(70,Math.min(115,Number(state.eyeContrast)||100))/100;
    const sat=Math.max(70,Math.min(115,Number(state.eyeSaturation)||100))/100;
    const warm=Math.max(0,Math.min(60,Number(state.eyeWarmth)||0))/100*0.28;
    const blur=Math.max(0,Math.min(6,Number(state.eyeSoftness)||0))/10;
    return `brightness(${b}) contrast(${c}) saturate(${sat}) sepia(${warm.toFixed(3)})${blur>0?' blur('+blur.toFixed(1)+'px)':''}`;
  }
  function updateComfortPreview() {
    const el=$('ks-comfort-preview');
    if(el) el.style.filter=state.eyeEnabled?comfortFilterCSS():'none';
  }
  function applyEyePreset(preset) {
    const options={
      Normal: {eyeEnabled:false,eyeBrightness:100,eyeContrast:100,eyeSaturation:100,eyeWarmth:0,eyeSoftness:0},
      Soft: {eyeEnabled:true,eyeBrightness:100,eyeContrast:91,eyeSaturation:94,eyeWarmth:10,eyeSoftness:0},
      Warm: {eyeEnabled:true,eyeBrightness:98,eyeContrast:94,eyeSaturation:95,eyeWarmth:36,eyeSoftness:0}
    };
    if(preset==='Custom') {state.eyePreset='Custom'; save(); renderTab();apply();return;}
    if(!options[preset])return;
    Object.assign(state,options[preset],{eyePreset:preset});save();renderTab();apply();
  }
  function applySmoothPreset(preset) {
    const target={Native:0,Comfort:120,Balanced:144,Smooth:165}[preset];
    if(target===undefined)return;
    state.smoothPreset=preset;state.fpsLimit=target;save();
    window.__KS_FRAME_PACER__?.setLimit(target);
    renderTab();apply();
  }
  const stabilitySamples=[];
  function updateStabilityDiagnostics() {
    if(!open||selectedTab!=='Frame Stability')return;
    const m = id=>$(id);
    if(stabilitySamples.length<25){for(const id of ['ks-stability-median','ks-stability-p95','ks-stability-p99','ks-stability-jitter','ks-stability-stutter'])if(m(id))m(id).textContent=L('Not enough samples');}
    else {
      const sorted=[...stabilitySamples].sort((a,b)=>a-b);
      const pct=f=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*f))];
      const mid=pct(.50),p95=pct(.95);
      const spikes=stabilitySamples.filter(v=>v>1.5*mid).length;
      if(m('ks-stability-median'))m('ks-stability-median').textContent=mid.toFixed(1)+' ms';
      if(m('ks-stability-p95'))m('ks-stability-p95').textContent=p95.toFixed(1)+' ms';
      if(m('ks-stability-p99'))m('ks-stability-p99').textContent=pct(.99).toFixed(1)+' ms';
      if(m('ks-stability-jitter'))m('ks-stability-jitter').textContent=(p95-mid).toFixed(1)+' ms';
      if(m('ks-stability-stutter'))m('ks-stability-stutter').textContent=spikes+'/'+stabilitySamples.length;
    }
    const observed=window.__KS_RENDER_OBSERVER__?.getStats?.();
    const aa=value=>typeof value==='boolean'?L(value?'Enabled':'Disabled'):L('Unknown (not observed)');
    if(m('ks-observed-aa-requested'))m('ks-observed-aa-requested').textContent=aa(observed?.antialiasRequested);
    if(m('ks-observed-aa-reported'))m('ks-observed-aa-reported').textContent=aa(observed?.antialiasReported);
    if(m('ks-observed-canvas-size'))m('ks-observed-canvas-size').textContent=observed?.canvasWidth>0?`${observed.canvasWidth} × ${observed.canvasHeight}`:L('No game WebGL context observed yet');
  }
  let visiblePlayMinutes=0;
  function updateBreakReminderState() {
    if(!state.breakReminderMinutes) {
      visiblePlayMinutes=0;
      $('ks-break-reminder').hidden=true;
    }
  }
  setInterval(()=>{
    if(!isGamePage || document.hidden || open || !state.breakReminderMinutes)return;
    visiblePlayMinutes++;
    if(visiblePlayMinutes>=Number(state.breakReminderMinutes)) {
      visiblePlayMinutes=0;
      $('ks-break-text').textContent=L('Take a short visual break. Look away from the screen for a moment.');
      $('ks-break-reminder').hidden=false;
    }
  },60000);
  $('ks-break-dismiss').addEventListener('click',()=>{$('ks-break-reminder').hidden=true;});

  let crosshairSignature;
  function apply() {
    syncMeasurement();
    $('ks-dimmer').classList.toggle('visible', open);
    // Avoid a full-screen blur of the running WebGL surface: reduces GPU compositing.
    $('ks-dimmer').style.backdropFilter='none';
    $('ks-dimmer').style.webkitBackdropFilter='none';
    $('ks-dimmer').style.background='rgba(0,0,0,.92)';
    $('ks-screen').classList.toggle('no-motion', !state.uiAnimations || state.lowLatency || state.reduceMotion);
    const scale = Math.max(1, Math.min(1.6, Number(state.uiScale)/100 || 1));
    $('ks-panel').style.setProperty('--ks-ui-scale', String(scale));

    const accent = currentAccent();
    $('ks-screen').style.setProperty('--ks-accent', accent);
    $('ks-screen').style.setProperty('--ks-bg', themeColor(state.customBackground,defaults.customBackground));
    $('ks-screen').style.setProperty('--ks-panel', themeColor(state.customPanel,defaults.customPanel));
    $('ks-screen').style.setProperty('--ks-text', themeColor(state.customText,defaults.customText));
    $('ks-screen').style.setProperty('--ks-muted', themeColor(state.customMuted,defaults.customMuted));
    $('ks-screen').style.setProperty('--ks-soft', themeColor(state.customBackground,defaults.customBackground));
    $('ks-screen').style.setProperty('--ks-accent-contrast', themeContrast(accent));
    $('ks-screen').style.setProperty('--ks-font-scale', String(state.fontSize / 100));
    const family = state.fontFamily === 'KS Custom Font' && assetURLs.localFont ? 'KS Custom Font' : state.fontFamily;
    $('ks-screen').style.setProperty('--ks-font-family', (family === 'KS Custom Font' ? '"KS Custom Font"' : `'${family.replace(/'/g,'')}'`) + ', sans-serif');
    const fontStyle = $('ks-local-font-style') || document.createElement('style');
    fontStyle.id = 'ks-local-font-style';
    fontStyle.textContent = assetURLs.localFont ? `@font-face{font-family:"KS Custom Font";src:url("${assetURLs.localFont}");font-display:swap;}` : '';
    if (!fontStyle.isConnected) shadow.appendChild(fontStyle);
    // Beta 1.0.1: the 1.0.0 visual polish used hard-coded orange/white
    // !important rules. Override ONLY when a custom palette is selected.
    // Keep the original dark-orange Beta design for unchanged profiles.
    const themeStyle=$('ks-theme-overrides') || document.createElement('style');
    themeStyle.id='ks-theme-overrides';
    const typographyRules=`
      #ks-screen #ks-panel {font-family:var(--ks-font-family)!important;}
      #ks-screen #ks-panel :is(button,input,select,textarea,.ks-label,.ks-tab,.ks-subtab,.ks-hint,.ks-desc,.ks-field,.ks-status,.ks-pill) {
        font-family:var(--ks-font-family)!important;
      }
      #ks-screen #ks-panel :is(.ks-label,.ks-tab,.ks-subtab,.ks-btn,.ks-input,.ks-select-trigger,.ks-field) {
        font-size:calc(12px * var(--ks-font-scale))!important;
      }
      #ks-screen #ks-panel :is(.ks-desc,.ks-hint,.ks-status,.ks-sidebar-foot,.ks-release-body,.ks-note) {
        font-size:calc(11px * var(--ks-font-scale))!important;
      }
    `;
    const paletteRules=`
      #ks-screen #ks-panel{background-color:var(--ks-bg)!important;color:var(--ks-text)!important;}
      #ks-screen #ks-panel :is(#ks-top,#ks-nav,#ks-foot){background:var(--ks-bg)!important;color:var(--ks-text)!important;}
      #ks-screen #ks-panel :is(.ks-card,.ks-note,.ks-section-reset,.ks-release,.ks-history,.ks-hint-box) {
        background-color:var(--ks-panel)!important;color:var(--ks-text)!important;
      }
      #ks-screen #ks-panel :is(.ks-title,.ks-label,.ks-graphic-presets-label,#ks-brand-main,.ks-metric-value,.ks-history-heading) {
        color:var(--ks-text)!important;
      }
      #ks-screen #ks-panel :is(.ks-desc,.ks-hint,.ks-sub,.ks-sidebar-caption,.ks-sidebar-foot,#ks-brand-sub,#ks-autosave-status) {
        color:var(--ks-muted)!important;
      }
      #ks-screen #ks-panel :is(.ks-section-heading,.ks-code,.ks-tab-icon,.ks-select-chevron,.ks-experimental-badge) {
        color:var(--ks-accent)!important;
      }
      #ks-screen #ks-panel :is(.ks-tab.active,.ks-subtab.active,.ks-select-popup button[aria-selected="true"]) {
        border-color:var(--ks-accent)!important;color:var(--ks-text)!important;
        background-color:color-mix(in srgb,var(--ks-accent) 15%,var(--ks-panel))!important;
      }
      #ks-screen #ks-panel :is(.ks-input,.ks-select-trigger,.ks-btn:not(.primary):not(.danger)) {
        background-color:var(--ks-bg)!important;color:var(--ks-text)!important;
        border-color:color-mix(in srgb,var(--ks-accent) 38%,transparent)!important;
      }
      #ks-screen #ks-panel :is(.ks-btn.primary,#ks-apply) {
        background:var(--ks-accent)!important;color:var(--ks-accent-contrast)!important;
        border-color:var(--ks-accent)!important;
      }
      #ks-screen #ks-panel :is(#ks-close,#ks-discord-menu,.ks-top-discord),#ks-screen #ks-quick :is(#ks-gear,#ks-discord-quick) {
        border-color:var(--ks-accent)!important;background:var(--ks-panel)!important;color:var(--ks-text)!important;
      }
      #ks-screen #ks-panel :is(#ks-close,#ks-discord-menu,.ks-top-discord):hover,
      #ks-screen #ks-quick :is(#ks-gear,#ks-discord-quick):hover {
        background:var(--ks-accent)!important;color:var(--ks-accent-contrast)!important;
      }
      #ks-screen :is(#ks-fps,#ks-break-reminder,#ks-badge,#ks-community-status) {
        border-color:var(--ks-accent)!important;background:var(--ks-panel)!important;color:var(--ks-text)!important;
      }
      #ks-screen #ks-fps{border-left-color:var(--ks-accent)!important;}
      #ks-screen #ks-panel :is(button,input,select,textarea):focus-visible {outline-color:var(--ks-accent)!important;}
    `;
    themeStyle.textContent=typographyRules+(customPaletteEnabled()?paletteRules:'');
    if(!themeStyle.isConnected)shadow.appendChild(themeStyle);
    // Beta's older full-border shorthand used !important. Native color
    // pickers must win this conflict without changing the default design.
    for (const id of ['ks-gear','ks-discord-quick','ks-close']) {
      const control=$(id);
      if(customPaletteEnabled()) {
        control.style.setProperty('border-color',accent,'important');
      } else {
        control.style.removeProperty('border-color');
      }
    }
    // Scoped to KS Settings; do not inject styling into Kirka's gameplay DOM.
    const visualExtras=$('ks-visual-extras')||document.createElement('style');
    visualExtras.id='ks-visual-extras';
    const radius=Math.max(6,Math.min(24,Number(state.themeRadius)||12));
    const glow=Math.max(0,Math.min(100,Number(state.themeGlow)||0))/100;
    const surface=['Solid','Frosted','Neon'].includes(state.themeSurface)?state.themeSurface:'Solid';
    const pattern=['None','Grid','Dots'].includes(state.themePattern)?state.themePattern:'None';
    const density=['Compact','Comfortable','Spacious'].includes(state.themeDensity)?state.themeDensity:'Comfortable';
    const glowBlur=Math.round(glow*36);
    const glowAlpha=(glow*.32).toFixed(3);
    const lineAlpha=(.13+glow*.27).toFixed(3);
    const rowPad=density==='Compact'?7:density==='Spacious'?16:11;
    const backdrop=surface==='Frosted'?18:0;
    const patternImage=pattern==='Grid'
      ?'linear-gradient(to right, color-mix(in srgb,var(--ks-accent) 9%,transparent) 1px, transparent 1px),linear-gradient(to bottom,color-mix(in srgb,var(--ks-accent) 9%,transparent) 1px,transparent 1px)'
      :pattern==='Dots'?'radial-gradient(color-mix(in srgb,var(--ks-accent) 20%,transparent) 1px,transparent 1px)':'none';
    visualExtras.textContent=`
      #ks-screen #ks-panel {
        border-radius:${radius+6}px!important;
        box-shadow:0 22px 76px rgba(0,0,0,.50),0 0 ${glowBlur}px rgba(0,0,0,.16)!important;
        backdrop-filter:blur(${backdrop}px);
      }
      #ks-screen #ks-panel #ks-body {
        background-image:${patternImage}!important;
        background-size:${pattern==='Grid'?'24px 24px':pattern==='Dots'?'18px 18px':'auto'}!important;
      }
      #ks-screen #ks-panel :is(.ks-card,.ks-note,.ks-hint-box) {
        border-radius:${radius}px!important;
        border-color:color-mix(in srgb,var(--ks-accent) ${Math.round(13+glow*27)}%,transparent)!important;
        box-shadow:0 0 ${glowBlur}px color-mix(in srgb,var(--ks-accent) ${Math.round(glow*22)}%,transparent)!important;
        ${surface==='Frosted'?'backdrop-filter:blur(12px)!important;':''}
      }
      #ks-screen #ks-panel :is(.ks-input,.ks-select-trigger,.ks-btn,.ks-palette-tile) {
        border-radius:${Math.max(5,radius-3)}px!important;
      }
      #ks-screen #ks-panel .ks-row {
        padding-top:${rowPad}px!important;padding-bottom:${rowPad}px!important;
      }
      #ks-screen #ks-panel .ks-section-heading {
        text-shadow:0 0 ${glowBlur}px color-mix(in srgb,var(--ks-accent) ${Math.round(glow*35)}%,transparent);
      }
      #ks-screen #ks-panel .ks-palette-tile.selected{
        box-shadow:0 0 ${glowBlur}px color-mix(in srgb,var(--ks-accent) ${Math.round(glow*35)}%,transparent)!important;
        border-color:var(--ks-accent)!important;
      }
      ${surface==='Neon'? '#ks-screen #ks-panel .ks-card{border-color:var(--ks-accent)!important;}':''}
    `;
    if(!visualExtras.isConnected)shadow.appendChild(visualExtras);
    const panel = $('ks-panel');
    panel.style.background = state.menuImageEnabled && assetURLs.menuBackground
      ? `linear-gradient(rgba(8,12,16,.88),rgba(8,12,16,.94)), url("${assetURLs.menuBackground}") center/cover no-repeat`
      : (state.customBackground || '#0d1015');
    const logo = $('ks-brand-icon');
    const activeLogo = assetURLs.uiImage || DEFAULT_LOGO_DATA;
    logo.style.display = activeLogo ? 'block' : 'none';
    if (activeLogo && logo.getAttribute('src')!==activeLogo) logo.src = activeLogo;
    const fpsNode = $('ks-fps');
    fpsNode.style.display = isGamePage && state.showHUD && state.showFPS && state.fpsSource !== 'kirka' && !state.minimalHUD ? 'block' : 'none';
    fpsNode.style.left = state.fpsPosition === 'top-left' ? '18px' : 'auto';
    fpsNode.style.right = state.fpsPosition === 'top-left' ? 'auto' : '18px';
    fpsNode.style.top = state.fpsPosition === 'bottom-right' ? 'auto' : (state.fpsPosition === 'top-left' ? '68px' : '18px');
    fpsNode.style.bottom = state.fpsPosition === 'bottom-right' ? '18px' : 'auto';

    $('ks-badge').style.display = state.showHUD && state.showBadge && !state.minimalHUD ? 'block' : 'none';
    // Keep Settings visible on every Kirka.io route, including weapon selection
    // and active pointer lock. Only the small gear can receive mouse events.
    $('ks-quick').style.display = 'flex';
    $('ks-discord-quick').style.display=isGamePage && !open && !/\/(games\/|hub\/ranked)/.test(location.pathname) && !document.pointerLockElement?'inline-flex':'none';

    const cross = $('ks-crosshair');
    cross.style.display = isGamePage && state.showHUD && state.crosshairEnabled ? 'block' : 'none';
    if(cross.style.display==='block'){
      const signature=JSON.stringify(crosshairFields.map(key=>state[key]));
      if(signature!==crosshairSignature){
        const svgSize=crosshairExtent()*2;
        cross.innerHTML=`<svg width="${svgSize}" height="${svgSize}" xmlns="http://www.w3.org/2000/svg"></svg>`;
        drawCrosshair(cross.querySelector('svg'),svgSize);
        crosshairSignature=signature;
      }
    }
    let custom = document.getElementById('ks-client-user-css');
    if (!custom) {
      custom = document.createElement('style');
      custom.id = 'ks-client-user-css';
      (document.head || document.body).appendChild(custom);
    }
    const pageCSS=buildPageStyles();
    if(custom.textContent!==pageCSS)custom.textContent=pageCSS;
    // Applies to the game's visible canvas only, never the KS overlay.
    // This is a postprocessing color/softness effect, NOT WebGL anti-aliasing.
    let eyeStyle=document.getElementById('ks-client-eye-filter');
    if(!eyeStyle) {eyeStyle=document.createElement('style');eyeStyle.id='ks-client-eye-filter';(document.head||document.body).appendChild(eyeStyle);}
    // CEF renders the game canvas in a native child HWND. CSS compositing
    // filters can add a separate GPU layer; exclude the live #game canvas
    // in CEF to isolate potential focus/mouse regressions. The setting and
    // local preview remain available, and Electron behavior is unchanged.
    const cefInputCompatibility=typeof window.CefSharp?.PostMessage==='function';
    eyeStyle.textContent=isGamePage && state.eyeEnabled ?
      (cefInputCompatibility ? `canvas:not(#game){filter:${comfortFilterCSS()} !important;}`
        : `canvas{filter:${comfortFilterCSS()} !important;}`) : '';
    updateComfortPreview();
    updateBreakReminderState();
    updateResourcesInUI();
  }

  let menuAudio = null;
  async function playMenuSound() {
    if (!assetURLs.menuSound) {
      resourceStatus = 'No menu sound uploaded. Choose an audio file first.';
      updateResourcesInUI();
      return false;
    }
    try {
      if (menuAudio) { menuAudio.pause(); menuAudio.currentTime=0; }
      const sound = new Audio(assetURLs.menuSound);
      sound.volume = .28;
      menuAudio = sound;
      await sound.play();
      resourceStatus = 'Menu sound playback started successfully.';
      updateResourcesInUI();
      return true;
    } catch(err) {
      resourceStatus = 'Sound blocked or unreadable: ' + String(err?.message || err);
      updateResourcesInUI();
      return false;
    }
  }
  function verifyAssets() {
    const names=assetKeys.filter(k=>assetURLs[k]).map(k=>assetMeta[k]||k);
    resourceStatus = names.length ? `${names.length} local assets ready: ${names.join(', ')}` : 'No local asset loaded. Add a file above.';
    updateResourcesInUI();
  }

  let settingsSnapshot=null,priorFocus=null;
  function restoreSettingsSnapshot() {
    if(!settingsSnapshot)return;
    state={...defaults,...settingsSnapshot.state};
    browserPrefs={...settingsSnapshot.browser};
    save();
    window.__KS_FRAME_PACER__?.setLimit(state.fpsLimit);
    window.__KS_GAME_EXTRAS__?.refresh?.();
    notify('game-resolution',{preset:state.gameResolution});
    notify('menu-resolution',{preset:state.menuResolution});
    if(browserPrefsLoaded)notify('browser-save',{browser:browserPrefs});
    settingsSnapshot=null;
    apply();
  }
  function show(toggle) {
    const next=typeof toggle==='boolean'?toggle:!open;
    if(next && !open)settingsSnapshot={state:JSON.parse(JSON.stringify(state)),browser:{...browserPrefs}};
    const opening=next&&!open,closing=!next&&open;
    if(opening)priorFocus=document.activeElement;
    open=next;
    if(!open)window.__KS_WORKSHOP__?.stopPlugin?.();
    try {
      if(open && document.pointerLockElement)document.exitPointerLock?.();
      if(open) {
        try {renderTab();}
        catch(error) {
          const body=$('ks-body');
          if(body)body.innerHTML='<h2 class="ks-title">Settings temporarily unavailable</h2><p class="ks-sub">Choose another category or restart the client. Saved settings are unchanged.</p>';
          notify('client-error',{message:'Settings render: '+String(error?.message||error).slice(0,160)});
        }
        if(state.menuSoundEnabled && assetURLs.menuSound)void playMenuSound();
        if(selectedTab==='Diagnostics'){notify('diagnostics-poll');notify('crash-status');}
      }
    } finally {
      try{
        apply();
        if(opening)$('ks-close')?.focus({preventScroll:true});
        if(closing){
          if(priorFocus?.isConnected && priorFocus!==host)priorFocus.focus({preventScroll:true});
          priorFocus=null;
        }
      }
      catch(error){
        $('ks-dimmer')?.classList.toggle('visible',open);
        notify('client-error',{message:'Settings apply: '+String(error?.message||error).slice(0,160)});
      }
    }
  }

  function setSetting(k, value) {
    if (!(k in defaults)) return;
    if (typeof defaults[k] === 'number') value = Number(value);
    if (k === 'customCSS') value = String(value).slice(0, 12000);
    if(k==='gameKeysScale')value=Math.max(70,Math.min(170,Math.round(Number(value)||100)));
    if(k==='gameKeysPosition' && !['bottom-left','bottom-right','top-left','top-right'].includes(value))return;
    if (k === 'performancePreset') { applyPerformancePreset(value); return; }
    if (k === 'smoothPreset') { applySmoothPreset(String(value));return; }
    if (k === 'eyePreset') { applyEyePreset(String(value));return; }
    if (['menuSelector','uiImageSelector','minimalSelectors'].includes(k)) value = String(value).slice(0,120);
    if (k === 'themePreset' && !Object.hasOwn(themeColors,value)) return;
    if(k==='themePreset' && value!=='Custom'){
      const palette=themePalettes[value];
      if(palette)Object.assign(state,{customAccent:palette.accent,customBackground:palette.bg,
        customPanel:palette.panel,customText:palette.text,customMuted:palette.muted});
    }
    if(k==='themeSurface' && !['Solid','Frosted','Neon'].includes(value))return;
    if(k==='themePattern' && !['None','Grid','Dots'].includes(value))return;
    if(k==='themeDensity' && !['Compact','Comfortable','Spacious'].includes(value))return;
    if(k==='themeGlow')value=Math.max(0,Math.min(100,Math.round(Number(value)||0)));
    if(k==='themeRadius')value=Math.max(6,Math.min(24,Math.round(Number(value)||12)));
    if (k === 'fontFamily' && !['Segoe UI','Arial','Verdana','Tahoma','Consolas','KS Custom Font'].includes(value)) return;
    if (['customAccent','customBackground','customPanel','customText','customMuted'].includes(k) &&
        !/^#[a-f0-9]{6}$/i.test(value)) return;
    // Once any swatch is edited, show Custom rather than falsely implying
    // the exact named palette is still active.
    if (['customAccent','customBackground','customPanel','customText','customMuted'].includes(k))
      state.themePreset='Custom';
    if(k==='fpsLimit') { value=Number(value); if (![0,60,120,144,165,180,200,240,300,360].includes(value))return; }
    if(k==='uiScale') {
      value=Math.max(100,Math.min(160,Math.round(Number(value)||100)));
      state.uiScale=value;save();
      $('ks-panel').style.setProperty('--ks-ui-scale', String(value/100));
      return; // No full redraw on the resize slider.
    }
    if(k==='eyeSoftness')value=Math.max(0,Math.min(6,Math.round(Number(value)||0)));
    if(k==='breakReminderMinutes' && ![0,20,30,45,60].includes(Number(value)))return;
    if(k.startsWith('eye') && !['eyeEnabled','eyePreset'].includes(k)) {
      state.eyePreset='Custom';
      const selector=$('ks-body').querySelector('select[data-setting="eyePreset"]');
      if(selector) {selector.value='Custom';const choice=selector.options[selector.selectedIndex];const label=selector.parentNode.querySelector('.ks-select-value');if(choice&&label)label.textContent=choice.textContent;}
    }
    if(k==='fpsLimit')state.smoothPreset='Native';
    state[k] = value;
    if(k==='fpsLimit')window.__KS_FRAME_PACER__?.setLimit(value);
    save();
    if(k.startsWith('game'))window.__KS_GAME_EXTRAS__?.refresh?.();
    apply();
    const preview = $('ks-preview-svg');
    if (preview) drawCrosshair(preview);
    if (k === 'previewBackground') updatePreviewBackground();
    if (k === 'gameResolution') notify('game-resolution', { preset: state.gameResolution });
    if (k === 'menuResolution') notify('menu-resolution', { preset: state.menuResolution });
    if (k === 'showGraph') paintGraphs();
    if (k === 'breakReminderMinutes')visiblePlayMinutes=0;
    if (['fpsSource','themePreset','fontFamily','language','centerDot','centerDotOutline','outlineEnabled','shadowEnabled','shape','fpsLimit'].includes(k)) renderTab();
  }


  const backupFormat = 'ksclient-settings';
  function exportSettings() {
    // Export only supported settings; local assets live in IndexedDB.
    const safe = Object.fromEntries(Object.keys(defaults)
      .map(k=>[k,state[k]]));
    const doc = {format:backupFormat,schemaVersion:1,client:'KS Client '+CLIENT_LABEL,exportedAt:new Date().toISOString(),settings:safe};
    const blob = new Blob([JSON.stringify(doc,null,2)],{type:'application/json'});
    const objectURL = URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=objectURL;link.download='KS-Client-Beta-'+CLIENT_VERSION+'-settings.json';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(objectURL),30000);
    sharingStatus='Settings JSON exported. No account token or local image/audio/font was included.';
    const status=$('ks-sharing-status');if(status)status.textContent=L(sharingStatus);
  }
  function checkImportValue(key, value) {
    const def=defaults[key];
    if(key==='customCrosshairPresets') {
      if(!Array.isArray(value)||value.length>12)return undefined;
      return value.filter(p=>p&&typeof p.name==='string'&&p.name.length<=30&&p.settings&&typeof p.settings==='object')
        .map(p=>({name:p.name,settings:Object.fromEntries(crosshairFields.filter(k=>checkImportValue(k,p.settings[k])!==undefined).map(k=>[k,p.settings[k]]))}));
    }
    if(typeof value!==typeof def)return undefined;
    if(typeof def==='number' && (!Number.isFinite(value)||Math.abs(value)>20000))return undefined;
    if(typeof def==='string' && value.length>12000)return undefined;
    if(['color','customAccent','centerDotColor','centerDotOutlineColor','outlineColor','shadowColor'].includes(key) && !/^#[a-f0-9]{6}$/i.test(value))return undefined;
    if(key==='language' && !Object.hasOwn(languageNames,value))return undefined;
    if(key==='fpsLimit' && ![0,60,120,144,165,180,200,240,300,360].includes(value))return undefined;
    if(key==='gameResolution' && !['native','720','1080','1440','2160'].includes(value))return undefined;
    if(key==='menuResolution' && !['native','720','1080','1440','2160'].includes(value))return undefined;
    if(key==='themePreset' && !Object.hasOwn(themeColors,value))return undefined;
    if(key==='performancePreset' && !['Low','Balanced','High Performance'].includes(value))return undefined;
    if(key==='shape' && !crosshairShapes.includes(value))return undefined;
    if(key==='centerDotShape' && !['circle','square','diamond'].includes(value))return undefined;
    return value;
  }
  async function importSettings(file) {
    if(!file||file.size>256000||file.size===0)throw Error(L('Please choose a JSON backup smaller than 256 KB.'));
    const data=JSON.parse(await file.text());
    if(!data||data.format!==backupFormat||data.schemaVersion!==1||!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings))throw Error(L('Unsupported KS Client settings format.'));
    if(!confirm(L('Import this settings backup? Personal CSS will remain disabled for safety. Local assets will not be changed.')))return;
    const safe={};
    for(const key of Object.keys(defaults)){
      if(!Object.prototype.hasOwnProperty.call(data.settings,key))continue;
      const checked=checkImportValue(key,data.settings[key]);
      if(checked!==undefined)safe[key]=checked;
    }
    state={...state,...safe,customCSSEnabled:false};
    save(); apply();
    window.__KS_FRAME_PACER__?.setLimit(state.fpsLimit);
    notify('game-resolution',{preset:state.gameResolution});
    notify('menu-resolution',{preset:state.menuResolution});
    sharingStatus=`Imported ${Object.keys(safe).length} settings. Review Custom CSS before enabling it.`;
    renderTab();
  }

  function navigateSettingsTab(name) {
    if (!tabs.includes(name))return;
    selectedTab=name;renderTab();$('ks-body').scrollTop=0;
    if(selectedTab==='Diagnostics'){notify('diagnostics-poll');notify('crash-status');}
  }
  $('ks-nav').addEventListener('click',e=>{
    const result=e.target.closest('[data-tab]');
    if(result){navigateSettingsTab(result.dataset.tab);return;}
    const b=e.target.closest('[data-group]');
    if(b){const g=groups.find(g=>g.key===b.dataset.group);if(g)navigateSettingsTab(g.items[0]);}
  });
  $('ks-nav').addEventListener('input',e=>{
    if(e.target.id==='ks-menu-search')updateSettingsSearch(e.target.value);
  });
  $('ks-nav').addEventListener('keydown',e=>{
    if(e.target.id!=='ks-menu-search')return;
    if(e.key==='Enter'){
      const first=$('ks-search-results')?.querySelector('[data-tab]');
      if(first){e.preventDefault();navigateSettingsTab(first.dataset.tab);}
    } else if(e.key==='Escape' && e.target.value){
      e.preventDefault();e.stopPropagation();e.target.value='';updateSettingsSearch('');
    }
  });
  $('ks-body').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)navigateSettingsTab(b.dataset.tab);});
  shadow.addEventListener('pointerdown',e=>{if(activePopup&&!e.composedPath().includes(activePopup)&&!e.composedPath().includes(activeSelect))closeCustomSelect();},true);
  shadow.addEventListener('keydown',e=>{
    if(!activePopup)return;
    const opts=Array.from(activePopup.querySelectorAll('button:not(:disabled)'));
    if(e.key==='Escape'){e.stopPropagation();e.preventDefault();closeCustomSelect();return;}
    const idx=opts.indexOf(shadow.activeElement);
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();opts[(idx+(e.key==='ArrowDown'?1:-1)+opts.length)%opts.length]?.focus();}
    else if(e.key==='Home'){e.preventDefault();opts[0]?.focus();}
    else if(e.key==='End'){e.preventDefault();opts[opts.length-1]?.focus();}
  },true);
  $('ks-body').addEventListener('scroll',()=>{if(activePopup)closeCustomSelect();},{passive:true});
  $('ks-close').addEventListener('click', () => {restoreSettingsSnapshot();show(false);});
  $('ks-cancel').addEventListener('click', () => {restoreSettingsSnapshot();show(false);});
  $('ks-apply').addEventListener('click', () => {settingsSnapshot=null;save();show(false);});
  $('ks-reset-main').addEventListener('click',()=>{
    if(!confirm(L('Reset all KS Client settings?')))return;
    state={...defaults};save();
    notify('browser-reset',{section:'all'});
    notify('game-resolution',{preset:state.gameResolution});
    notify('menu-resolution',{preset:state.menuResolution});
    window.__KS_FRAME_PACER__?.setLimit(state.fpsLimit);
    renderTab();apply();
  });
  let communityNoticeTimer=null;
  function showCommunityNotice(message,duration=4500) {
    const notice=$('ks-community-status');
    if(!notice)return;
    if(communityNoticeTimer)clearTimeout(communityNoticeTimer);
    notice.textContent=String(message||'').slice(0,260);
    notice.hidden=false;
    // CEF's fixed native-navigation fallback sends no reply: always dismiss.
    communityNoticeTimer=setTimeout(()=>{notice.hidden=true;communityNoticeTimer=null;},duration);
  }
  function openCommunity() {
    showCommunityNotice(state.language==='hu'?'Discord meghívó megnyitása…':'Opening KS Discord in your default browser…',2400);
    if(!openTrustedExternal('discord'))window.__KS_CLIENT__?.setCommunityStatus?.('Native client bridge unavailable. Copy https://discord.gg/cxP386yGjk into your browser.');
  }
  $('ks-discord-menu').addEventListener('click',openCommunity);
  $('ks-discord-quick').addEventListener('click',openCommunity);
  $('ks-gear').addEventListener('click', () => show(true));
  $('ks-dimmer').addEventListener('click', e => { if (e.target === $('ks-dimmer')) show(false); });

  $('ks-body').addEventListener('change', async e => {
    const input = e.target.closest('input[data-asset]');
    if (!input || !input.files?.length) return;
    const file = input.files[0];
    const kind = input.dataset.asset;
    const types = {
      menuBackground: ['image/png','image/jpeg','image/webp'],
      uiImage: ['image/png','image/jpeg','image/webp'],
      menuSound: ['audio/mpeg','audio/wav','audio/ogg','audio/mp4'],
      localFont: ['font/woff','font/woff2','application/font-woff','application/octet-stream','']
    };
    const maxSize = kind === 'menuSound' ? 3_000_000 : kind === 'localFont' ? 1_500_000 : 5_000_000;
    const valid = kind === 'localFont' ? /\.woff2?$/i.test(file.name) : types[kind]?.includes(file.type);
    if (!valid || file.size > maxSize || file.size === 0) {
      resourceStatus = `Unsupported file or too large. Limit: ${(maxSize / 1000000).toFixed(1)} MB.`;
      updateResourcesInUI(); return;
    }
    try {
      await saveAsset(kind, file);
      setAssetURL(kind, file);
      assetMeta[kind] = file.name;
      resourceStatus = `${file.name} saved locally.`;
      apply();renderTab();
    } catch(error) { resourceStatus = 'Unable to store the file: ' + String(error);updateResourcesInUI(); }
  });
  $('ks-body').addEventListener('change', async e=>{
    const fileInput=e.target;
    if(fileInput.id!=='ks-import-file')return;
    const selected=fileInput.files?.[0];
    try { await importSettings(selected); }
    catch(error) {sharingStatus='Import failed: '+String(error.message||error);const n=$('ks-sharing-status');if(n)n.textContent=L(sharingStatus);}
    // The import can re-render the panel; never dereference a detached event target.
    if(fileInput.isConnected) fileInput.value='';
  });
  $('ks-body').addEventListener('click',e=>{
    const tile=e.target.closest('button[data-palette]');
    if(!tile)return;
    setSetting('themePreset',tile.dataset.palette);
  });
  $('ks-body').addEventListener('click', async e => {
    const button = e.target.closest('[data-clear-asset]');
    if (!button) return;
    const key = button.dataset.clearAsset;
    try { await deleteAsset(key); setAssetURL(key, null); if(key==='menuSound'&&menuAudio){menuAudio.pause();menuAudio=null;} delete assetMeta[key]; resourceStatus = 'Local resource removed.'; apply();renderTab(); }
    catch(error) {resourceStatus='Unable to delete local file: '+String(error);updateResourcesInUI();}
  });

  $('ks-body').addEventListener('input', e => {
    const k = e.target.dataset.setting;
    if (!k) return;
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (e.target.type === 'range' || e.target.type === 'color') {
      // Avoid relayout of the entire WebView while dragging menu zoom.
      if(k!=='uiScale')setSetting(k,v);
      const val = $('ks-body').querySelector(`[data-for="${k}"]`);
      const suffix=k==='eyeSoftness'?'/10 px':(k === 'size' || k === 'gap' || k === 'thickness' ? 'px' : '%');
      if (val) val.textContent = (k==='uiScale'?v:state[k]) + suffix;
    }
  });

  $('ks-body').addEventListener('change', e => {
    const key = e.target.dataset.browser;
    if (!key || !browserPrefsLoaded || !Object.hasOwn(browserPrefs,key)) return;
    const value = e.target.type==='checkbox' ? e.target.checked : e.target.value;
    browserPrefs = {...browserPrefs,[key]:value};
    if(key==='uncapFps')browserPendingRestart=browserActive.uncapFps!==value;
    browserStatus = key==='uncapFps' ? 'Chromium frame-rate launch flags changed. Restart KS Client to apply.' : 'Saving browser settings…';
    notify('browser-save',{browser:browserPrefs});
  });

  $('ks-body').addEventListener('change', e => {
    const k = e.target.dataset.setting;
    if (!k) return;
    setSetting(k, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
    // Refresh the theme dropdown after the native color chooser closes,
    // not during every input frame (which would close the chooser).
    if(['customAccent','customBackground','customPanel','customText','customMuted'].includes(k) && e.target.type==='color')renderTab();
  });

  $('ks-body').addEventListener('click', async e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if(a.startsWith('wk-')) {
      try {
        const handled=window.__KS_WORKSHOP__?.action(a,shadow,workshopNotify);
        if(handled) {
          if(!/^wk-plugin-(run|stop)-?/.test(a))renderTab();
          const value=window.__KS_WORKSHOP__?.getStatus();
          if(value && $('ks-wk-status'))$('ks-wk-status').textContent=value;
        }
      }catch(error){
        window.__KS_WORKSHOP__?.setStatus('Workshop action failed: '+String(error?.message||error));
        const node=$('ks-wk-status');if(node)node.textContent=String(error?.message||error);
      }
      return;
    }
    if (a === 'performance-preset' && ['Low','Balanced','High Performance'].includes(el.dataset.preset)) {setSetting('performancePreset',el.dataset.preset);return;}
    if (a === 'test-menu-sound') {void playMenuSound();}
    if (a === 'verify-assets') {verifyAssets();}
    if (a === 'pixel-perfect') {state.menuResolution='native';state.gameResolution='native';save();notify('menu-resolution',{preset:'native'});notify('game-resolution',{preset:'native'});renderTab();apply();}
    if (a === 'css-apply') { const editor=$('ks-body').querySelector('textarea[data-setting="customCSS"]'); if(editor) {state.customCSS=editor.value.slice(0,12000); state.customCSSEnabled=true;save();apply();renderTab();} }
    if (a === 'css-clear') {state.customCSS='';state.customCSSEnabled=false;save();apply();renderTab();}
    if (a === 'preset-save') {
      const name=$('ks-preset-name')?.value.trim().slice(0,30) || `Preset ${savedPresets().length + 1}`;
      const preset={name, settings:Object.fromEntries(crosshairFields.map(k=>[k,state[k]]))};
      const existing=savedPresets().findIndex(p=>p.name.toLowerCase()===name.toLowerCase());
      const list=[...savedPresets()];
      if(existing>=0) list[existing]=preset;
      else if(list.length < 12) list.push(preset);
      else {alert(L('Maximum 12 crosshair presets. Remove one first.'));return;}
      state.customCrosshairPresets=list;save();renderTab();
    }
    if (a === 'preset-load' || a === 'preset-delete') {
      const value=$('ks-preset-select')?.value;
      if(value===undefined || value==='') return;
      const index=Number(value),list=[...savedPresets()];
      if(!Number.isInteger(index)||!list[index])return;
      if(a==='preset-load') {for(const k of crosshairFields) if(k in list[index].settings) state[k]=list[index].settings[k];state.crosshairEnabled=true;}
      else {list.splice(index,1);state.customCrosshairPresets=list;}
      save();renderTab();apply();
    }
    if(a==='engine-electron' && !activeEngine.toLowerCase().includes('electron') && confirm('Restart KS Client with Electron?')){
      engineSwitchStatus='Requesting Electron startup...';
      engineSwitchAcknowledged=false;
      const delivered=notify('engine-switch',{engine:'electron'});
      if(!delivered)engineSwitchStatus='Native bridge unavailable. Try Ctrl+Alt+E to switch engines.';
      renderTab();
      // CefSharp can expose PostMessage while a navigation/frame transition
      // prevents native receipt. Use a trusted, intercepted same-origin URL as
      // a one-shot fallback. The native request handler BLOCKS the navigation.
      if(window.CefSharp?.PostMessage){
        setTimeout(()=>{
          if(engineSwitchStatus!=='Requesting Electron startup...' || engineSwitchAcknowledged)return;
          engineSwitchStatus='Trying alternative native Electron start...';
          if(selectedTab==='General')renderTab();
          try{window.location.assign('https://kirka.io/__ksclient_internal_switch_electron__');}
          catch(_){engineSwitchStatus='Fallback unavailable. Press Ctrl+Alt+E.';if(selectedTab==='General')renderTab();}
        },1800);
      }
      setTimeout(()=>{
        if(!engineSwitchAcknowledged && engineSwitchStatus.startsWith('Requesting')){
          engineSwitchStatus='No response from native host. Press Ctrl+Alt+E, or open the local KS Client logs.';
          if(selectedTab==='General')renderTab();
        }else if(!engineSwitchAcknowledged && engineSwitchStatus.startsWith('Trying alternative')){
          engineSwitchStatus='Native engine did not confirm startup. Press Ctrl+Alt+E and check local logs.';
          if(selectedTab==='General')renderTab();
        }
      },10500);
    }
    if(a==='engine-cef' && !activeEngine.toLowerCase().includes('cef') && confirm('Restart KS Client with CEF?')){
      engineSwitchStatus='Requesting CEF startup...';
      if(!notify('engine-switch',{engine:'cef'}))engineSwitchStatus='Native connection unavailable; engine switch cannot start.';
      renderTab();
    }
    if(a==='enable-unlimited-fps'){
      if(!browserPrefsLoaded){notify('browser-config');return;}
      state.fpsLimit=0;
      state.smoothPreset='Native';
      save();
      window.__KS_FRAME_PACER__?.setLimit(0);
      browserPrefs={...browserPrefs,uncapFps:true};
      browserPendingRestart=true;
      browserStatus='Experimental Chromium FPS unlock requested. Restart KS Client to apply.';
      notify('browser-save',{browser:browserPrefs});
      renderTab();
    }
    if (a === 'quick-join') {
      const raw=$('ks-join-link')?.value||'';
      try{
        const u=new URL(raw);
        if(u.protocol!=='https:' || !['kirka.io','www.kirka.io'].includes(u.hostname) || !/^\/(games\/|hub\/ranked|servers\/)/.test(u.pathname))throw Error('Not a supported Kirka.io room link');
        if(!state.gameQuickJoin)throw Error('Quick join is disabled');
        if(u.username||u.password||u.port)throw Error('Invalid room address');
        const sent=window.__KS_DEEP__ ? await window.__KS_DEEP__.join(u.href,false) : notify('game-join',{url:u.href});
        if(!sent)throw Error(window.__KS_DEEP__?.getStatus().lastError||'Room action unavailable');
        window.__KS_WORKSHOP__?.recordJoin(u.href);
        sharingStatus='Requested Kirka.io room join. Game page decides whether joining is allowed.';
      }catch(e){sharingStatus='Quick join: '+String(e.message||e);}
      const el=$('ks-extra-status');if(el)el.textContent=sharingStatus;
    }
    if (a === 'auth-import-session') { importKirkaSession(); return; }
    if (a === 'auth-help') { window.__KS_CLIENT__?.openAccountHelp?.(); return; }
    if (a === 'game-screenshot') notify('game-screenshot');
    if (a === 'fullscreen') {
      if(isGamePage && !window.__KS_NATIVE__?.post && (window.CefSharp?.PostMessage || (typeof activeEngine==='string' && activeEngine.toLowerCase().includes('cef'))))
        location.assign('https://kirka.io/__ksclient_internal_toggle_fullscreen__');
      else notify('fullscreen');
    }
    if (a === 'check-gpu') checkGPU();
    if (a === 'browser-check-gpu') checkBrowserGPU();
    if (a === 'update-check') {
      const requestId=++updateRequestId;
      updateStatus={state:'checking',message:'Checking GitHub Releases…'};
      renderTab();
      if(!notify('update-check',{channel:state.updateChannel,automatic:false,autoDownload:false})){
        updateStatus={state:'error',message:'Native updater unavailable. Open GitHub Releases manually.'};
        renderTab();
      } else setTimeout(()=>{
        if(requestId===updateRequestId && updateStatus.state==='checking'){
          updateStatus={state:'error',message:'Update check timed out. Try again or open GitHub Releases manually.'};
          if(selectedTab==='Updates')renderTab();
        }
      },55000);
    }
    if (a === 'update-open-release') openTrustedExternal('releases');
    if (a === 'update-install' && updateStatus.state==='available') {
      notify('update-install',{channel:state.updateChannel});
    }
    if (a === 'browser-restart' && confirm(L('Restart and apply changes?'))) notify('browser-restart');
    if (a === 'browser-reset' && confirm(L('Reset only the settings in this browser section?'))) notify('browser-reset',{section:el.dataset.browserSection});
    if (a === 'export-settings') exportSettings();
    if (a === 'import-settings') $('ks-import-file')?.click();
    if (a === 'open-logs') notify('open-logs');
    if (a === 'stats') { show(false); notify('stats'); }
    if (a === 'clan') { show(false); notify('clan'); }
    if (a === 'game') { show(false); notify('game'); }
    if (a === 'hud') { state.showHUD = !state.showHUD; save(); renderTab(); apply(); }
    if (a === 'reset-section') resetCurrentSection();
    if (a === 'reset' && confirm(L('Reset all KS Client settings?'))) {
      state = { ...defaults }; save();
      notify('browser-reset',{section:'all'});
      notify('game-resolution', { preset: state.gameResolution });
      notify('menu-resolution', { preset: state.menuResolution });
      window.__KS_FRAME_PACER__?.setLimit(state.fpsLimit);
      renderTab(); apply();
    }
  });

  window.addEventListener('keydown', e => {
    if(e.repeat && (e.key==='F1'||e.key==='F10')){e.preventDefault();e.stopImmediatePropagation();return;}
    if (e.key === 'F1') { e.preventDefault(); e.stopImmediatePropagation(); show(); }
    else if (e.key === 'F10') { e.preventDefault(); e.stopImmediatePropagation(); state.showHUD = !state.showHUD; save(); apply(); }
    else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopImmediatePropagation(); restoreSettingsSnapshot();show(false); }
  }, true);

  // Kirka.io may draw its FPS directly into a WebGL canvas. Canvas pixels
  // cannot reliably reveal the engine's FPS, so only read explicitly visible
  // DOM text carrying an FPS label; never infer it from rAF callback counts.
  let gameHUDValue = null;
  let gameHUDReadAt = -Infinity;
  function readGameHUDValue() {
    if(!isGamePage) return null;
    let value=null;
    try {
      const items=document.querySelectorAll('[id*="fps" i], [class*="fps" i], [data-testid*="fps" i], [aria-label*="fps" i]');
      for(let i=0;i<Math.min(items.length,50);i++) {
        const el=items[i];
        if(host.contains(el) || el.closest('#ks-client-root'))continue;
        if(!el.getClientRects().length)continue;
        const content=String(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,80);
        const match=content.match(/(?:\bFPS\s*[:=]?\s*(\d{1,4})(?!\d))|(?:(\d{1,4})\s*FPS\b)/i);
        if(!match)continue;
        const v=Number(match[1]||match[2]);
        if(v>=1 && v<=9999){value=v;break;}
      }
    } catch(_) { /* DOM/HTML FPS is optional. */ }
    return value;
  }
  const animationFrame = window.__KS_FRAME_PACER__?.nativeRequestAnimationFrame || window.requestAnimationFrame.bind(window);
  let lastGraphSampleAt=0;
  let displayFrames=0;
  let nativeDisplayFPS=0;
  function animate(ts) {
    const slow=slowMeasurement();
    measurementHandle=null;
    if(!measureFrames())return;
    if (!slow && lastFrame) {
      frameMs=ts-lastFrame;displayFrames++;
      // Only visible-page intervals, avoiding background-tab throttling spikes.
      if(!document.hidden && frameMs>0) {stabilitySamples.push(frameMs);if(stabilitySamples.length>240)stabilitySamples.shift();}
    }
    lastFrame=slow?0:ts;
    if(!lastSample)lastSample=ts;
    if(ts-lastSample >= 1000) {
      nativeDisplayFPS = Math.round(displayFrames * 1000 / (ts-lastSample));
      displayFrames=0;lastSample=ts;
    }
    if(ts-lastGraphSampleAt>=1000) {
      lastGraphSampleAt=ts;
      if(state.fpsSource==='kirka-hud' && ts-gameHUDReadAt>900) {
        gameHUDValue=readGameHUDValue();gameHUDReadAt=ts;
      }
      const measured = window.__KS_FRAME_PACER__?.getStats();
      const callbackEl=$('ks-fps-callback-diag');
      if(callbackEl){
        const sample=measured?.estimatedCallbackFPS;
        callbackEl.textContent=Number.isFinite(sample) && sample>0
          ? sample+' callbacks/s (rAF, NOT GPU FPS)' : 'Waiting for requestAnimationFrame samples';
      }
      if(isGamePage && measured && measured.estimatedCallbackFPS>0) {
        displayedGameFPS = measured.estimatedCallbackFPS;
        displayedFrameMs = measured.estimatedCallbackFrameMs;
        measuredLabel = 'Estimated game rAF callback rate (not presented GPU frames)';
      } else {
        displayedGameFPS = slow?0:nativeDisplayFPS;
        displayedFrameMs = slow?0:frameMs;
        measuredLabel = slow?'Waiting for page animation callbacks':'Browser animation ticks (not game GPU FPS)';
      }
      if(state.fpsSource==='kirka-hud') {
        if(gameHUDValue!==null) {
          displayedGameFPS=gameHUDValue;
          displayedFrameMs=1000/gameHUDValue;
          measuredLabel='Game FPS detected from HTML';
        } else {
          displayedGameFPS=0;displayedFrameMs=0;
          measuredLabel='Kirka.io HUD FPS unavailable (possibly drawn on canvas)';
        }
      }
      if(state.fpsSource!=='kirka-hud' || gameHUDValue!==null) {
        fpsHistory.push(displayedGameFPS);
        frameHistory.push(displayedFrameMs);
      }
      if(fpsHistory.length>60) fpsHistory.shift();
      if(frameHistory.length>60) frameHistory.shift();
      $('ks-fps').textContent=state.fpsSource==='kirka-hud' ? (gameHUDValue!==null ? `Kirka ${gameHUDValue} FPS` : L('Kirka.io HUD FPS unavailable (possibly drawn on canvas)')) : `${measured?.estimatedCallbackFPS>0?'Page rAF':'Browser tick'} ${displayedGameFPS} FPS · ${displayedFrameMs.toFixed(1)} ms`;
      const fpsNode=$('ks-current-gamefps'); if(fpsNode)fpsNode.textContent=state.fpsSource==='kirka-hud'&&gameHUDValue===null?'—':(displayedGameFPS>0?displayedGameFPS+' FPS':'—');
      const kirkaNode=$('ks-kirka-fps-value');if(kirkaNode)kirkaNode.textContent=gameHUDValue!==null?gameHUDValue+' FPS':'—';
      const msNode=$('ks-current-ms'); if(msNode)msNode.textContent=displayedFrameMs>0?displayedFrameMs.toFixed(1)+' ms':'—';
      const lbl=$('ks-fps-source'); if(lbl)lbl.textContent=L(measuredLabel);
      paintGraphs();
      updateStabilityDiagnostics();
    }
    queueMeasurement();
  }
  let measurementHandle=null,measurementTimer=false;
  function slowMeasurement(){return open && selectedTab==='Performance' && state.limitSettingsFPS!==false;}
  function queueMeasurement(){
    measurementTimer=slowMeasurement();
    measurementHandle=measurementTimer?setTimeout(()=>animate(performance.now()),1000):animationFrame(animate);
  }
  const cancelMeasurement=window.__KS_FRAME_PACER__?.nativeCancelAnimationFrame||window.cancelAnimationFrame.bind(window);
  function measuringTab(){return open && ['Performance','Frame Stability'].includes(selectedTab);}
  function measureFrames(){
    return !document.hidden && (measuringTab() || (!open && isGamePage && state.showHUD && state.showFPS && !state.minimalHUD && state.fpsSource!=='kirka'));
  }
  let diagnosticTimer=null, diagnosticTopic='';
  function syncDiagnosticsPoll(){
    let topic='';
    if(open && !document.hidden){
      if(selectedTab==='Diagnostics')topic='diagnostics-poll';
      if(measuringTab())topic='fps-diagnostics';
    }
    if(topic===diagnosticTopic)return;
    clearInterval(diagnosticTimer);
    diagnosticTopic=topic;
    diagnosticTimer=topic?setInterval(()=>notify(topic),topic==='fps-diagnostics'?1800:2000):null;
  }
  function syncActivityLimit(){
    const runtime=window.__KS_GAME_RUNTIME__;
    const scene=runtime?.scene;
    // A generic app root can also contain account or loading UI.
    const lobby=state.limitLobbyFPS && scene==='lobby' && location.pathname==='/' &&
      document.querySelector('.interface')?.getClientRects().length && !document.pointerLockElement;
    const unfocused=state.limitUnfocusedFPS && !document.hasFocus() &&
      ['lobby','match','results','profile','market','inventory','friends','servers'].includes(scene);
    window.__KS_FRAME_PACER__?.setActivityLimit?.(unfocused?30:lobby?60:0);
  }
  function syncMeasurement(){
    syncDiagnosticsPoll();
    syncActivityLimit();
    window.__KS_FRAME_PACER__?.setMenuLimited?.(open && selectedTab!=='Frame Stability' && state.limitSettingsFPS!==false);
    window.__KS_RENDER_TELEMETRY__?.setActive?.(!document.hidden && open && selectedTab==='Diagnostics');
    if(measurementHandle!==null && (!measureFrames() || measurementTimer!==slowMeasurement())){
      if(measurementTimer)clearTimeout(measurementHandle);else cancelMeasurement(measurementHandle);
      measurementHandle=null;
      lastFrame=lastSample=displayFrames=lastGraphSampleAt=0;
    }
    if(measureFrames()){
      if(measurementHandle===null)queueMeasurement();
    }else{
      measurementHandle=null;
      lastFrame=lastSample=displayFrames=lastGraphSampleAt=0;
      stabilitySamples.length=0;
    }
  }
  document.addEventListener('visibilitychange',syncMeasurement);
  window.addEventListener('focus',syncActivityLimit);
  window.addEventListener('blur',syncActivityLimit);
  window.__KS_GAME_RUNTIME__?.on('scene',syncActivityLimit);
  function showAccountHelpDialog() {
    // Google OAuth is restricted in embedded browsers. Offer a direct,
    // user-consented Kirka session handoff, not a misleading Settings redirect.
    const old=shadow.getElementById('ks-quick-account-dialog');
    if(old){old.focus();return;}
    const hu=state.language==='hu';
    const root=document.createElement('section');
    root.id='ks-quick-account-dialog';
    root.setAttribute('role','dialog');
    root.setAttribute('aria-modal','false');
    root.setAttribute('aria-label',hu?'Kirka-fiók bejelentkezése':'Kirka account sign-in');
    root.tabIndex=-1;
    root.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(430px,calc(100vw - 32px));max-height:min(85vh,670px);overflow:auto;pointer-events:auto;z-index:2147483647;border:1px solid rgba(245,166,33,.65);border-radius:12px;padding:20px;background:#141820;color:#f4f2ed;box-shadow:0 18px 55px rgba(0,0,0,.65);font:13px/1.55 Segoe UI,Arial,sans-serif;';
    // Only fixed, bundled UI text and markup; no OAuth URLs, codes, or tokens
    // are transferred through native IPC, native logs, or the system browser.
    root.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
      <strong style="font-size:16px;color:#ffb238">${hu?'Kirka-fiók bejelentkezése':'Kirka account sign-in'}</strong>
      <button type="button" data-account-dismiss aria-label="Close" style="background:#262d38;color:#fff;border:1px solid #495260;border-radius:7px;padding:4px 9px;cursor:pointer">✕</button>
    </div>
    <p>${hu?'A Google nem támogatja a KS Clienthez hasonló beágyazott OAuth-bejelentkezést. Ezért a Google-gomb önmagában nem tudja hitelesíteni a kliens külön böngészőprofilját.':'Google does not support embedded OAuth sign-in in clients like KS. Clicking Google alone cannot authenticate this separate browser profile.'}</p>
    <p>${hu?'Ha már be vagy jelentkezve a kirka.io oldalra a saját böngésződben, a Kirka-munkamenetedet közvetlenül ide importálhatod.':'If you are already signed in on kirka.io in your browser, you can import that Kirka session directly here.'}</p>
    <div style="border-radius:7px;padding:10px;background:#202733;color:#e8e5d9">
      ${hu?'A kirka.io oldalon nyisd meg az F12 → Console részt, és futtasd:':'On kirka.io open F12 → Console and run:'}
      <code style="display:block;white-space:normal;word-break:break-word;margin-top:5px;color:#ffce7b">copy(localStorage.getItem('token'))</code>
    </div>
    <label style="display:block;margin-top:12px">${hu?'Kirka-munkamenet (titkos)':'Kirka session (secret)'}
      <input data-account-token type="password" maxlength="8192" autocomplete="new-password" spellcheck="false" style="display:block;width:100%;margin-top:5px;background:#0d1015;color:#fff;border:1px solid #55606b;border-radius:7px;padding:9px;box-sizing:border-box" />
    </label>
    <label style="display:flex;align-items:start;gap:7px;margin:12px 0 8px">
      <input data-account-consent type="checkbox" style="margin-top:3px">
      <span>${hu?'Tudom, hogy ez a munkamenet-token hozzáférést ad a Kirka-fiókomhoz, és nem osztom meg másokkal.':'I understand this session token grants access to my Kirka account and must never be shared.'}</span>
    </label>
    <p data-account-status role="status" aria-live="polite" style="min-height:16px;color:#ffce7b"></p>
    <div style="display:flex;gap:9px;flex-wrap:wrap">
      <button type="button" data-account-import style="background:#ffa913;color:#16171b;border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer">${hu?'Munkamenet importálása':'Import Kirka session'}</button>
      <button type="button" data-account-dismiss style="background:#272d36;color:#fff;border:1px solid #404a53;border-radius:8px;padding:9px 12px;cursor:pointer">${hu?'Mégse':'Cancel'}</button>
    </div>
    <p style="color:#aab1bf;font-size:11px;margin-bottom:0">${hu?'A Google-jelszavadat soha ne írd ide. A Kirka dönti el, hogy az importált munkamenet érvényes-e.':'Never enter your Google password here. Kirka determines whether the imported game session is valid.'}</p>`;
    for(const btn of root.querySelectorAll('[data-account-dismiss]'))
      btn.addEventListener('click',()=>{root.querySelector('[data-account-token]').value='';root.remove();});
    root.querySelector('[data-account-import]').addEventListener('click',()=>{
      const ok=importKirkaSession({input:root.querySelector('[data-account-token]'),
        consent:root.querySelector('[data-account-consent]'),
        status:root.querySelector('[data-account-status]')});
      if(ok)root.remove();
    });
    root.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();root.querySelector('[data-account-token]').value='';root.remove();}
    });
    try{document.exitPointerLock?.();}catch(_){}
    shadow.appendChild(root);
    root.focus();
  }
  window.__KS_CLIENT__ = {
    // Never use native IPC for Kirka bearer tokens; account help is local UI.
    openAccountHelp: showAccountHelpDialog,
    setUpdateStatus: status => {
      if(!status || typeof status!=='object')return;
      updateRequestId++;
      const allowed=['idle','checking','available','current','unavailable','error','downloading'];
      updateStatus={
        state:allowed.includes(status.state)?status.state:'error',
        current:String(status.current||CLIENT_LABEL).slice(0,40),
        version:String(status.version||'').slice(0,40),
        channel:String(status.channel||state.updateChannel).slice(0,12),
        message:String(status.message||'').slice(0,380),
        notes:String(status.notes||'').slice(0,1800),
        cached:status.cached===true,
        bytes:Number(status.bytes)||0};
      if(updateStatus.state==='available')announceAvailableUpdate(updateStatus.version);
      if(selectedTab==='Updates')renderTab();
    },
    setEngineInfo: name => {const n=String(name||'Unknown');if(activeEngine!==n){activeEngine=n;if(selectedTab==='General')renderTab();}},
    setEngineSwitchStatus: status => {
      engineSwitchAcknowledged=true;
      engineSwitchStatus=String(status||'').slice(0,360);
      if(selectedTab==='General'){
        const label=$('ks-engine-switch-status');
        if(label)label.textContent=engineSwitchStatus;
        else renderTab();
      }
    },
    toggle: () => show(),
    isSettingsOpen: () => Boolean(open),
    open: () => show(true),
    close: () => show(false),
    toggleHud: () => { state.showHUD = !state.showHUD; save(); apply(); },
    setBrowserConfig: (desired,active,needsRestart,status) => {
      if (desired && ['enabled','disabled'].includes(desired.gpu) && ['default','d3d11','opengl'].includes(desired.angle)) {
        browserPrefs={gpu:desired.gpu,angle:desired.angle,devTools:!!desired.devTools,contextMenu:!!desired.contextMenu,uncapFps:!!desired.uncapFps};
        browserActive=active||browserPrefs;
        browserPrefsLoaded=true;
        browserPendingRestart=!!needsRestart;
      }
      browserStatus=status || 'Applied on browser startup';
      if(browserGroups.has(selectedTab) || selectedTab==='Performance')renderTab();
    },
    setWorkshopStatus: (response,requestId) => {
      if(requestId){
        if(requestId!==latestWorkshopRequest)return;
        clearTimeout(workshopTimeout);latestWorkshopRequest=null;
      }
      const value=typeof response==='string'?response:(response && typeof response==='object'
        ? ('Swapper: '+(response.count||0)+' files ('+Math.round((response.bytes||0)/1024)+' KiB). '+(response.enabled?'Enabled':'Disabled')+' · '+(response.served||0)+' local responses, '+(response.unmatched||0)+' unmatched requests'):'No response');
      window.__KS_WORKSHOP__?.setStatus(value);
      const node=$('ks-wk-status');
      if(node)node.textContent=value;
    },
    setGameExtraStatus: message => {
      const node=$('ks-extra-status');
      if(node)node.textContent=String(message||'').slice(0,360);
    },
    setNativeFpsDiagnostics: d => {
      if(!d || !['CEF','Electron'].includes(d.engine))return;
      fpsNativeInfo=d;
      for(const id of ['ks-fps-native-diag','ks-stability-native-fps']){
        const el=$(id);if(el)el.textContent=fpsDiagnosticText();
      }
    },
    setDiagnostics: d => {if(d && typeof d==='object'){diagnostics=d;updateDiagnosticsUI();}},
    setCrashStatus: s => {crashStatus=String(s);const el=$('ks-crash-status');if(el)el.textContent=L(crashStatus);},
    setCommunityStatus: status => {showCommunityNotice(status,5500);},

  };

  // Kirka's own Discord UI may be recreated on lobby/match transitions.
  // Intercept only a real user click on a clearly labelled Discord control;
  // the native host opens our fixed KS community invite in the system browser.
  // No arbitrary URL can be supplied by the page through this command.
  function isKirkaDiscordButton(element) {
    const control=element.closest('a,button,[role="button"],[id*="discord" i],[class*="discord" i]');
    if(!control || host.contains(control))return false;
    // Provider buttons live inside Kirka's account dialog. Never hijack a
    // Discord sign-in button just because its visible label says "Discord".
    if(control.closest('#auth-modal-modal,[role="dialog"],[id*="auth" i],[class*="auth" i],[id*="login" i],[class*="login" i]'))return false;
    const href=control.getAttribute('href')||'';
    if(href){
      try {
        const url=new URL(href,location.href);
        if((url.hostname==='discord.gg' && url.pathname.length>1 && url.pathname.slice(1).split('/').filter(Boolean).length===1) ||
          (['discord.com','www.discord.com','discordapp.com','www.discordapp.com'].includes(url.hostname) &&
           (url.pathname.startsWith('/invite/')||url.pathname.startsWith('/channels/'))))return true;
        // A real anchor with a login/OAuth URL is NOT a community button,
        // even if its visible text says Discord.
        return false;
      } catch(_){return false;}
    }
    // Dawn leaves Kirka's provider UI alone. A plain "Discord" label or
    // icon is never enough evidence of a community invitation: Kirka's login
    // can use custom buttons with no auth-modal ancestry or href.
    // The KS-owned quick/menu Discord buttons continue using native IPC.
    return false;
  }
  if(isGamePage)document.addEventListener('click',event=>{
    if(!event.isTrusted || !(event.target instanceof Element))return;
    if(!isKirkaDiscordButton(event.target))return;
    event.preventDefault();event.stopImmediatePropagation();
    openTrustedExternal('discord');
  },true);

  // Kirka.io is a single-page application. It can replace the body's content
  // while entering a match or selecting a weapon. Keep the already initialized
  // settings shadow tree alive without re-registering handlers or resetting data.
  let overlayWatchedBody = null;
  const overlayBodyObserver = new MutationObserver(ensureOverlayMounted);
  const overlayDocumentObserver = new MutationObserver(ensureOverlayMounted);
  function ensureOverlayMounted() {
    if (!document.body) return;
    if (host.parentNode !== document.body) document.body.appendChild(host);
    if (overlayWatchedBody !== document.body) {
      overlayBodyObserver.disconnect();
      overlayBodyObserver.observe(document.body,{childList:true});
      overlayWatchedBody = document.body;
    }
  }
  function attach() {
    if (!document.body) return false;
    ensureOverlayMounted();
    overlayDocumentObserver.observe(document.documentElement,{childList:true});
    document.addEventListener('pointerlockchange',()=>{
      const node=$('ks-pointer-status');
      if(node)node.textContent=document.pointerLockElement?'CAPTURED — ESC releases':'RELEASED — click game to capture';
      apply();
    });
    renderTab();
    apply();
    loadLocalAssets();
    syncMeasurement();
    notify('engine-info');
    notify('browser-config');
    // Native engines begin the automatic check as soon as their window opens.
    // The page only syncs saved preferences and replays the pending result.
    setTimeout(syncUpdatePreferences,500);
    notify('fps-diagnostics');
    let handshakeCount=0;
    const handshakeTimer=setInterval(()=>{
      if(++handshakeCount>8 || (browserPrefsLoaded && !activeEngine.startsWith('Detecting'))){clearInterval(handshakeTimer);return;}
      notify('engine-info');notify('browser-config');
      if(handshakeCount===8 && activeEngine.startsWith('Detecting')){
        activeEngine=window.__KS_RUNTIME__?.engine ||
          (window.CefSharp?.PostMessage?'CEF (CefSharp)':'Native engine unavailable');
        if(selectedTab==='General')renderTab();
      }
    },500);
    notify('game-resolution', { preset: state.gameResolution });
    notify('menu-resolution', { preset: state.menuResolution });
    return true;
  }

  // Local-only error reporting, with a small limit to avoid log spam. Do not
  // capture tokens, URLs, account information, or script stacks.
  let recordedErrors=0;
  function reportOverlayError(message){
    if(recordedErrors>=8)return;
    recordedErrors++;
    notify('client-error',{message:String(message||'Unknown JavaScript error').slice(0,250)});
  }
  window.addEventListener('unhandledrejection', e=>reportOverlayError('Unhandled promise rejection: '+(e.reason?.name||'Error')));
  window.addEventListener('error', e=>reportOverlayError('Page JavaScript error: '+(e.error?.name||'Error')));

  if (!attach()) document.addEventListener('DOMContentLoaded', attach, { once: true });
})();
