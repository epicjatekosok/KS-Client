'use strict';
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createGameResolution}=require('./game-resolution.cjs');
app.commandLine.appendSwitch('use-angle','swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
  const win=new BrowserWindow({useContentSize:true,width:960,height:540,show:false,webPreferences:{backgroundThrottling:false}});
  const wc=win.webContents;
  await win.loadURL('data:text/html,<canvas id="game" style="position:fixed;inset:0;width:100%;height:100%"></canvas>');
  await wc.executeJavaScript(`window.gl=game.getContext('webgl',{antialias:false});window.density=1;
    window.__KS_RENDER_OBSERVER__={getGameBufferHeight:()=>gl.drawingBufferHeight};
    function resize(){game.width=Math.round(innerWidth*density);game.height=Math.round(innerHeight*density);}
    addEventListener('resize',resize);resize();`);
  const display=createGameResolution(win,()=>1,()=>true);
  const sizes=[];
  for(const [preset,density] of [['1080',1],['1440',0.75],['2160',1],['720',1],['native',1]]){
    await wc.executeJavaScript('density='+density+';resize()');
    display.select(preset);
    const height=preset==='native'?540:Number(preset);
    let dimensions;
    for(let i=0;i<90;i++){
      dimensions=await wc.executeJavaScript('[gl.drawingBufferWidth,gl.drawingBufferHeight]');
      if(dimensions[1]===height)break;
      await sleep(100);
    }
    assert.deepEqual(dimensions,[Math.round(height*16/9),height],preset);
    assert.equal(wc.getZoomFactor(),1);
    sizes.push(preset+' '+dimensions.join('x'));
  }
  fs.writeFileSync(process.env.KS_RESOLUTION_RESULT,sizes.join('\n'));
  app.exit(0);
}).catch(error=>{fs.writeFileSync(process.env.KS_RESOLUTION_RESULT,String(error.stack));app.exit(1);});
