import React, {act,createContext} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it} from 'vitest';
import fs from 'node:fs';
import WindowContent from './WindowContent.jsx';
import {SettingProvider} from '../core/context/Setting.jsx';
import {activeWindows, selectedWindowId, selectedTabId, getMetadataSignal, getViewSignal, getFormSignal, getInputSignal, getSelectionSignal, removeSignalsForKey} from '../core/store/signals.js';
import {buildUISnapshot} from '../core/ui/snapshot.js';
import {getWindowContext} from '../core/context/registry.js';
import {captureWindowStateAdoption, waitForWindowStateAdoption} from '../runtime/windowStateAdoption.js';
import '../packs/blueprint/index.jsx';

const capture=(windowId,options={})=>captureWindowStateAdoption(windowId,{getContextKey:window=>window.contextKey||'',...options});
let counter = 0;
async function fixture(change = '', pinned = false, heldExpired = false, publicOwned = false, sourceContext = '') {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const id = `adopting-record-${++counter}`, host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const binding = {actor:{issuer:'test-issuer',subject:'actor-a'},instanceId:'instance-a',parametersDigest:'record-7',token:'server-issued-fixture'};
  const metadata = {resource:{uri:'window://test/record',revision:'v1'},selectionBinding:binding,
    dataSource:{record:{id:'record',service:{uri:'mcp://test/record'},uniqueKey:[{field:'id'}],selectionMode:'single',selectors:{data:'data'}}},
    view:{dataSourceRef:'record',content:{id:'editor',dataSourceRef:'record',draftForm:{dataSourceRef:'record'},items:[{id:'name',type:'text',scope:'form',dataField:'name'}]}}};
  if (pinned) {
    delete metadata.selectionBinding;
    metadata.resource={providerIdentity:'trusted-owner',uri:'window://test/record',kind:'working',contentFingerprint:'content-v1',authorityBinding:'verified-actor-account-revision',validUntil:new Date(Date.now()+60000).toISOString()};
    metadata.authorizationSnapshot={principal:{roles:['viewer'],userAuthorities:['read']},authorizationVersion:'v1'};
  }
  if(publicOwned){metadata.resource.authorityBinding='public-local-definition';metadata.resource.validUntil='0001-01-01T00:00:00Z';metadata.resourceTarget={platform:'web',formFactor:'desktop',selectionToken:'old-signature',dependencyPins:{shared:{uri:'datasource://test/shared',contentFingerprint:'shared-v1',authorityBinding:'verified-owner',validUntil:new Date(Date.now()+60000).toISOString()}}};metadata.localStateOwner={binding:'server-verified-owner',validUntil:new Date(Date.now()+60000).toISOString()};}
  const original = {windowId:id,windowKey:'record',contextKey:sourceContext,parameters:{RecordId:[7]},selectionBinding:binding,inlineMetadata:metadata};
  if (pinned) {delete original.selectionBinding;original.resource=metadata.resource;if(publicOwned)original.resourceTarget=metadata.resourceTarget;}
  activeWindows.value = [original];
  selectedWindowId.value = selectedTabId.value = id;
  let finishAdmission, finishRows, metadataReads=0, rowReads=0;
  const services = {dataConnectorTransport: async request => {
    if (request.dataSourceRef === 'record') {
      rowReads++;
      const result={data:[{id:change==='record'&&rowReads===2?8:7,name:`server-${rowReads}`,serverOnly:`baseline-${rowReads}`,nested:{editable:`server-${rowReads}`,serverOnly:`baseline-${rowReads}`}}]};
      if (change==='newer-edit' && rowReads===2) return new Promise(resolve=>{finishRows=()=>resolve(result);});
      return result;
    }
    metadataReads++;
    if(pinned && metadataReads===1)return {data:structuredClone(metadata)};
    return new Promise((resolve,reject) => {finishAdmission = () => {
      if (change === 'denied') return reject(Object.assign(new Error('Access denied'),{status:403}));
      const fresh = structuredClone(metadata);
      if(publicOwned){fresh.resourceTarget.selectionToken='fresh-signature';fresh.resourceTarget.dependencyPins.shared.validUntil=new Date(Date.now()+45000).toISOString();if(change==='target')fresh.resourceTarget.formFactor='phone';if(change==='dependency')fresh.resourceTarget.dependencyPins.shared.contentFingerprint='different-shared-version';fresh.localStateOwner.validUntil=new Date(Date.now()+45000).toISOString();if(change==='owner')fresh.localStateOwner.binding='another-verified-owner';if(change==='owner-expired')fresh.localStateOwner.validUntil=new Date(Date.now()-1000).toISOString();if(change==='owner-missing')delete fresh.localStateOwner;}
      if (change === 'actor') {if(pinned)fresh.resource.authorityBinding='another-actor';else fresh.selectionBinding.actor.subject='actor-b';}
      if (change === 'missing-binding') delete fresh.resource.authorityBinding;
      if (change === 'expired') fresh.resource.validUntil=new Date(Date.now()-1000).toISOString();
      if (pinned && !publicOwned && !['expired'].includes(change)) fresh.resource.validUntil=new Date(Date.now()+45000).toISOString();
      if (change === 'pin') {if(pinned)fresh.resource.contentFingerprint='content-v2';else fresh.selectionBinding.instanceId='instance-b';}
      if (change === 'resource') fresh.resource.revision='v2';
      if (change === 'policy') fresh.authorizationSnapshot={principal:{id:'actor-a'},resource:{id:7,capabilities:{read:true,write:false}}};
      resolve({data:fresh});
    };});
  }};
  const settle = async fn => act(async () => {fn?.();for(let i=0;i<100;i++)await Promise.resolve();});
  const AuthContext=createContext({}),authScopes=new Map();
  const scopeAuth=key=>{if(!authScopes.has(key))authScopes.set(key,{});return authScopes.get(key);};
  const render = window => root.render(<AuthContext.Provider value={scopeAuth(window.contextKey||'')}><SettingProvider authContext={AuthContext} connectorConfig={{window:{service:{uri:'/window'}}}} services={services}><WindowContent window={window}/></SettingProvider></AuthContext.Provider>);
  await settle(() => render(original));
  const context = getWindowContext(id).Context('record');
  await settle(() => context.handlers.dataSource.setEditedFormData({values:{...context.signals.form.peek(),name:'local-draft',nested:{...context.signals.form.peek().nested,editable:'nested-draft'}}}));
  await settle(()=>{
    getViewSignal(id).value={tabs:{primary:'properties'}};
    getInputSignal(`${id}DSrecord`).value={...getInputSignal(`${id}DSrecord`).peek(),filter:{status:'active'},page:3,fetch:false,refresh:false};
  });
  if(change==='held-expired'||heldExpired) {
    const expired=new Date(Date.now()-1000).toISOString();
    getMetadataSignal(id).peek().resource.validUntil=expired;
    original.resource.validUntil=expired;
  }
  if(change==='owner-held-expired')getMetadataSignal(id).peek().localStateOwner.validUntil=new Date(Date.now()-1000).toISOString();
  const captured = capture(id);
  expect(captured).toBeTruthy();
  captured.commit('destination-context');
  const adopted = {...original,contextKey:'destination-context'};
  await settle(() => {activeWindows.value=[adopted];render(adopted);});
  return {id,host,settle,captured,finish:()=>finishAdmission(),finishRows:()=>finishRows(),metadataReads:()=>metadataReads,rowReads:()=>rowReads,
    close:async()=>{await settle(()=>root.unmount());activeWindows.value=[];selectedWindowId.value=selectedTabId.value=null;removeSignalsForKey(id);host.remove();}};
}

