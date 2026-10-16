import assert from 'node:assert/strict';
import {test} from 'node:test';
import {startUIBridgeHTTP} from './bridge.js';

class Listeners extends EventTarget {
  handlers = new Map();
  addEventListener(name, handler, options) {
    const held = this.handlers.get(name) || new Set();
    held.add(handler); this.handlers.set(name, held);
    super.addEventListener(name, handler, options);
  }
  removeEventListener(name, handler, options) {
    this.handlers.get(name)?.delete(handler);
    super.removeEventListener(name, handler, options);
  }
  count(name) { return this.handlers.get(name)?.size || 0; }
}
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
const reply = (body, result = {}, session = 'fixture-session') => new Response(JSON.stringify({jsonrpc:'2.0',id:body.id,result}), {status:200,headers:{'Mcp-Session-Id':session}});

function fixture(t, receive, options = {}) {
  const original = {fetch:globalThis.fetch, window:globalThis.window, document:globalThis.document};
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const target = new Listeners(); target.sessionStorage = {getItem:()=>'',setItem:()=>{}};
  globalThis.window = target;
  globalThis.document = {visibilityState:'visible',hasFocus:()=>true,
    addEventListener:target.addEventListener.bind(target),removeEventListener:target.removeEventListener.bind(target)};
  const calls = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body); calls.push({method:body.method,session:init.headers['Mcp-Session-Id']});
    return receive(body, init);
  };
  const stop = startUIBridgeHTTP({url:'http://fixture.test/v1/ui/rpc',snapshotIntervalMs:10000,
    snapshotStatusIntervalMs:1000,reconnectDelayMs:500,pollCycleDelayMs:0,pollWhenHidden:true,
    snapshotBuilder:()=>({windows:[],version:1}),...options});
  t.after(async () => {
    stop(); target.dispatchEvent(new Event('fixture:ready'));
    t.mock.timers.tick(10000); await flush();
    Object.assign(globalThis, original);
  });
  return {stop,target,calls,advance:async ms=>{t.mock.timers.tick(ms);await flush();}};
}
function heldPoll(init, state) {
  state.active++; state.peak = Math.max(state.peak, state.active);
  return new Promise((_,reject) => {
    const abort = () => { state.active--; reject(new DOMException('Stopped','AbortError')); };
    init.signal.addEventListener('abort',abort,{once:true});
    if (init.signal.aborted) abort();
  });
}

test('missing-session recovery retains exactly one poll and one set of owner listeners', async t => {
  let hellos=0,statuses=0; const state={active:0,peak:0};
  const f=fixture(t,async(body,init)=>{
    if(body.method==='ui.hello')hellos++;
    if(body.method==='ui.poll')return heldPoll(init,state);
    if(body.method==='ui.snapshot.status'&&++statuses<=3)return new Response('',{status:404});
    return reply(body,body.method==='ui.snapshot.status'?{connected:true}:{ok:true},'session-'+hellos);
  });
  await flush();
  for(let i=0;i<3;i++){await f.advance(1000);await f.advance(500);}
  assert.equal(hellos,4);
  assert.equal(state.peak,1);
  assert.equal(state.active,1);
  assert.equal(f.target.count('focus'),1);
  assert.equal(f.target.count('blur'),1);
  assert.equal(f.target.count('visibilitychange'),1);
  f.stop(); await f.advance(1000);
  assert.equal(state.active,0);
  assert.equal(f.target.count('focus'),0);
  assert.equal(f.target.count('visibilitychange'),0);
});

