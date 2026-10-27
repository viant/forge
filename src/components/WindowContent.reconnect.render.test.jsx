// Synthetic transport fixtures; no captured application metadata.
// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,test,vi} from 'vitest';
import WindowContent from './WindowContent.jsx';
import {SettingProvider} from '../core';
import {registerContainerRenderer} from '../runtime/containerRendererRegistry.js';
import {removeSignalsForKey} from '../core/store/signals.js';

const transport = vi.hoisted(() => ({current:null}));
vi.mock('../core', async importActual => ({
 ...await importActual(),
 getActiveUIBridgeTransportContext: () => transport.current,
}));

registerContainerRenderer('test.metadata-recovery',()=>React.createElement('div',{'data-recovered-window':true},'Ready window'));
let root,host;
const windowId='metadata-recovery-window';
const flush=()=>act(async()=>{for(let i=0;i<30;i++)await Promise.resolve();});
afterEach(async()=>{
 if(root)await act(async()=>root.unmount());
 host?.remove();root=null;removeSignalsForKey(windowId);vi.restoreAllMocks();transport.current=null;
});
async function mount(options={}){
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 vi.spyOn(console,'error').mockImplementation(()=>{});
 let healthy=false,calls=0,permissions=0;
 const metadata={dataSource:{},view:{content:{id:'ready',kind:'test.metadata-recovery'}},...(options.protected?{authorization:{scope:'resource'}}:{})};
 const services={dataConnectorTransport:async()=>{
  calls++;if(!healthy)throw Object.assign(new Error('metadata unavailable'),{status:options.status || 500});
  return {data:metadata};
 },applyPermission:async value=>{permissions++;if(options.denyPermission)throw Object.assign(new Error('denied'),{status:403});return {...value.completeMetadata,authorizationSnapshot:{resources:{}}};}};
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root.render(React.createElement(SettingProvider,{connectorConfig:{window:{service:{uri:'/window'}}},services},React.createElement(WindowContent,{window:{windowId,windowKey:'recovery',parameters:{}}}))));
 await flush();
 return {recover:()=>{healthy=true;},calls:()=>calls,permissions:()=>permissions};
}
async function retry(times=1){await act(async()=>{for(let i=0;i<times;i++)window.dispatchEvent(new Event('forge:retry-window-metadata'));});await flush();}
test('reconnect retries a retained 403 only after the owning bridge session changes',async()=>{
 transport.current={url:'http://example.test/rpc',clientId:'owner',sessionId:'before'};
 const state=await mount({status:403});state.recover();
 const ready=()=>window.dispatchEvent(new CustomEvent('forge:retry-window-metadata',{detail:{reason:'transport-ready'}}));
 await act(async()=>ready());await flush();expect(state.calls()).toBe(1);
 transport.current={...transport.current,sessionId:'after'};
 await act(async()=>{ready();ready();});await flush();
 expect(state.calls()).toBe(2);expect(host.querySelector('[data-recovered-window]')).not.toBeNull();
 await act(async()=>ready());await flush();expect(state.calls()).toBe(2);
});

test('a producer denial remains closed after reconnect and is not retried again',async()=>{
 transport.current={url:'http://example.test/rpc',clientId:'owner',sessionId:'before'};
 const state=await mount({status:403});
 transport.current={...transport.current,sessionId:'after'};
 const ready=()=>window.dispatchEvent(new CustomEvent('forge:retry-window-metadata',{detail:{reason:'transport-ready'}}));
 await act(async()=>ready());await flush();expect(state.calls()).toBe(2);
 expect(host.querySelector('[role=alert]')).not.toBeNull();expect(host.querySelector('[data-recovered-window]')).toBeNull();
 await act(async()=>ready());await flush();expect(state.calls()).toBe(2);
});

test.each([{clientId:'other',sessionId:'after',url:'http://example.test/rpc'},
 {clientId:'owner',sessionId:'after',url:'http://other.test/rpc'}])('another bridge cannot trigger retained denial recovery: %j',async current=>{
 transport.current={url:'http://example.test/rpc',clientId:'owner',sessionId:'before'};
 const state=await mount({status:403});state.recover();transport.current=current;
 await act(async()=>window.dispatchEvent(new CustomEvent('forge:retry-window-metadata',{detail:{reason:'transport-ready'}})));await flush();
 expect(state.calls()).toBe(1);expect(host.querySelector('[data-recovered-window]')).toBeNull();
});