it('clears first, freshly admits the same scope, restores choices and draft patch over fresh data, and resets to fresh baseline',async()=>{
  const v=await fixture();
  try {
    expect(v.metadataReads()).toBe(1);
    expect(getMetadataSignal(v.id).peek()).toBeNull();
    expect(getFormSignal(`${v.id}DSrecord`).peek()).toEqual({});
    expect(getViewSignal(v.id).peek()).toEqual({});
    const baseline = buildUISnapshot({includeCollection:true});
    await v.settle(v.finish);
    expect(await waitForWindowStateAdoption(v.id,100)).toBe(false); // completed intents are removed
    const source=getWindowContext(v.id).Context('record');
    expect(source.signals.form.peek()).toEqual({id:7,name:'local-draft',serverOnly:'baseline-2',nested:{editable:'nested-draft',serverOnly:'baseline-2'}});
    expect(source.signals.formStatus.peek().dirty).toBe(true);
    expect(getViewSignal(v.id).peek().tabs.primary).toBe('properties');
    expect(getInputSignal(`${v.id}DSrecord`).peek()).toMatchObject({filter:{status:'active'},page:3});
    expect(getSelectionSignal(`${v.id}DSrecord`).peek().selected).toMatchObject({id:7,name:'server-2'});
    if (process.env.UI_ADOPTION_SNAPSHOT_PROOF) {
      const preserved=buildUISnapshot({includeCollection:true});
      fs.writeFileSync(process.env.UI_ADOPTION_SNAPSHOT_PROOF,JSON.stringify({baseline:{...baseline,ts:1500},preserved:{...preserved,ts:1500}},null,2)+'\n',{mode:0o600});
    }
    const reset=[...v.host.querySelectorAll('button')].find(button=>button.textContent==='Reset');
    expect(reset).toBeTruthy();
    await v.settle(()=>reset.click());
    expect(source.signals.form.peek()).toEqual({id:7,name:'server-2',serverOnly:'baseline-2',nested:{editable:'server-2',serverOnly:'baseline-2'}});
    expect(source.signals.formStatus.peek().dirty).toBe(false);
  } finally {await v.close();}
});
for(const change of ['actor','pin','resource','policy','denied']) it(`does not restore a ${change} change after fresh admission`,async()=>{
  const v=await fixture(change);
  try {
    await v.settle(v.finish);
    expect(getViewSignal(v.id).peek().tabs?.primary).not.toBe('properties');
    expect(getFormSignal(`${v.id}DSrecord`).peek().name).not.toBe('local-draft');
    expect(getInputSignal(`${v.id}DSrecord`).peek().filter?.status).not.toBe('active');
  } finally {await v.close();}
});
for(const expiredHeld of [false,true]) it(`does not overwrite a newer edit while the fresh reader is pending (expired held: ${expiredHeld})`,async()=>{
  const v=await fixture('newer-edit',expiredHeld,expiredHeld);
  try {
    await v.settle(v.finish);
    const source=getWindowContext(v.id).Context('record');
    await v.settle(()=>source.handlers.dataSource.setEditedFormData({values:{id:7,name:'newer-edit'}}));
    await v.settle(v.finishRows);
    expect(source.signals.form.peek().name).toBe('newer-edit');
    expect(source.signals.form.peek().serverOnly).toBe('baseline-2');
    expect(source.signals.form.peek().nested).toEqual({editable:'nested-draft',serverOnly:'baseline-2'});
  } finally {await v.close();}
});
it('does not restore after the adopted window moves to an unrelated host context',async()=>{
  const v=await fixture();
  try {
    await v.settle(()=>{activeWindows.value=activeWindows.peek().map(window=>({...window,contextKey:'unrelated-context'}));});
    await v.settle(v.finish);
    expect(getViewSignal(v.id).peek().tabs?.primary).not.toBe('properties');
    expect(getFormSignal(`${v.id}DSrecord`).peek().name).not.toBe('local-draft');
  } finally {await v.close();}
});

