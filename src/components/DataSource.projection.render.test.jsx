import React,{act}from'react';import{createRoot}from'react-dom/client';import{expect,it,vi}from'vitest';
import WindowContent from'./WindowContent.jsx';import{SettingProvider}from'../core/context/Setting.jsx';import{getWindowContext}from'../core/context/registry.js';import{removeSignalsForKey}from'../core/store/signals.js';import'../packs/blueprint/index.jsx';
let index=0;
async function mount({nativeEnvelope=false}={}){
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const windowId='projected-record-'+(++index),host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 let row={id:7,name:'Original',channels:['DISPLAY'],rate:1,acl:[{id:11,role:'OWNER'}]};
 const success=vi.fn();const transport=vi.fn(async()=>nativeEnvelope?{rows:[row],metrics:row,dataInfo:{}}:{data:[row]});
 const metadata={dataSource:{record:{id:'record',service:{uri:'mcp://fixture/record'},uniqueKey:[{field:'id'}],selectors:{data:nativeEnvelope?'rows':'data',metrics:nativeEnvelope?'metrics':'data.0'},selectionMode:'single'},properties:{id:'properties',dataSourceRef:'record',uniqueKey:[{field:'id'}],selectors:{metrics:'.'},selectionMode:'single'},defaults:{id:'defaults',dataSourceRef:'record',resourceModelRef:'defaultsRecord',uniqueKey:[{field:'id'}],selectors:{metrics:'.'},selectionMode:'single',on:[{event:'onSuccess',handler:'test.success'}]},permissions:{id:'permissions',dataSourceRef:'record',uniqueKey:[{field:'id'}],selectors:{data:'acl'},autoSelect:false}},schemas:{defaultsRecord:{type:'object',required:['id'],properties:{id:{type:'integer'},channels:{type:'array',items:{type:'string'}}}}},resourceModels:{defaultsRecord:{schemaRef:'defaultsRecord',fields:{id:{read:'id'},channels:{read:'channels'}}}},view:{dataSourceRef:'properties',content:{id:'root',containers:['properties','defaults','permissions'].map(id=>({id:id+'Panel',dataSourceRef:id,fetchData:true}))}}};
 const settle=async fn=>act(async()=>{fn?.();for(let n=0;n<40;n++)await Promise.resolve();});
 await settle(()=>root.render(<SettingProvider endpoints={{}} connectorConfig={{window:{service:{uri:'/window'}}}} services={{dataConnectorTransport:transport,test:{success}}}><WindowContent window={{windowId,windowKey:'fixture'}} selectedMetadata={metadata}/></SettingProvider>));
 const context=getWindowContext(windowId);
 return{context,transport,success,setRow:value=>{row=value;},settle,close:async()=>{await settle(()=>root.unmount());host.remove();removeSignalsForKey(windowId);}};
}
it('serves three local views from one reader and keeps nested values isolated',async()=>{
 const v=await mount();try{
  expect(v.transport).toHaveBeenCalledTimes(1);
  for(const id of ['properties','defaults','permissions']) expect(v.context.Context(id).signals.control.peek()).toMatchObject({loaded:true,loading:false,stale:false,error:null});
  expect(v.context.Context('defaults').signals.collection.peek()).toEqual([{id:7,channels:['DISPLAY']}]);
  expect(v.context.Context('permissions').signals.collection.peek()).toEqual([{id:11,role:'OWNER'}]);
  expect(v.context.Context('permissions').signals.selection.peek().selected).toBeNull();
  const draft=v.context.Context('defaults');await v.settle(()=>draft.handlers.dataSource.setEditedFormData({values:{id:7,channels:['VIDEO']}}));
  expect(v.context.Context('record').signals.selection.peek().selected.channels).toEqual(['DISPLAY']);
  expect(v.context.Context('properties').signals.form.peek().channels).toEqual(['DISPLAY']);
 }finally{await v.close();}
});
it('one forced read refreshes clean views and retains an unrelated dirty draft',async()=>{
 const v=await mount();try{
  const defaults=v.context.Context('defaults');await v.settle(()=>defaults.handlers.dataSource.setEditedFormData({values:{id:7,channels:['VIDEO']}}));
  v.setRow({id:7,name:'Updated',channels:['DISPLAY'],rate:2,acl:[{id:11,role:'OWNER'}]});
  await v.settle(()=>v.context.Context('properties').handlers.dataSource.fetchCollection({cache:{bypassCache:true}}));
  expect(v.transport).toHaveBeenCalledTimes(2);
  expect(v.context.Context('properties').signals.form.peek().name).toBe('Updated');
  expect(defaults.signals.form.peek().channels).toEqual(['VIDEO']);expect(defaults.signals.formStatus.peek().dirty).toBe(true);
  expect(v.success).toHaveBeenCalledTimes(1);
 }finally{await v.close();}
});
it('a new record clears old drafts and a parent error clears dependent data',async()=>{
 const v=await mount();try{
  const defaults=v.context.Context('defaults');await v.settle(()=>defaults.handlers.dataSource.setEditedFormData({values:{id:7,channels:['VIDEO']}}));
  v.setRow({id:8,name:'Next',channels:['AUDIO'],acl:[]});await v.settle(()=>v.context.Context('record').handlers.dataSource.fetchCollection({cache:{bypassCache:true}}));
  expect(defaults.signals.form.peek()).toEqual({id:8,channels:['AUDIO']});expect(defaults.signals.formStatus.peek().dirty).toBe(false);
  v.transport.mockRejectedValueOnce(Object.assign(new Error('Read denied'),{status:403,code:'datasource_denied',scope:'dataset'}));
  await v.settle(()=>v.context.Context('record').handlers.dataSource.fetchCollection({cache:{bypassCache:true}}));
  expect(defaults.signals.control.peek().error?.message).toContain('Read denied');expect(defaults.signals.collection.peek()).toEqual([]);expect(defaults.signals.form.peek()).toEqual({});
 }finally{await v.close();}
});

