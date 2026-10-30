import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {expect, it} from 'vitest';
import DraftForm from './DraftForm.jsx';
import WindowContent from '../WindowContent.jsx';
import {SettingProvider} from '../../core/context/Setting.jsx';
import {getWindowContext} from '../../core/context/registry.js';
import {removeSignalsForKey} from '../../core/store/signals.js';
import {useDataSourceHandlers} from '../../hooks/dataSource.js';

const settle = fn => act(async () => { fn?.(); for (let i=0;i<25;i++) await Promise.resolve(); });
function fixture(id, parentId) {
  const signals = {form: signal({}), formStatus: signal({dirty:false,version:0}), windowForm:signal({open:true,parentId}), input:signal({}), selection:signal({}), control:signal({}), collection:signal([])};
  const identity = {windowId:id,dataSourceId:`${id}DSdraft`,dataSourceRef:'draft'};
  const context = {identity,signals,dataSource:{},metadata:{dataSource:{draft:{},settings:{}}},handlers:{},Context:ref=>ref==='settings'?source:context};
  context.handlers.dataSource = useDataSourceHandlers(identity,signals,{},null,{});
  const requests=[];
  const source = {identity:{...identity,dataSourceRef:'settings'},dataSource:{},signals:{},handlers:{dataSource:{setInputParameters(parameters){this.parameters=parameters},fetchCollection(){return new Promise((resolve,reject)=>requests.push({resolve,reject,parameters:this.parameters}))}}}};
  const lifecycle = {openWhen:{source:'windowForm',field:'open',equals:true}, key:[{name:'parentId',in:'windowForm',location:'parentId'}],defaults:[{name:'name',default:''},{name:'enabled',default:false},{name:'count',default:0},{name:'nullable',default:null},{name:'parentId',in:'windowForm',location:'parentId'}],source:{dataSourceRef:'settings',parameters:[{name:'id',in:'windowForm',location:'parentId'}],defaults:[{name:'name',in:'form',location:'settings.name'},{name:'currency',in:'form',location:'settings.currency',default:'USD'},{name:'enabled',in:'form',location:'settings.enabled'},{name:'count',in:'form',location:'settings.count'},{name:'nullable',in:'form',location:'settings.nullable'}]}};
  return {context,requests,lifecycle,form:()=>signals.form.peek(), edit:patch=>context.handlers.dataSource.setEditedFormData({values:{...signals.form.peek(),...patch}}),window:patch=>{signals.windowForm.value={...signals.windowForm.peek(),...patch}}};
}
it('isolates two windows, preserves edits, ignores old openings, resets latest defaults and retries failed native loads',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const a=fixture('draft-a',11),b=fixture('draft-b',22),host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const view=()=> <>{[a,b].map((f,i)=><section key={i} data-test-window={i}><DraftForm context={f.context} container={{id:'editor',draftForm:{lifecycle:f.lifecycle,confirmDiscard:'Discard edits?'}}}><input aria-label="Name"/></DraftForm></section>)}</>;
 const button=(index,label)=>[...host.querySelectorAll(`[data-test-window="${index}"] button`)].find(el=>el.textContent===label);
 try {
  await settle(()=>root.render(view()));
  expect(a.form()).toEqual({name:'',enabled:false,count:0,nullable:null,parentId:11});expect(b.form().parentId).toBe(22);
  expect(a.requests[0].parameters).toEqual({id:11});
  await settle(()=>{a.edit({name:'Edited',nullable:null,count:0,enabled:false});a.requests[0].resolve([{name:'Default A',currency:'EUR',enabled:true,count:9,nullable:'loaded'}]);b.requests[0].resolve([{name:'Default B',currency:'GBP'}]);});
  expect(a.form().name).toBe('Edited');expect(a.form().currency).toBe('EUR');expect(b.form().name).toBe('Default B');
  expect(a.context.signals.formStatus.peek().dirty).toBe(true);
  await settle(()=>button(0,'Reset').click());
  const cancel=()=>[...document.querySelectorAll('.bp5-alert button,.bp6-alert button')].find(el=>el.textContent==='Cancel');
  // Cancel the existing discard prompt: values stay dirty.
  const cancelButton=[...document.querySelectorAll('[role="alertdialog"] button')].find(el=>el.textContent==='Cancel') || cancel();
  await settle(()=>cancelButton.click());expect(a.form().name).toBe('Edited');
  await settle(()=>button(0,'Reset').click());
  const confirm=[...document.querySelectorAll('[role="alertdialog"] button')].find(el=>el.textContent==='Reset') || [...document.querySelectorAll('.bp5-alert button,.bp6-alert button')].find(el=>el.textContent==='Reset');
  await settle(()=>confirm.click());expect(a.form().name).toBe('Default A');expect(a.context.signals.formStatus.peek().dirty).toBe(false);
  await settle(()=>a.window({parentId:33}));expect(a.form().parentId).toBe(33);expect(a.form().name).toBe('');
  await settle(()=>a.window({open:false}));await settle(()=>a.window({open:true}));
  expect(a.requests.length).toBe(3);
  await settle(()=>a.requests[1].resolve([{name:'Stale'}]));expect(a.form().name).toBe('');
  await settle(()=>{a.edit({name:'Retry edit'});a.requests[2].reject(new Error('Unavailable'));});
  expect(host.textContent).toContain('Unavailable');
  await settle(()=>button(0,'Retry').click());
  await settle(()=>a.requests[3].resolve([{name:'Fresh',enabled:false,count:0,nullable:null,currency:''}]));
  expect(a.form()).toMatchObject({name:'Retry edit',enabled:false,count:0,nullable:null,currency:''});
  expect(b.form().name).toBe('Default B');
 } finally {await settle(()=>root.unmount());host.remove()}
});

it('loads a declared source through the mounted native datasource transport and selectors',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),windowId='native-draft-defaults';
 const calls=[];
 const metadata={dataSource:{draft:{id:'draft',autoFetch:false},settings:{id:'settings',autoFetch:false,service:{uri:'mcp://fixture/settings'},selectors:{data:'data'},selectionMode:'single'}},view:{dataSourceRef:'draft',content:{id:'editor',dataSourceRef:'draft',fetchData:false,draftForm:{lifecycle:{defaults:[{name:'parentId',default:7},{name:'enabled',default:false}],source:{dataSourceRef:'settings',parameters:[{name:'id',default:7}],defaults:[{name:'currency',in:'form',location:'settings.currency'},{name:'count',in:'form',location:'settings.count',codec:{name:'int'}}]}}}}}};
 try {
  await settle(()=>root.render(<SettingProvider endpoints={{}} connectorConfig={{window:{service:{uri:'/window'}}}} services={{dataConnectorTransport:async request=>{calls.push(request);return {data:[{id:7,currency:'EUR',count:'0'}]}}}}><WindowContent window={{windowId,windowKey:'neutral-draft'}} selectedMetadata={metadata}/></SettingProvider>));
  const context=getWindowContext(windowId).Context('draft');
  expect(context.handlers.dataSource.getFormData()).toEqual({parentId:7,enabled:false,currency:'EUR',count:0});
  expect(context.signals.formStatus.peek().dirty).toBe(false);
  expect(calls).toHaveLength(1);expect(calls[0].dataSourceRef).toBe('settings');
 }finally{await settle(()=>root.unmount());host.remove();removeSignalsForKey(windowId)}
});
