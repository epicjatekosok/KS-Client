'use strict';
const { app, BrowserWindow, session, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const execute = promisify(require('node:child_process').execFile);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const unlocked = process.argv.includes('--ks-benchmark-unlocked');
if (unlocked) app.commandLine.appendSwitch('disable-frame-rate-limit');
const directory = process.env.KS_CAPTURE_DIRECTORY;
const mode = unlocked ? 'unlocked' : 'normal';
const output = path.join(directory, mode + '.json');
const records = [];
app.whenReady().then(async () => {
  const sandbox = session.fromPartition('ks-benchmark');
  // All requests stay local, including the HTTPS origin used by the production pacer.
  sandbox.protocol.handle('https', () => new Response('<canvas width="640" height="360"></canvas>', {
    headers: { 'Content-Type': 'text/html' }
  }));
  const win = new BrowserWindow({width:800,height:600,show:true,webPreferences:{session:sandbox,sandbox:true}});
  await win.loadURL('https://kirka.io/');
  const run = script => win.webContents.executeJavaScript(script);
  const hz = screen.getDisplayMatching(win.getBounds()).displayFrequency;
  const renderer = await run(`(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas.getContext('webgl');
    const ctx = gl ? null : canvas.getContext('2d');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    window.snapshot = () => [performance.now(), window.benchFrames];
    window.benchFrames = 0;
    window.draw = () => {
      const value = (++window.benchFrames % 180) / 180;
      if (gl) { gl.clearColor(value, 0.3, 0.5, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
      else { ctx.fillStyle = 'rgb(' + Math.round(value * 255) + ',70,125)'; ctx.fillRect(0,0,640,360); }
      window.pendingFrame = requestAnimationFrame(window.draw);
    };
    window.draw();
    return gl ? (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'WebGL') : 'Canvas 2D';
  })()`);
  const pacer = fs.readFileSync(path.join(__dirname,'frame_pacer.js'),'utf8');
  for (const target of (unlocked ? ['bare',0,60,120,144,180,240,360] : ['bare',0,60])) {
    if (target === 0) {
      await run('cancelAnimationFrame(window.pendingFrame)');
      await run(pacer);
      await run('window.__KS_FRAME_PACER__.setRefreshRate('+hz+');window.__KS_FRAME_PACER__.setDisplaySync('+!unlocked+');window.draw()');
    } else if (typeof target === 'number') await run('window.__KS_FRAME_PACER__.setLimit('+target+')');
    await delay(600);
    const file = path.join(directory, mode+'-'+target+'.csv');
    const start = await run('window.snapshot()');
    await execute(process.env.KS_PRESENTMON, ['--v1_metrics','--process_name','KSClientGame.exe','--timed','4',
      '--terminate_after_timed','--no_console_stats','--session_name','ks-ci-'+process.pid,'--output_file',file], {timeout:20000});
    const end = await run('window.snapshot()');
    const drawFPS = (end[1]-start[1])*1000/(end[0]-start[0]);
    if (!(drawFPS > 0) || (target > 0 && drawFPS > target*1.08+1)) throw Error('Unexpected draw-loop rate '+drawFPS+' at '+target);
    records.push({mode,target,drawFPS,renderer,hz,file:path.basename(file)});
  }
  fs.writeFileSync(output,JSON.stringify(records,null,2));
  app.exit(0);
}).catch(error=>{fs.writeFileSync(output,String(error.stack));app.exit(1);});