it('retains a dirty projection against a changed parent baseline and settles explicit reads',async()=>{
 const v=await mount();try{
  const defaults=v.context.Context('defaults');await v.settle(()=>defaults.handlers.dataSource.setEditedFormData({values:{id:7,channels:['VIDEO']}}));
  v.setRow({id:7,name:'Original',channels:['AUDIO'],acl:[]});let completed;
  await v.settle(()=>{completed=defaults.handlers.dataSource.fetchCollection({cache:{bypassCache:true},invocationId:'projection-refresh'});});
  await expect(completed).resolves.toBeDefined();
  expect(v.transport).toHaveBeenCalledTimes(2);expect(defaults.signals.collection.peek()).toEqual([{id:7,channels:['AUDIO']}]);
  expect(defaults.signals.form.peek()).toEqual({id:7,channels:['VIDEO']});expect(defaults.signals.formStatus.peek().dirty).toBe(true);
  await v.settle(()=>defaults.handlers.dataSource.setEditedFormData({values:{...defaults.signals.collection.peek()[0]}}));
  expect(defaults.signals.formStatus.peek().dirty).toBe(false);
  let projected;await v.settle(()=>{projected=defaults.handlers.dataSource.fetchCollection({invocationId:'cached-projection'});});
  await expect(projected).resolves.toBeDefined();expect(v.transport).toHaveBeenCalledTimes(2);
 }finally{await v.close();}
});
it('waits for the parent request and never calls a projection transport',async()=>{
 const v=await mount();try{
  let finish;v.transport.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const defaults=v.context.Context('defaults');let completed;
  await v.settle(()=>{completed=defaults.handlers.dataSource.fetchCollection({cache:{bypassCache:true},invocationId:'delayed-projection'});});
  expect(defaults.signals.control.peek().loading).toBe(true);expect(v.transport).toHaveBeenCalledTimes(2);
  await v.settle(()=>finish({data:[{id:7,name:'Original',channels:['CTV'],acl:[]}]}));
  await expect(completed).resolves.toBeDefined();expect(defaults.signals.control.peek().loading).toBe(false);
  expect(defaults.signals.form.peek().channels).toEqual(['CTV']);expect(v.transport.mock.calls.every(([request])=>request.dataSourceRef==='record')).toBe(true);
 }finally{await v.close();}
});

it('clears a stale projection only after its parent read succeeds',async()=>{
 const v=await mount();try{
  const defaults=v.context.Context('defaults');
  await v.settle(()=>{defaults.signals.control.value={...defaults.signals.control.peek(),stale:true};});
  let finish;v.transport.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  let completed;await v.settle(()=>{completed=defaults.handlers.dataSource.fetchCollection({cache:{bypassCache:true},invocationId:'stale-projection'});});
  expect(defaults.signals.control.peek().loading).toBe(true);
  expect(defaults.signals.control.peek().stale).toBe(true);
  await v.settle(()=>finish({data:[{id:7,name:'Refreshed',channels:['CTV'],acl:[]}]}));
  await expect(completed).resolves.toBeDefined();
  expect(defaults.signals.control.peek()).toMatchObject({loaded:true,loading:false,stale:false,error:null});
  expect(defaults.signals.form.peek().channels).toEqual(['CTV']);
  expect(v.transport).toHaveBeenCalledTimes(2);
 }finally{await v.close();}
});

it('keeps explicit child selection for the same parent and clears it on parent identity changes',async()=>{
 const v=await mount();try{
  const permissions=v.context.Context('permissions');await v.settle(()=>permissions.handlers.dataSource.setSelected({selected:permissions.signals.collection.peek()[0],rowIndex:0}));
  v.setRow({id:7,name:'Updated',channels:['DISPLAY'],acl:[{id:11,role:'OWNER'}]});await v.settle(()=>v.context.Context('record').handlers.dataSource.fetchCollection({cache:{bypassCache:true}}));
  expect(permissions.signals.selection.peek().selected?.id).toBe(11);
  v.setRow({id:8,name:'Next',channels:['AUDIO'],acl:[{id:11,role:'OWNER'}]});await v.settle(()=>v.context.Context('record').handlers.dataSource.fetchCollection({cache:{bypassCache:true}}));
  expect(permissions.signals.selection.peek().selected).toBeNull();
 }finally{await v.close();}
});

it('reads local row selectors from a parent fetched through the normalized native HTTP envelope',async()=>{
 const v=await mount({nativeEnvelope:true});try{
  expect(v.transport).toHaveBeenCalledTimes(1);
  expect(v.context.Context('properties').signals.form.peek()).toMatchObject({id:7,name:'Original'});
  expect(v.context.Context('properties').signals.metrics.peek()).toMatchObject({id:7,name:'Original'});
  expect(v.context.Context('defaults').signals.form.peek()).toEqual({id:7,channels:['DISPLAY']});
  expect(v.context.Context('permissions').signals.collection.peek()).toEqual([{id:11,role:'OWNER'}]);
 }finally{await v.close();}
});
