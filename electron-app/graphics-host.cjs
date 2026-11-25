'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFile} = require('node:child_process');

const backends = {
  d3d11: 'd3d11', d3d11on12: 'd3d11on12', vulkan: 'vulkan', opengl: 'gl', software: 'd3d11-warp'
};
function identify(renderer = '', implementation = '') {
  const name = String(renderer);
  if (/swiftshader|llvmpipe|software|microsoft basic render|\bwarp\b/i.test(name)) return 'software';
  if (/d3d11on12|d3d11 on 12|direct3d11on12/i.test(name+' '+implementation)) return 'd3d11on12';
  if (/direct3d11|d3d11/i.test(name)) return 'd3d11';
  if (/vulkan/i.test(name)) return 'vulkan';
  if (/opengl/i.test(name)) return 'opengl';
  return null;
}
function runProbe(app, BrowserWindow, choice) {
  if (!Object.hasOwn(backends,choice)) { app.exit(2); return; }
  app.commandLine.appendSwitch('use-angle', backends[choice]);
  app.whenReady().then(async () => {
    const win = new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});
    await win.loadURL('data:text/html,<title>KS local graphics test</title>');
    const renderer = await win.webContents.executeJavaScript(`(() => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return null;
      gl.clearColor(0,1,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
      const pixel = new Uint8Array(4);
      gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return pixel[1] === 255 && ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
    })()`);
    const info = await app.getGPUInfo('complete');
    const implementation = info?.auxAttributes?.glImplementationParts || '';
    // D3D11on12 and WARP may be silently substituted. Require positive
    // evidence from the resulting renderer, independent of the requested flag.
    const match = !!renderer && identify(renderer,implementation) === choice &&
      (choice !== 'software' || /microsoft basic render|\bwarp\b/i.test(renderer));
    process.stdout.write('KS_BACKEND_RESULT '+JSON.stringify({match, renderer})+'\n', () => app.exit(match ? 0 : 1));
  }).catch(() => app.exit(1));
}
async function probeInstalled(app) {
  const verified = [];
  for (const name of Object.keys(backends)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(),'ks-backend-'));
    try {
      const args = [...(process.defaultApp ? [app.getAppPath()] : []),'--user-data-dir='+dir,'--ks-probe-angle='+name];
      const output = await new Promise((resolve,reject) => {
        execFile(process.execPath,args,{timeout:9000,windowsHide:true,maxBuffer:65536},(err,out)=>err?reject(err):resolve(out));
      });
      const result = output.split(/\r?\n/).find(line=>line.startsWith('KS_BACKEND_RESULT '));
      if (result && JSON.parse(result.slice(18)).match) verified.push(name);
    } catch { /* Unsupported, silent fallback or timed out. */ }
    finally { try { await fs.promises.rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100}); } catch {} }
  }
  return verified;
}
const vendor = id => ({4318:'NVIDIA',4098:'AMD',32902:'Intel',5140:'Microsoft'})[id];
function describe(info = {}, features = {}) {
  const aux = info.auxAttributes || {};
  const deviceName = d => d.deviceString || (Number.isInteger(d.deviceId) ? 'PCI 0x'+d.deviceId.toString(16) : null);
  const devices = (info.gpuDevice || []).map(d=>({name:deviceName(d),vendor:vendor(d.vendorId)||d.vendorString||null,
    driver:d.driverVersion||null,active:d.active===true}));
  const active = devices.find(d=>d.active);
  return {devices,activeGPU:active?.name, vendor:active?.vendor, driver:active?.driver,
    renderer:aux.glRenderer,backend:identify(aux.glRenderer,aux.glImplementationParts),
    compositing:features.gpu_compositing,webgl:features.webgl,webgl2:features.webgl2,
    cpu:os.cpus()[0]?.model,systemRAM:Math.round(os.totalmem()/1048576)};
}
function displayInfo(screen,win) {
  const current = screen.getDisplayMatching(win.getBounds());
  const display = d => ({id:d.id,label:d.label||String(d.id),hz:d.displayFrequency>0?d.displayFrequency:null,
    width:Math.round(d.size.width*d.scaleFactor),height:Math.round(d.size.height*d.scaleFactor)});
  return {current:display(current),all:screen.getAllDisplays().map(display)};
}
function recovery(root, prefs, defaults, enabled) {
  const file = path.join(root,'graphics-startup.json');
  const graphics = p => ({gpu:p.gpu,angle:p.angle,uncapFps:p.uncapFps});
  let record = {};
  try { record = JSON.parse(fs.readFileSync(file,'utf8')) || {}; } catch {}
  const normalize = data => ({
    gpu:data?.gpu==='disabled'?'disabled':'enabled',
    angle:Object.hasOwn(backends,data?.angle)?data.angle:'default',
    uncapFps:data?.uncapFps===true
  });
  let last = normalize(record.last||defaults);
  const save = data => {
    if (!enabled) return;
    const tmp=file+'.'+process.pid;
    fs.writeFileSync(tmp,JSON.stringify(data)); fs.renameSync(tmp,file);
  };
  let message = '';
  if (enabled && record.trial && JSON.stringify(record.trial) === JSON.stringify(graphics(prefs))) {
    let alive = false;
    try { process.kill(record.pid,0); alive = true; } catch {}
    if (!alive) {
      last=normalize(record.fallback||last);
      Object.assign(prefs,last);
      message = 'Previous graphics initialization failed. Restored the last working graphics settings.';
    } else enabled = false;
  }
  const selected = graphics(prefs);
  const pending = JSON.stringify(selected)!==JSON.stringify(last);
  const fallback = pending ? last : normalize(record.fallback||defaults);
  const owner = process.pid;
  let confirmed = !pending;
  const store = state => {
    try { save(state); } catch { /* A read-only profile must still start. */ }
  };
  store({last,fallback,trial:pending ? selected : null,pid:owner});
  return {message, confirm() {
    if (!confirmed) { store({last:selected,fallback,pid:owner}); confirmed=true; }
  }, fail() {
    if (enabled) { store({last:selected,fallback,trial:selected,pid:owner}); confirmed=false; }
  }};
}
module.exports = {backends,identify,runProbe,probeInstalled,describe,displayInfo,recovery};