it('restores a normally fetched resolved-resource window with an opaque actor binding and renewed lease',async()=>{
  const v=await fixture('',true);
  try {
    expect(v.metadataReads()).toBe(2);
    expect(getMetadataSignal(v.id).peek()).toBeNull();
    await v.settle(v.finish);
    const source=getWindowContext(v.id).Context('record');
    expect(getViewSignal(v.id).peek().tabs.primary).toBe('properties');
    expect(source.signals.form.peek()).toMatchObject({name:'local-draft',serverOnly:'baseline-2'});
    expect(source.signals.formStatus.peek().dirty).toBe(true);
    await v.settle(()=>[...v.host.querySelectorAll('button')].find(button=>button.textContent==='Reset').click());
    expect(source.signals.form.peek().name).toBe('server-2');
    expect(source.signals.formStatus.peek().dirty).toBe(false);
  }finally{await v.close();}
});
for(const change of ['actor','pin','resource','policy','missing-binding','expired','denied']) it(`rejects resolved-resource restoration after ${change} changes`,async()=>{
  const v=await fixture(change,true);
  try {
    await v.settle(v.finish);
    expect(getViewSignal(v.id).peek().tabs?.primary).not.toBe('properties');
    expect(getFormSignal(`${v.id}DSrecord`).peek().name).not.toBe('local-draft');
  }finally{await v.close();}
});

