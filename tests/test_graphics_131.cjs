'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const host=require('../electron-app/graphics-host.cjs');
const defaults={angle:'default',gpu:'enabled',uncapFps:false,contextMenu:true};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ks-recovery-test-'));
try {
  const desired={...defaults,angle:'vulkan'};
  host.recovery(tmp,desired,defaults,true);
  const clean=host.recovery(tmp,desired,defaults,false);
  clean.close();
  const journal=path.join(tmp,'graphics-startup.json');
  const crash=()=>{const rec=JSON.parse(fs.readFileSync(journal));rec.pid=2147483647;fs.writeFileSync(journal,JSON.stringify(rec));};
  crash();
  assert(host.recovery(tmp,desired,defaults,true).message);
  assert.deepEqual(desired,defaults);
  desired.angle='opengl';
  const good=host.recovery(tmp,desired,defaults,true);good.confirm();
  desired.angle='vulkan';host.recovery(tmp,desired,defaults,true);crash();
  host.recovery(tmp,desired,defaults,true);assert.equal(desired.angle,'opengl');
  desired.angle='software';
  host.recovery(tmp,desired,defaults,true).close();
  assert.equal(host.recovery(tmp,desired,defaults,true).message,'');
  assert.equal(desired.angle,'software');
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }
const hardware=host.describe({gpuDevice:[{active:false,vendorId:32902},{active:true,vendorId:4318,deviceString:'fixture RTX',driverVersion:'123'}],auxAttributes:{glRenderer:'ANGLE (NVIDIA, Direct3D11 vs_5_0)'}},{gpu_compositing:'enabled'});
assert.equal(hardware.vendor,'NVIDIA');assert.equal(hardware.backend,'d3d11');
assert.equal(host.describe({gpuDevice:[{vendorId:4098}]}).activeGPU,undefined);
assert.equal(host.identify('ANGLE (Vulkan SwiftShader)'), 'software');
assert.equal(host.identify('ANGLE (OpenGL 4.6)'), 'opengl');
assert.equal(host.identify('unrecognized'), null);
const appdir=path.join(__dirname,'../electron-app');
const scripts=['frame_pacer','integration_bootstrap','render_telemetry','webgl_cosmetics','freeze_guard','game_runtime'];
const bundle=scripts.map(n=>fs.readFileSync(path.join(appdir,'overlay',n+'.js'),'utf8')).join('\n;\n');
const preload=fs.readFileSync(path.join(appdir,'preload.cjs'),'utf8');
for (const loggedIn of [false,true]) {
  let installed=false;
  vm.runInNewContext(preload,{location:new URL('https://kirka.io/'),process:{isMainFrame:true},
    localStorage:{getItem:()=>loggedIn?'fixture':null},require:()=>({contextBridge:{exposeInMainWorld(){}},
      ipcRenderer:{sendSync:()=>bundle},webFrame:{executeJavaScriptInIsolatedWorld:(_world,items)=>{
        assert.equal(items[0].code,bundle);installed=true;return Promise.resolve();
      }}})});
  assert.equal(installed,loggedIn);
}
console.log('PASS actual document-start bundle, authenticated origin, backend identity and last-good rollback');
const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/windows-build.yml'),'utf8');
assert(workflow.includes("github.event_name == 'workflow_dispatch' && inputs.publish && github.ref == 'refs/heads/main'"));
assert(workflow.includes('--draft --prerelease'));

const [sensor]=host.parseNvidiaSensors('GPU-abc123, 0, 12.7, 41, [N/A], 16384');
assert.deepEqual(sensor,{uuid:'GPU-abc123',load:0,watts:12.7,temperature:41,used:null,capacity:16384});
assert.deepEqual(host.parseNvidiaSensors('No devices found'),[]);
