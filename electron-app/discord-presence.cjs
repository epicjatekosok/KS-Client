'use strict';
const net=require('node:net');
const validId=value=>typeof value==='string'&&/^[1-9]\d{16,19}$/.test(value);
function publicId(...values){return values.find(validId)||'';}

function createPresence({connect=net.createConnection,report=()=>{},retryMs=15000,pid=process.pid}={}){
  let socket=null,timer=null,generation=0,status='off';
  const started=Math.floor(Date.now()/1000);
  function update(value){status=value;report(value);}
  function stop(){
    generation++;clearTimeout(timer);timer=null;
    if(socket){socket.destroy();socket=null;}
    update('off');
  }
  function start(id){
    stop();if(!validId(id)){update('missing-id');return;}
    const current=generation;
    function attempt(index){
      if(current!==generation)return;
      if(index===10){
        update('waiting');timer=setTimeout(()=>attempt(0),retryMs);timer.unref?.();return;
      }
      const pipe=connect({path:'\\\\.\\pipe\\discord-ipc-'+index});
      socket=pipe;let pending=Buffer.alloc(0),ready=false,accepted=false,rejected=false;
      const nonce='ks-'+pid;
      function frame(op,payload){
        const body=Buffer.isBuffer(payload)?payload:Buffer.from(JSON.stringify(payload));
        const header=Buffer.alloc(8);header.writeUInt32LE(op,0);header.writeUInt32LE(body.length,4);
        pipe.write(Buffer.concat([header,body]));
      }
      pipe.setTimeout(5000,()=>pipe.destroy());
      pipe.once('connect',()=>frame(0,{v:1,client_id:id}));
      pipe.on('data',chunk=>{
        if(current!==generation)return;
        pending=Buffer.concat([pending,chunk]);
        while(pending.length>=8){
          const op=pending.readUInt32LE(0),len=pending.readUInt32LE(4);
          if(len>65536){pipe.destroy();return;}
          if(pending.length<len+8)return;
          const data=pending.subarray(8,8+len);pending=pending.subarray(8+len);
          if(op===2){pipe.destroy();return;}
          if(op===3){frame(4,data);continue;}
          if(op!==1)continue;
          let msg;try{msg=JSON.parse(data);}catch{pipe.destroy();return;}
          if(msg?.evt==='ERROR'){rejected=true;update('rejected');pipe.destroy();return;}
          if(!ready&&msg?.evt==='READY'){
            ready=true;frame(1,{cmd:'SET_ACTIVITY',nonce,args:{pid,activity:{
              type:0,details:'Playing Kirka.io',state:'KS Client',timestamps:{start:started}
            }}});
          }else if(ready&&msg?.cmd==='SET_ACTIVITY'&&msg.nonce===nonce){
            accepted=true;pipe.setTimeout(0);update('active');
          }
        }
      });
      pipe.on('error',()=>pipe.destroy());
      pipe.once('close',()=>{
        if(current!==generation)return;
        socket=null;
        if(accepted||ready||rejected){
          if(!rejected)update('waiting');
          timer=setTimeout(()=>attempt(0),retryMs);timer.unref?.();
        }else attempt(index+1);
      });
    }
    update('waiting');attempt(0);
  }
  return {start,stop,getStatus:()=>status};
}
module.exports={createPresence,publicId};