test('a late retired poll cannot overwrite the fresh session or execute its command',async t=>{
  let hellos=0,statuses=0,polls=0,release;const state={active:0,peak:0};
  const f=fixture(t,async(body,init)=>{
    if(body.method==='ui.hello')hellos++;
    if(body.method==='ui.snapshot.status'&&++statuses===1)return new Response('',{status:404});
    if(body.method==='ui.poll'){
      if(++polls===1)return new Promise(resolve=>{release=()=>resolve(reply(body,{method:'ui.command',params:{id:'retired-command',method:'fixture.unsupported',params:{}}},'session-1'));});
      return heldPoll(init,state);
    }
    return reply(body,{ok:true},'session-'+hellos);
  });
  await flush();await f.advance(1000);
  assert.equal(hellos,2);
  release();await flush();await f.advance(500);
  assert.equal(f.calls.filter(c=>c.method==='ui.response').length,0);
  assert.equal(f.calls.filter(c=>c.method==='ui.poll').at(-1).session,'session-2');
});

test('authorization retry starts one polling owner and removes old retry listeners',async t=>{
  let hellos=0;const state={active:0,peak:0};
  const f=fixture(t,async(body,init)=>{
    if(body.method==='ui.hello'&&++hellos===1)return new Response('',{status:401});
    if(body.method==='ui.poll')return heldPoll(init,state);
    return reply(body,{ok:true},'session-'+hellos);
  },{authReadyEvents:['fixture:authorized','fixture:other-authorized']});
  await flush();assert.equal(state.active,0);
  f.target.dispatchEvent(new Event('fixture:authorized'));
  f.target.dispatchEvent(new Event('fixture:other-authorized'));
  await flush();
  assert.equal(hellos,2);assert.equal(state.active,1);assert.equal(state.peak,1);
  assert.equal(f.target.count('fixture:authorized'),0);
  assert.equal(f.target.count('fixture:other-authorized'),0);
  const before=f.calls.length;f.stop();await f.advance(20000);
  assert.equal(state.active,0);assert.equal(f.calls.length,before);
});

test('a retired status response body cannot invalidate a freshly published snapshot',async t=>{
  let hellos=0,statuses=0,polls=0,failPoll,releaseText;
  const state={active:0,peak:0};
  const f=fixture(t,async(body,init)=>{
    if(body.method==='ui.hello')hellos++;
    if(body.method==='ui.poll'){
      if(++polls===1)return new Promise(resolve=>{failPoll=()=>resolve(new Response('',{status:404}));});
      return heldPoll(init,state);
    }
    if(body.method==='ui.snapshot.status'&&++statuses===1){
      const response=reply(body,{connected:false},'session-1');
      response.text=()=>new Promise(resolve=>{releaseText=()=>resolve(JSON.stringify({jsonrpc:'2.0',id:body.id,result:{connected:false}}));});
      return response;
    }
    return reply(body,{ok:true},'session-'+hellos);
  });
  await flush();await f.advance(1000);
  failPoll();await flush();await f.advance(500);
  assert.equal(hellos,2);
  const before=f.calls.filter(c=>c.method==='ui.snapshot').length;
  releaseText();await flush();
  assert.equal(f.calls.filter(c=>c.method==='ui.snapshot').length,before);
  assert.equal(f.calls.filter(c=>c.method==='ui.poll').at(-1).session,'session-2');
});

test('stop during hello ignores the late response and does not rearm requests or listeners',async t=>{
  let release;
  const f=fixture(t,async(body)=>{
    if(body.method==='ui.hello')return new Promise(resolve=>{release=()=>resolve(reply(body,{ok:true}));});
    return reply(body,{ok:true});
  });
  await flush();f.stop();release();await flush();await f.advance(20000);
  assert.deepEqual(f.calls.map(c=>c.method),['ui.hello']);
  assert.equal(f.target.count('focus'),0);
  assert.equal(f.target.count('pagehide'),0);
});

test('stop releases startup readiness observation without starting a poll',async t=>{
  const f=fixture(t,async body=>reply(body,{ok:true}),{startupReadyEvent:'fixture:ready',startupReadyTimeoutMs:0});
  await flush();assert.equal(f.target.count('fixture:ready'),1);
  f.stop();await flush();
  assert.equal(f.target.count('fixture:ready'),0);
  assert.equal(f.calls.filter(c=>c.method==='ui.poll').length,0);
  f.target.dispatchEvent(new Event('fixture:ready'));await flush();
  assert.equal(f.target.count('focus'),0);
});
