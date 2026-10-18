// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import WindowContent from './WindowContent.jsx';
import {SettingProvider} from '../core/context/Setting.jsx';
import {getWindowContext} from '../core/context/registry.js';
import {removeSignalsForKey} from '../core/store/signals.js';
import '../packs/blueprint/index.jsx';

for(const failLast of [false,true])it(`offset aggregation publishes only complete results (failure=${failLast})`,async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const windowId=`aggregate-offset-${failLast}`,host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const rows=Array.from({length:61},(_,i)=>({id:i+1})),requests=[];let complete;
 const transport=async request=>{
  const args=request.options.inputParameters;requests.push(args);
  if(args.Offset===50)return new Promise((resolve,reject)=>{complete=()=>failLast?reject(Error('last page failed')):resolve({data:rows.slice(50)})});
  return {data:rows.slice(args.Offset,args.Offset+args.Limit)};
 };
 const metadata={dataSource:{baseline:{id:'baseline',service:{uri:'mcp://fixture/baseline'},autoFetch:false,selectionMode:'none',uniqueKey:[{field:'id'}],selectors:{data:'data'},paginationMode:'server',paging:{enabled:true,mode:'offset',size:25,aggregate:true,maxPages:4,parameters:{page:'Offset',size:'Limit'}}}},view:{content:{id:'root',dataSourceRef:'baseline',fetchData:false}}};
 const settle=async action=>act(async()=>{action?.();for(let i=0;i<40;i++)await Promise.resolve()});
 try{
  await settle(()=>root.render(<SettingProvider endpoints={{}} connectorConfig={{window:{service:{uri:'/window'}}}} services={{dataConnectorTransport:transport}}><WindowContent window={{windowId,windowKey:'fixture'}} selectedMetadata={metadata}/></SettingProvider>));
  const context=getWindowContext(windowId).Context('baseline');
  await settle(()=>context.handlers.dataSource.fetchCollection());
  expect(requests).toEqual([{Offset:0,Limit:25},{Offset:25,Limit:25},{Offset:50,Limit:25}]);
  expect(context.signals.collection.peek()).toEqual([]);
  expect(context.signals.control.peek().loading).toBe(true);
  await settle(()=>complete());
  expect(context.signals.collection.peek()).toEqual(failLast?[]:rows);
  expect(context.signals.control.peek().loading).toBe(false);
  if(failLast)expect(context.signals.control.peek().error).toBeTruthy();
  else expect(context.signals.control.peek().loaded).toBe(true);
 }finally{await settle(()=>root.unmount());host.remove();removeSignalsForKey(windowId)}
});
