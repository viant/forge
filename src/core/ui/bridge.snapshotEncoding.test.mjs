import assert from 'node:assert/strict';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import {startUIBridgeHTTP,publishUIBridgeSnapshotNow} from './bridge.js';
const pause=()=>new Promise(resolve=>setTimeout(resolve,1));
async function until(check){const end=Date.now()+3000;while(!check()){if(Date.now()>end)throw Error('bridge test timed out');await pause();}}
const large=revision=>({conversationId:'chat-current',selected:{windowId:'editor'},windows:[{windowId:'editor',parameters:{id:7},viewState:{tabs:{main:'properties'}},dataSources:{record:{form:{name:'日本語 café 👋'.repeat(4000),revision},formStatus:{dirty:true},selection:{selected:{id:7}},collection:[{id:7}],input:{filter:{status:'active'},page:2}}}}]});
function fixture({advertise=true,capabilitiesByHello,build,holdPoll=false}={}){
 const old={fetch:globalThis.fetch,window:globalThis.window,document:globalThis.document,compression:globalThis.CompressionStream};
 const window=new EventTarget();window.sessionStorage={getItem:()=>null,setItem(){}};globalThis.window=window;globalThis.document={visibilityState:'visible',hasFocus:()=>true,addEventListener:window.addEventListener.bind(window),removeEventListener:window.removeEventListener.bind(window)};
 const calls=[];let hello=0,failPoll;
 globalThis.fetch=async(_url,options)=>{
  const encoded=options.headers['Content-Encoding'];const body=JSON.parse(encoded==='gzip'?gunzipSync(options.body).toString('utf8'):options.body);calls.push({body,encoded,session:options.headers['Mcp-Session-Id']});
  const headers=new Headers({'Mcp-Session-Id':`session-${hello||1}`});let result={ok:true};
  if(body.method==='ui.hello'){hello++;headers.set('Mcp-Session-Id',`session-${hello}`);if(capabilitiesByHello?.(hello)??advertise)result.capabilities={snapshotRequestEncodings:['gzip'],maxInflatedSnapshotBytes:32*1024*1024};}
  if(body.method==='ui.poll'){
   if(holdPoll&&!failPoll)return new Promise(resolve=>{failPoll=()=>resolve(new Response('',{status:404}));options.signal?.addEventListener('abort',()=>resolve(new Response('',{status:202})),{once:true});});
   return new Response('',{status:202,headers});
  }
  return new Response(JSON.stringify({jsonrpc:'2.0',id:body.id,result}),{status:200,headers});
 };
 const stop=startUIBridgeHTTP({url:'http://bridge.test/ui',snapshotBuilder:build,snapshotIntervalMs:100000,snapshotStatusIntervalMs:100000,reconnectDelayMs:100000,pollCycleDelayMs:100000});
 return {calls,stop,failPoll:()=>failPoll?.(),hasPoll:()=>!!failPoll,cleanup(){stop();Object.assign(globalThis,{fetch:old.fetch,window:old.window,document:old.document,CompressionStream:old.compression});}};
}
function gatedCompression(){const native=globalThis.CompressionStream;let release,entered;const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);globalThis.CompressionStream=class{constructor(){const stage=new TransformStream({async transform(chunk,controller){entered();await gate;controller.enqueue(chunk);}});return {writable:stage.writable,readable:stage.readable.pipeThrough(new native('gzip'))};}};return {started,release};}
test('new peer receives exact full UTF8 snapshot gzip while old peer and unsupported browser receive plain JSON',async()=>{
 for(const mode of ['new','old','browser']){const snapshot=large(1);const native=globalThis.CompressionStream;if(mode==='browser')globalThis.CompressionStream=undefined;const f=fixture({advertise:mode!=='old',build:()=>snapshot});try{await until(()=>f.calls.some(x=>x.body.method==='ui.snapshot'));const call=f.calls.find(x=>x.body.method==='ui.snapshot');assert.equal(call.encoded,mode==='new'?'gzip':undefined);assert.deepEqual(call.body.params.data,snapshot);assert.equal(f.calls.filter(x=>x.encoded).every(x=>x.body.method==='ui.snapshot'),true);}finally{f.cleanup();globalThis.CompressionStream=native;}}
});
test('prequery flush joins pending compression and publishes the latest edit before resolving',async()=>{
 let snapshot={conversationId:'chat-current',windows:[]};const f=fixture({build:()=>snapshot});let gate;try{await until(()=>f.calls.some(x=>x.body.method==='ui.snapshot'));gate=gatedCompression();snapshot=large(1);const first=publishUIBridgeSnapshotNow();await gate.started;snapshot=large(2);let finished=false;const flush=publishUIBridgeSnapshotNow().then(ok=>{finished=true;return ok;});await pause();assert.equal(finished,false);gate.release();assert.equal(await first,true);assert.equal(await flush,true);const sent=f.calls.filter(x=>x.body.method==='ui.snapshot');assert.deepEqual(sent.at(-1).body.params.data,large(2));assert.equal(sent.at(-1).encoded,'gzip');}finally{gate?.release();f.cleanup();}
});
test('stop cancels pending compression without sending retired snapshot',async()=>{
 let snapshot={conversationId:'chat-current',windows:[]};const f=fixture({build:()=>snapshot});let gate;try{await until(()=>f.calls.some(x=>x.body.method==='ui.snapshot'));gate=gatedCompression();snapshot=large(3);const pending=publishUIBridgeSnapshotNow();await gate.started;const before=f.calls.length;f.stop();await pending;gate.release();await pause();assert.equal(f.calls.length,before);}finally{gate?.release();f.cleanup();}
});
test('session recovery cancels retired compression and renegotiates encoding for the new session',async()=>{
 let snapshot={conversationId:'old-chat',windows:[]};const f=fixture({build:()=>snapshot,holdPoll:true,capabilitiesByHello:n=>n===1});let gate;try{await until(()=>f.hasPoll());gate=gatedCompression();snapshot=large(4);const pending=publishUIBridgeSnapshotNow();await gate.started;snapshot={...large(5),conversationId:'new-chat'};f.failPoll();await until(()=>f.calls.filter(x=>x.body.method==='ui.hello').length===2);gate.release();await pending;await until(()=>f.calls.some(x=>x.body.method==='ui.snapshot'&&x.body.params.data.conversationId==='new-chat'));const sent=f.calls.filter(x=>x.body.method==='ui.snapshot');assert.equal(sent.some(x=>x.body.params.data.windows?.[0]?.dataSources?.record?.form?.revision===4),false);assert.equal(sent.at(-1).encoded,undefined);assert.equal(sent.at(-1).session,'session-2');}finally{gate?.release();f.cleanup();}
});
