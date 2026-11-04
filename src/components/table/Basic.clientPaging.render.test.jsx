// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {signal} from '@preact/signals-react';
import Basic from './Basic.jsx';
import {SettingProvider} from '../../core/context/Setting.jsx';
import WindowContent from '../WindowContent.jsx';
import {removeSignalsForKey} from '../../core/store/signals.js';
import '../../packs/blueprint/index.jsx';

it('advances all 31 NAME-ascending Item rows across four local pages',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 globalThis.ResizeObserver=class {observe(){} unobserve(){} disconnect(){}};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const rows=Array.from({length:31},(_,i)=>({id:i+1,name:`fixture-Item-${String(i+1).padStart(2,'0')}`}));
 const signals={collection:signal(rows),input:signal({fetch:false,page:1,sort:[{columnId:'name',direction:'asc'}]}),control:signal({loaded:true,loading:false}),selection:signal({selected:null,rowIndex:-1,selection:[]}),message:signal([]),form:signal({}),formStatus:signal({dirty:false,version:1}),windowForm:signal({}),metrics:signal({})};
 const fetchCollection=vi.fn();
 const handlers={dataSource:{fetchCollection,getCollection:()=>signals.collection.value,peekCollection:()=>signals.collection.peek(),getCollectionInfo:()=>({pageCount:1,totalCount:31}),isInactive:()=>false,getSelection:()=>signals.selection.peek(),isSelected:()=>false,getPage:()=>signals.input.value.page,setPage:page=>{signals.input.value={...signals.input.peek(),page,fetch:false}},getFilterSets:()=>[],getFilterSet:()=>[],peekFilter:()=>({}),setAllSelection(){},resetSelection(){},getUniqueKeyValue:row=>row.id},window:{openTarget(){}}};
 const context={identity:{windowId:'item-paging',dataSourceRef:'rows'},signals,handlers,dataSource:{selectionMode:'none',autoFetch:false,sortMode:'server',filterMode:'server',paginationMode:'client',paging:{enabled:true,size:10},backend:{kind:'mcp_tool'}},tableSettingKey:()=> 'item-paging'};
 const columns=[{id:'id',name:'Item ID',visible:true,width:100},{id:'name',name:'Item Name',visible:true,width:330,type:'link',link:{kind:'window',windowKey:'item',chipName:'Item',chipIcon:'application',identityParameters:['ItemId'],windowTitleTemplate:'{{name}} ({{id}})',windowTitleSource:'row',parameters:{ItemId:{source:'row',field:'id'}}}}];
 const container={id:'catalogItems',fetchData:false,table:{selectionEnabled:false,minRows:10,defaultSort:{columnId:'name',direction:'asc'},toolbar:{items:[]},pagination:{pageSize:10,pageSizeOptions:[10]}}};
 const services={tablePreferences:{get:async()=>null,set:async()=>null,reset:async()=>null}};
 try {
 await act(async()=>root.render(<SettingProvider endpoints={{}} connectorConfig={{}} services={services}><Basic context={context} container={container} columns={columns}/></SettingProvider>));
 for(let page=1;page<=4;page++){
  expect(host.querySelector('.forge-pagination-announcement').textContent).toContain(`Page ${page} of 4`);
  expect([...host.querySelectorAll('td[data-col="id"]')].map(e=>e.textContent.trim()).filter(Boolean)).toEqual(rows.slice((page-1)*10,page*10).map(r=>String(r.id)));
  expect([...host.querySelectorAll('td[data-col="name"] button')].map(e=>e.textContent.trim())).toEqual(rows.slice((page-1)*10,page*10).map(r=>r.name));
  if(page<4)await act(async()=>host.querySelector('button[aria-label="Next Page"]').click());
 }
 expect(fetchCollection).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('keeps public pages and Item row identities aligned with native datasource handlers',async()=>{
 const rows=Array.from({length:31},(_,i)=>({id:i+1,name:`fixture-Item-${String(i+1).padStart(2,'0')}`}));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const windowId='native-client-paging';
 const transport=vi.fn(async()=>({data:rows,meta:{cnt:31,pageCnt:1}}));
 const columns=[{id:'id',name:'Item ID',width:100,sortable:true},{id:'name',name:'Item Name',width:330,sortable:true,type:'link',link:{kind:'window',windowKey:'item',identityParameters:['ItemId'],windowTitleTemplate:'{{name}} ({{id}})',windowTitleSource:'row',parameters:{ItemId:{source:'row',selector:'id',wrap:'array'}},windowTitle:'Item'}}];
 const metadata={dataSource:{rows:{id:'rows',cardinality:'collection',service:{uri:'mcp://fixture/rows'},selectionMode:'none',uniqueKey:[{field:'id'}],selectors:{data:'data',dataInfo:'meta'},sortMode:'server',filterMode:'server',paginationMode:'client',paging:{enabled:true,size:10}}},view:{content:{id:'catalogItems',dataSourceRef:'rows',fetchData:true,table:{minRows:10,selectionEnabled:false,defaultSort:{columnId:'name',direction:'asc'},pagination:{pageSize:10,pageSizeOptions:[10]},toolbar:{items:[]},columns}}}};
 const settle=async fn=>act(async()=>{fn?.();for(let n=0;n<40;n++)await Promise.resolve()});
 try{
 await settle(()=>root.render(<SettingProvider endpoints={{}} connectorConfig={{window:{service:{uri:'/window'}}}} services={{dataConnectorTransport:transport}}><WindowContent window={{windowId,windowKey:'fixture'}} selectedMetadata={metadata}/></SettingProvider>));
 for(let page=1;page<=4;page++){
  expect(host.querySelector('.forge-pagination-announcement').textContent).toContain(`Page ${page} of 4`);
  expect([...host.querySelectorAll('td[data-col="id"]')].map(e=>e.textContent.trim()).filter(Boolean)).toEqual(rows.slice((page-1)*10,page*10).map(r=>String(r.id)));
  expect([...host.querySelectorAll('td[data-col="name"] button')].map(e=>e.textContent.trim())).toEqual(rows.slice((page-1)*10,page*10).map(r=>r.name));
  if(page<4)await settle(()=>host.querySelector('button[aria-label="Next Page"]').click());
 }
 expect(transport).toHaveBeenCalledTimes(1);
 }finally{await settle(()=>root.unmount());host.remove();removeSignalsForKey(windowId);}
});
