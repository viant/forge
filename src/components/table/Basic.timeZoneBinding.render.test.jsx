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
function fixture(metricsValue){
 const collection=signal([{id:1,at:'2026-01-01T00:00:00Z'}]);
 const header={signals:{metrics:signal(metricsValue)}};
 const fetchCollection=vi.fn();
 const signals={collection,input:signal({fetch:false,page:1}),control:signal({loaded:true,loading:false}),selection:signal({selected:null,rowIndex:-1,selection:[]}),message:signal([]),form:signal({}),formStatus:signal({dirty:false,version:1}),windowForm:signal({}),metrics:signal({})};
 const handlers={dataSource:{fetchCollection,getCollection:()=>collection.peek(),peekCollection:()=>collection.peek(),getCollectionInfo:()=>({}),isInactive:()=>false,getSelection:()=>signals.selection.peek(),isSelected:()=>false,getPage:()=>1,getFilterSets:()=>[],getFilterSet:()=>[],peekFilter:()=>({}),setAllSelection(){},resetSelection(){}}};
 const context={identity:{windowId:'zoned-table',dataSourceRef:'rows'},dataSource:{selectionMode:'none'},signals,handlers,Context:ref=>ref==='header'?header:null,tableSettingKey:()=> 'zoned-table'};
 const columns=[Object.freeze({id:'at',name:'At',visible:true,width:220,format:'dateTime24',timeZoneBinding:Object.freeze({dataSourceRef:'header',scope:'metrics',dataField:'timeZone.ianaTimezoneStr'})})];
 const container={id:'time-grid',table:{selectionEnabled:false,toolbar:{items:[]}}};
 const services={tablePreferences:{get:async()=>null,set:async()=>null,reset:async()=>null}};
 let commits=0;
 const render=()=>act(async()=>root.render(<SettingProvider endpoints={{}} connectorConfig={{}} services={services}><Profiler id="table" onRender={()=>commits++}><Basic context={context} container={container} columns={columns}/></Profiler></SettingProvider>));
 return {header,collection,fetchCollection,render,commits:()=>commits,cell:()=>host.querySelector('td[data-col="at"]')?.textContent};
}
it('formats a bound timezone and reacts only to relevant metadata changes without fetching',async()=>{
 const f=fixture({timeZone:{ianaTimezoneStr:'UTC'},contact:'Original'});await f.render();
 expect(f.cell()).toBe('Jan 1, 2026, 00:00');const before=f.commits();
 await act(async()=>{f.header.signals.metrics.value={timeZone:{ianaTimezoneStr:'UTC'},contact:'Edited'};});
 expect(f.commits()).toBe(before);
 await act(async()=>{f.header.signals.metrics.value={timeZone:{ianaTimezoneStr:'America/New_York'},contact:'Edited'};});
 expect(f.cell()).toBe('Dec 31, 2025, 19:00');
 expect(f.collection.peek()[0].at).toBe('2026-01-01T00:00:00Z');expect(f.fetchCollection).not.toHaveBeenCalled();
});
it('updates an already rendered page when its metadata timezone arrives late',async()=>{
 const f=fixture({});await f.render();
 await act(async()=>{f.header.signals.metrics.value={timeZone:{ianaTimezoneStr:'UTC'}};});
 expect(f.cell()).toBe('Jan 1, 2026, 00:00');expect(f.fetchCollection).not.toHaveBeenCalled();
});
