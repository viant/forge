// @vitest-environment jsdom
import React,{act}from'react';
import{createRoot}from'react-dom/client';
import{expect,it,vi}from'vitest';
import WindowContent from'./WindowContent.jsx';
import{SettingProvider}from'../core/context/Setting.jsx';
import{getWindowContext}from'../core/context/registry.js';
import{removeSignalsForKey}from'../core/store/signals.js';
import'../packs/blueprint/index.jsx';

it.each([{childFetch:false,requests:2},{childFetch:undefined,requests:3}])('loads dialog-owned table with child fetching $childFetch ($requests requests)',async({childFetch,requests})=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const windowId='single-loader-table-'+String(childFetch),host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const transport=vi.fn(async()=>({data:[{id:1,name:'Fixture row'}],meta:{cnt:1,pageCnt:1}}));
 const source=id=>({id,cardinality:'collection',service:{uri:'mcp://fixture/'+id},uniqueKey:[{field:'id'}],selectors:{data:'data',dataInfo:'meta'},selectionMode:'none'});
 const metadata={dataSource:{rows:source('rows'),baseline:source('baseline')},view:{content:{id:'editor',dataSourceRef:'rows',fetchData:true,containers:[
  {id:'baselineLoader',dataSourceRef:'baseline',fetchData:true,className:'forge-container-hidden'},
  {id:'table',dataSourceRef:'rows',fetchData:childFetch,dataStateBoundary:{dataSourceRefs:['rows','baseline']},table:{selectionEnabled:false,toolbar:{items:[]},columns:[{id:'id',name:'ID'},{id:'name',name:'Name'}]}}
 ]}}};
 const content=metadata.view.content;metadata.dataSource.home={id:'home',autoFetch:false,backend:{kind:'inline',rows:[]}};metadata.view={content:{id:'home',dataSourceRef:'home',fetchData:false}};metadata.dialogs=[{id:'editor',title:'Editor',dataSourceRef:'rows',properties:{searchable:false},content}];
 const settle=async fn=>act(async()=>{fn?.();for(let n=0;n<40;n++)await Promise.resolve();await new Promise(resolve=>setTimeout(resolve,0));for(let n=0;n<40;n++)await Promise.resolve()});
 try{
 await settle(()=>root.render(<SettingProvider endpoints={{}} connectorConfig={{window:{service:{uri:'/window'}}}} services={{dataConnectorTransport:transport}}><WindowContent window={{windowId,windowKey:'fixture'}} selectedMetadata={metadata}/></SettingProvider>));
 const context=getWindowContext(windowId);await settle(()=>context.handlers.window.openDialog({execution:{args:['editor',{awaitResult:false}]},parameters:{}}));
 expect(transport).toHaveBeenCalledTimes(requests);
 expect(transport.mock.calls.filter(([request])=>request.dataSourceRef==='baseline')).toHaveLength(1);
 expect(transport.mock.calls.filter(([request])=>request.dataSourceRef==='rows')).toHaveLength(requests-1);
 expect(document.querySelector('[role="dialog"] td[data-col="name"]').textContent).toBe('Fixture row');
 await settle();
 expect(transport).toHaveBeenCalledTimes(requests);
 }finally{await settle(()=>root.unmount());host.remove();removeSignalsForKey(windowId)}
});