for(const field of ['providerIdentity','uri','kind','contentFingerprint','authorityBinding']) it(`does not capture a resolved-resource window missing ${field}`,()=>{
  const id=`missing-adoption-${++counter}`;
  const resource={providerIdentity:'trusted-owner',uri:'window://test/record',kind:'working',contentFingerprint:'content-v1',authorityBinding:'verified-actor',validUntil:new Date(Date.now()+60000).toISOString()};
  delete resource[field];
  activeWindows.value=[{windowId:id,windowKey:'record',resource}];
  getMetadataSignal(id).value={resource,authorizationSnapshot:{principal:{roles:['viewer']}},view:{}};
  try{expect(capture(id)).toBeNull();}
  finally{activeWindows.value=[];removeSignalsForKey(id);}
});

it('reports only bounded fixed codes for a multi-source capture and serialization failure',()=>{
  const id=`diagnostic-adoption-${++counter}`,events=[];
  const resource={providerIdentity:'trusted-owner',uri:'window://test/record',kind:'working',contentFingerprint:'content-v1',authorityBinding:'private-authority-binding',validUntil:new Date(Date.now()+60000).toISOString()};
  activeWindows.value=[{windowId:id,windowKey:'record',resource}];
  getMetadataSignal(id).value={resource,authorizationSnapshot:{principal:{roles:['viewer'],userAuthorities:['read']}},dataSource:{record:{uniqueKey:[{field:'id'}]},properties:{dataSourceRef:'record',uniqueKey:[{field:'id'}]},lookup:{autoFetch:false,uniqueKey:[{field:'id'}]}},view:{}};
  getInputSignal(`${id}DSrecord`).value={filter:{status:'active'},page:2,parameters:{RecordId:[7]}};
  getInputSignal(`${id}DSlookup`).value={parameters:{callback:()=> 'private-function-return'}};
  try {
    expect(capture(id,{onDiagnostic:code=>events.push(code)})).toBeNull();
    expect(events).toEqual(['capture.clone_failure']);
    getInputSignal(`${id}DSlookup`).value={parameters:{Query:'safe search'}};
    const handle=capture(id,{onDiagnostic:code=>events.push(code)});
    expect(handle).toBeTruthy();
    for(let i=0;i<50;i++)handle.commit('destination-context');
    handle.cancel();
    expect(events.length).toBeLessThanOrEqual(25);
    expect(events.every(code=>/^capture\.(clone_failure|ready|committed)$|^restore\.cancelled$/.test(code))).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/private|authority|safe search|RecordId|destination-context/);
  }finally{activeWindows.value=[];removeSignalsForKey(id);}
});

it('retains only local intent from an expired held lease and restores after fresh same-scope admission',async()=>{
  const v=await fixture('held-expired',true);
  try {
    expect(v.metadataReads()).toBe(2);
    expect(getMetadataSignal(v.id).peek()).toBeNull();
    expect(getFormSignal(`${v.id}DSrecord`).peek()).toEqual({});
    await v.settle(v.finish);
    const source=getWindowContext(v.id).Context('record');
    expect(getViewSignal(v.id).peek().tabs.primary).toBe('properties');
    expect(source.signals.form.peek()).toMatchObject({name:'local-draft',serverOnly:'baseline-2'});
    expect(source.signals.formStatus.peek().dirty).toBe(true);
    await v.settle(()=>[...v.host.querySelectorAll('button')].find(button=>button.textContent==='Reset').click());
    expect(source.signals.form.peek().name).toBe('server-2');
    expect(source.signals.formStatus.peek().dirty).toBe(false);
  }finally{await v.close();}
});

for(const change of ['actor','pin','resource','policy','missing-binding','expired','denied']) it(`rejects expired local intent when fresh admission has ${change}`,async()=>{
  const v=await fixture(change,true,true);
  try {
    await v.settle(v.finish);
    expect(getViewSignal(v.id).peek().tabs?.primary).not.toBe('properties');
    expect(getFormSignal(`${v.id}DSrecord`).peek().name).not.toBe('local-draft');
  }finally{await v.close();}
});

it('does not treat public local metadata and role hints as verified actor admission',()=>{
  const id=`public-adoption-${++counter}`,events=[];
  const resource={providerIdentity:'public-owner',uri:'window://test/record',kind:'working',contentFingerprint:'content-v1',authorityBinding:'public-local-definition',validUntil:'0001-01-01T00:00:00Z'};
  activeWindows.value=[{windowId:id,windowKey:'record',resource}];
  getMetadataSignal(id).value={resource,authorizationSnapshot:{principal:{roles:['viewer'],userAuthorities:['read']}},view:{}};
  try {
    expect(capture(id,{onDiagnostic:code=>events.push(code)})).toBeNull();
    expect(events).toEqual(['capture.public_resource']);
  }finally{activeWindows.value=[];removeSignalsForKey(id);}
});

