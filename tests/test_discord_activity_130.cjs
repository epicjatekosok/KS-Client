const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createPresence,publicId}=require('../electron-app/discord-presence.cjs');
function packet(op,data){
  const body=Buffer.from(data),head=Buffer.alloc(8);head.writeUInt32LE(op);head.writeUInt32LE(body.length,4);
  return Buffer.concat([head,body]);
}
const pipes=[];
function connect({path}){
  const pipe=new EventEmitter();
  pipe.path=path;pipe.writes=[];pipe.write=data=>pipe.writes.push(data);
  pipe.setTimeout=()=>{};pipe.destroy=()=>{if(!pipe.closed){pipe.closed=true;pipe.emit('close');}};
  pipes.push(pipe);return pipe;
}
(async()=>{
  const id='123456789012345678',statuses=[];
  const rpc=createPresence({connect,report:v=>statuses.push(v),pid:42,retryMs:5});
  assert.equal(publicId('invalid',id),id);rpc.start('');assert.equal(rpc.getStatus(),'missing-id');
  assert.equal(pipes.length,0);rpc.start(id);
  pipes[0].emit('error',Error('missing pipe'));
  const pipe=pipes[1];assert.equal(pipe.path,String.raw`\\.\pipe\discord-ipc-1`);
  pipe.emit('connect');assert.equal(JSON.parse(pipe.writes[0].subarray(8)).client_id,id);
  const ready=packet(1,'{"evt":"READY"}');
  pipe.emit('data',ready.subarray(0,3));pipe.emit('data',ready.subarray(3));
  const cmd=JSON.parse(pipe.writes[1].subarray(8));
  assert.equal(cmd.args.pid,42);assert.equal(cmd.args.activity.state,'KS Client');assert.equal(cmd.cmd,'SET_ACTIVITY');
  assert.notEqual(rpc.getStatus(),'active');
  pipe.emit('data',Buffer.concat([packet(3,'ping'),packet(1,JSON.stringify({cmd:cmd.cmd,nonce:cmd.nonce}))]));
  assert.equal(pipe.writes[2].readUInt32LE(),4);assert.equal(rpc.getStatus(),'active');
  pipe.destroy();await new Promise(r=>setTimeout(r,15));assert.equal(pipes.length,3);
  rpc.stop();assert.equal(rpc.getStatus(),'off');assert(pipes[2].closed);
  console.log('PASS: Discord pipe discovery, fragmented handshake, acknowledged presence and reconnect');
})().catch(e=>{console.error(e);process.exitCode=1});
