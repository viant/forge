import assert from 'node:assert/strict';
import {startUIBridgeHTTP, getActiveUIBridgeTransportContext, waitForUIBridgeReady} from './bridge.js';
const original = {fetch:globalThis.fetch,window:globalThis.window,document:globalThis.document};
let stop;
try {
 const target=new EventTarget();target.sessionStorage={getItem:()=>null,setItem:()=>{}};
 globalThis.window=target;
 globalThis.document={visibilityState:'visible',hasFocus:()=>true,addEventListener:target.addEventListener.bind(target),removeEventListener:target.removeEventListener.bind(target)};
 globalThis.fetch=async(_url,init)=>{
  const request=JSON.parse(init.body);
  const headers={'Mcp-Session-Id':'owned-session'};
  if(request.method==='ui.poll')return new Response('',{status:202,headers});
  return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result:request.method==='ui.snapshot.get'?{snapshot:{windows:[]}}:{ok:true}}),{status:200,headers});
 };
 assert.equal(getActiveUIBridgeTransportContext(),null);
 stop=startUIBridgeHTTP({url:'http://owned/v1/ui/rpc',clientId:'owned-client',snapshotIntervalMs:60000,pollCycleDelayMs:1000});
 assert.equal(await waitForUIBridgeReady(2000),true);
 assert.deepEqual(getActiveUIBridgeTransportContext(),{url:'http://owned/v1/ui/rpc',clientId:'owned-client',sessionHeader:'Mcp-Session-Id',sessionId:'owned-session'});
 const detached=getActiveUIBridgeTransportContext();detached.sessionId='forged';
 assert.equal(getActiveUIBridgeTransportContext().sessionId,'owned-session');
 stop();assert.equal(getActiveUIBridgeTransportContext(),null);
 console.log('bridge transport ownership lifecycle PASS');
} finally {stop?.();Object.assign(globalThis,original);}