it('restores a public definition only after the fresh verified host owner and policy match',async()=>{
  const v=await fixture('',true,false,true);
  try {
    expect(v.metadataReads()).toBe(2);
    expect(getMetadataSignal(v.id).peek()).toBeNull();
    await v.settle(v.finish);
    const source=getWindowContext(v.id).Context('record');
    expect(source.signals.form.peek()).toMatchObject({name:'local-draft',serverOnly:'baseline-2'});
    expect(getViewSignal(v.id).peek().tabs.primary).toBe('properties');
    expect(source.signals.formStatus.peek().dirty).toBe(true);
    expect(JSON.stringify(buildUISnapshot({includeCollection:true}))).not.toContain('server-verified-owner');
    await v.settle(()=>[...v.host.querySelectorAll('button')].find(button=>button.textContent==='Reset').click());
    expect(source.signals.form.peek().name).toBe('server-2');
    expect(source.signals.formStatus.peek().dirty).toBe(false);
  }finally{await v.close();}
});
for(const change of ['owner','owner-expired','owner-missing','pin','resource','target','dependency','policy','denied']) it(`does not restore public local state after ${change} changes`,async()=>{
  const v=await fixture(change,true,false,true);
  try{await v.settle(v.finish);expect(getViewSignal(v.id).peek().tabs?.primary).not.toBe('properties');expect(getFormSignal(`${v.id}DSrecord`).peek().name).not.toBe('local-draft');}
  finally{await v.close();}
});
it('does not restore a verified public owner after parameters switch while capture is pending',async()=>{
 const v=await fixture('',true,false,true);
 try{await v.settle(()=>{activeWindows.value=activeWindows.peek().map(w=>({...w,parameters:{RecordId:[8]}}));});await v.settle(v.finish);expect(getFormSignal(`${v.id}DSrecord`).peek().name).not.toBe('local-draft');expect(getViewSignal(v.id).peek().tabs?.primary).not.toBe('properties');}finally{await v.close();}
});

it('renews an expired verified local owner only through normal fresh same-scope admission',async()=>{
 const v=await fixture('owner-held-expired',true,false,true);try{await v.settle(v.finish);expect(getViewSignal(v.id).peek().tabs.primary).toBe('properties');expect(getFormSignal(`${v.id}DSrecord`).peek().name).toBe('local-draft');}finally{await v.close();}
});
it('preserves a newer user edit while public-owner fresh rows are pending',async()=>{
 const v=await fixture('newer-edit',true,false,true);try{await v.settle(v.finish);const source=getWindowContext(v.id).Context('record');await v.settle(()=>source.handlers.dataSource.setEditedFormData({values:{id:7,name:'newer-local-edit'}}));await v.settle(v.finishRows);expect(source.signals.form.peek().name).toBe('newer-local-edit');expect(source.signals.form.peek().serverOnly).toBe('baseline-2');}finally{await v.close();}
});
it('does not overlay a prior-record draft onto a different freshly returned record',async()=>{
 const v=await fixture('record',true,false,true);try{await v.settle(v.finish);expect(getFormSignal(`${v.id}DSrecord`).peek()).toMatchObject({id:8,name:'server-2'});}finally{await v.close();}
});

it('requires a host association resolver and fails closed when that resolver is unavailable',()=>{
 const events=[];expect(captureWindowStateAdoption('missing',{onDiagnostic:code=>events.push(code)})).toBeNull();expect(events).toEqual(['capture.context_unavailable']);
});
it('preserves generic state across a host-defined context transition without knowing its meaning',async()=>{
 const v=await fixture('',true,false,true,'source-context');try{await v.settle(v.finish);expect(getViewSignal(v.id).peek().tabs.primary).toBe('properties');expect(getFormSignal(`${v.id}DSrecord`).peek().name).toBe('local-draft');}finally{await v.close();}
});
it('does not let a host association claim substitute for verified admission',()=>{
 const id=`unverified-context-${++counter}`;activeWindows.value=[{windowId:id,windowKey:'record',contextKey:'destination-context'}];getMetadataSignal(id).value={view:{},dataSource:{}};
 try{expect(capture(id,{getContextKey:()=> 'destination-context'})).toBeNull();}finally{activeWindows.value=[];removeSignalsForKey(id);}
});
