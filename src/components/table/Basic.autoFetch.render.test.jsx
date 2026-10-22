// @vitest-environment jsdom
import React,{act,Profiler} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {signal} from '@preact/signals-react';
import Basic from './Basic.jsx';
import {SettingProvider} from '../../core/context/Setting.jsx';

let host,root;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
function fixture({autoFetch,fetchData,on}={}){
 const collection=signal([]);
 const header={signals:{metrics:signal({})}};
 const fetchCollection=vi.fn();
 const signals={collection,input:signal({fetch:false,page:1}),control:signal({loaded:false,loading:false}),selection:signal({selected:null,rowIndex:-1,selection:[]}),message:signal([]),form:signal({}),formStatus:signal({dirty:false,version:1}),windowForm:signal({}),metrics:signal({})};
 const handlers={dataSource:{fetchCollection,getCollection:()=>collection.peek(),peekCollection:()=>collection.peek(),getCollectionInfo:()=>({}),isInactive:()=>false,getSelection:()=>signals.selection.peek(),isSelected:()=>false,getPage:()=>1,getFilterSets:()=>[],getFilterSet:()=>[],peekFilter:()=>({}),setAllSelection(){},resetSelection(){}}};
 const context={identity:{windowId:'zoned-table',dataSourceRef:'rows'},dataSource:{selectionMode:'none',autoFetch},signals,handlers,lookupHandler:id=>id==='dataSource.fetchCollection'?fetchCollection:()=>{},Context:ref=>ref==='header'?header:null,tableSettingKey:()=> 'zoned-table'};
 const columns=[Object.freeze({id:'at',name:'At',visible:true,width:220,format:'dateTime24',timeZoneBinding:Object.freeze({dataSourceRef:'header',scope:'metrics',dataField:'timeZone.ianaTimezoneStr'})})];
 const container={id:'time-grid',fetchData,table:{selectionEnabled:false,toolbar:{items:[]},on}};
 const services={tablePreferences:{get:async()=>null,set:async()=>null,reset:async()=>null}};
 let commits=0;
 const render=async()=>{
  await act(async()=>root.render(<SettingProvider endpoints={{}} connectorConfig={{}} services={services}><Profiler id="table" onRender={()=>commits++}><Basic context={context} container={container} columns={columns}/></Profiler></SettingProvider>));
  // Initial viewport measurement is scheduled independently of metadata. Settle
  // that frame before attributing a later commit to the bound header update.
  await act(async()=>new Promise(resolve=>requestAnimationFrame(()=>resolve())));
 };
 return {header,collection,fetchCollection,render,commits:()=>commits,cell:()=>host.querySelector('td[data-col="at"]')?.textContent};
}

it.each([{autoFetch:false},{fetchData:false},{autoFetch:false,fetchData:false}])('does not implicitly fetch a disabled empty table: %j',async options=>{const f=fixture(options);await f.render();expect(f.fetchCollection).not.toHaveBeenCalled();});
it('retains default fetching when no owner disables it',async()=>{const f=fixture();await f.render();expect(f.fetchCollection).toHaveBeenCalledTimes(1);});
it('honors an explicit authored initialization handler even when defaults are disabled',async()=>{const f=fixture({autoFetch:false,fetchData:false,on:[{event:'onInit',handler:'dataSource.fetchCollection'}]});await f.render();expect(f.fetchCollection).toHaveBeenCalledTimes(1);});
