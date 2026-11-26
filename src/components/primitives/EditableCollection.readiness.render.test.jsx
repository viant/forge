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

it.each([true, false])('opens a prepared parent through an empty grid (warm reader: %s)', async warm => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const windowId = 'parent-dialog-' + warm;
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const reads = [];
  const local = id => ({id, autoFetch:false, backend:{kind:'inline', rows:[]}});
  const parameter = {name:'ParentID', in:'windowForm', location:'parent'};
  const metadata = {
    namespace:'Example', actions:{code:`({seed: ({rows, draftParameters}) => {
      if (draftParameters.available !== true) throw new Error('Capacity exhausted');
      return {name: rows[0].name};
    }})`},
    dataSource:{
      grid:local('grid'), draft:local('draft'), capacity:local('capacity'),
      parent:{id:'parent', autoFetch:false, service:{uri:'mcp://example/parent'}, parameters:[parameter],
        uniqueKey:[{field:'id'}], selectors:{data:'data'}},
    },
    view:{content:{id:'root', containers:[
      {id:'parentReader', dataSourceRef:'parent', fetchData:false},
      {id:'capacityReader',dataSourceRef:'capacity',fetchData:false},
      {id:'documents', dataSourceRef:'grid', fetchData:false, editableCollection:{
        dataSourceRef:'grid', selection:{mode:'multi', min:0}, operations:[{
          id:'create',label:'Create document',dialogId:'editor',parameters:[parameter,
            {name:'available',from:'capacity:collection',location:'0.available',to:'draft:parameters'}],
          prepareSelection:{dataSourceRef:'parent',parentParameter:'ParentID',identityField:'id',prepare:'Example.seed',errorField:'openError'},
        }]},table:{columns:[{id:'id', name:'ID'}]}},
    ]}},
    dialogs:[{id:'editor', title:'Document', dataSourceRef:'draft', fetchOnOpen:false, properties:{searchable:false},
      content:{id:'form',dataSourceRef:'draft',fetchData:false,items:[{id:'name',type:'text',scope:'form',dataField:'name'}]}}],
  };
  const settle = async fn => act(async () => { fn?.(); await new Promise(resolve => setTimeout(resolve, 10)); });
  const transport = async request => {
    if (request.dataSourceRef === 'parent') reads.push(request);
    return {data:[{id:8, name:'Parent eight'}]};
  };
  try {
    await settle(() => root.render(<SettingProvider endpoints={{}} connectorConfig={{window:{service:{uri:'/window'}}}}
      services={{dataConnectorTransport:transport}}><WindowContent window={{windowId,windowKey:'example'}} selectedMetadata={metadata}/></SettingProvider>));
    const context = getWindowContext(windowId);
    await settle(() => context.Context('grid').handlers.dataSource.setWindowFormData({values:{parent:8}}));
    const capacity = context.Context('capacity').handlers.dataSource;
    await settle(() => capacity.setCollection([{available:true}]));
    if (warm) await settle(() => context.Context('parent').handlers.dataSource.fetchCollection({}));
    const before = reads.length;
    const create = [...host.querySelectorAll('button')].find(button => button.textContent.includes('Create document'));
    expect(create).toBeDefined();
    expect(create.disabled).toBe(false);
    await settle(() => create.click());
    expect(context.Context('grid').signals.windowForm.peek().openError).toBe('');
    expect(context.Context('draft').signals.form.peek()?.name).toBe('Parent eight');
    expect([...document.querySelectorAll('[role="dialog"] input')].map(input => input.value)).toContain('Parent eight');
    expect(reads.length - before).toBe(warm ? 0 : 1);
    for (const request of reads) expect(request.inputParameters || {}).not.toHaveProperty('available');
    if (warm) {
      await settle(() => context.handlers.window.closeDialog({dialogId:'editor'}));
      await settle(() => capacity.setCollection([{available:false}]));
      await settle(() => create.click());
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(context.Context('grid').signals.windowForm.peek().openError).toMatch(/Capacity exhausted/);
      expect(reads.length).toBe(before);
    }
  } finally {
    await settle(() => root.unmount());
    host.remove();
    removeSignalsForKey(windowId);
  }
});
