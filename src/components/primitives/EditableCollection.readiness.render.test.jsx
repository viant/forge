// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect} from 'vitest';
import WindowContent from '../WindowContent.jsx';
import {SettingProvider} from '../../core/context/Setting.jsx';
import {getWindowContext} from '../../core/context/registry.js';
import {removeSignalsForKey} from '../../core/store/signals.js';
import '../../packs/blueprint/index.jsx';
it('an operation reacts to its baseline control without changing selection',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const windowId='collection-scoped-readiness',host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const source=id=>({id,autoFetch:false,service:{uri:'/unused'},selectionMode:'multi',uniqueKey:[{field:'id'}],selectors:{data:'data'}});
 const metadata={dataSource:{rows:source('rows'),baseline:source('baseline')},view:{content:{id:'root',containers:[
  {id:'baseline',dataSourceRef:'baseline',fetchData:false},
  {id:'rows',dataSourceRef:'rows',fetchData:false,editableCollection:{operations:[{id:'remove',label:'Remove selected',requiresSelection:true,disabledWhen:{any:[{source:'control',dataSourceRef:'baseline',field:'loaded',notEquals:true},{source:'control',dataSourceRef:'baseline',field:'loading',equals:true},{source:'control',dataSourceRef:'baseline',field:'error',notEmpty:true}]}}]},table:{columns:[{id:'id',name:'ID'}]}}
 ]}}};
 const settle=async fn=>act(async()=>{fn?.();for(let i=0;i<25;i++)await Promise.resolve()});
 try{
  await settle(()=>root.render(<SettingProvider endpoints={{}} connectorConfig={{window:{service:{uri:'/window'}}}} services={{dataConnectorTransport:async()=>({data:[]})}}><WindowContent window={{windowId,windowKey:'fixture'}} selectedMetadata={metadata}/></SettingProvider>));
  const context=getWindowContext(windowId),rows=context.Context('rows'),baseline=context.Context('baseline');
  const button=()=>[...host.querySelectorAll('button')].find(x=>x.textContent.includes('Remove selected'));
  await settle(()=>{rows.signals.collection.value=[{id:1}];rows.signals.selection.value={selected:{id:1},selection:[{id:1}]};baseline.signals.control.value={loaded:false,loading:true}});
  expect(button().disabled).toBe(true);
  await settle(()=>{baseline.signals.control.value={loaded:true,loading:false,error:null}});
  expect(button().disabled).toBe(false);
  await settle(()=>{baseline.signals.control.value={loaded:true,loading:false,error:'last page failed'}});
  expect(button().disabled).toBe(true);
 }finally{await settle(()=>root.unmount());host.remove();removeSignalsForKey(windowId)}
});
