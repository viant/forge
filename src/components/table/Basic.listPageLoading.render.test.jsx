// @vitest-environment jsdom
// Independently authored records and transport; exercises native paging/signals.
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import WindowContent from '../WindowContent.jsx';
import {SettingProvider} from '../../core/context/Setting.jsx';
import {ForgeThemeProvider} from '../ThemeBoundary.jsx';
import {getWindowContext} from '../../core/context/registry.js';
import {removeSignalsForKey} from '../../core/store/signals.js';
import '../../packs/blueprint/index.jsx';

const settle = async fn => act(async () => {fn?.(); for (let i=0;i<60;i++) await Promise.resolve();});
const data = Array.from({length:25}, (_,index)=>({id:index+1,name:`Record ${index+1}`}));

async function fixture(mode='page',theme='design-system-2') {
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 globalThis.ResizeObserver=class {observe(){} unobserve(){} disconnect(){}};
 const windowId=`list-loading-${mode}-${theme}`,host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const pending=[];
 const transport=vi.fn(request=>new Promise((resolve,reject)=>pending.push({request,resolve,reject})));
 const metadata={dataSource:{rows:{id:'rows',service:{uri:'mcp://fixture/records'},autoFetch:false,selectionMode:'multi',uniqueKey:[{field:'id'}],selectors:{data:'data',dataInfo:'info'},filterMode:'server',paginationMode:'server',paging:{enabled:true,mode,size:10,parameters:{page:mode==='offset'?'Offset':'Page',size:'Limit'},...(mode==='cursor'?{parameters:{page:'Cursor',size:'Limit'},dataInfoSelectors:{nextCursor:'nextCursor',hasMore:'hasMore'}}:{})}}},view:{content:{id:'records',title:'Records',dataSourceRef:'rows',fetchData:false,table:{presentation:'list-page',columns:[{id:'id',name:'ID',width:100},{id:'name',name:'Name',width:260}],toolbar:{items:[{id:'search',type:'quickSearch',appearance:'field',properties:{field:'name',label:'Search records'}}]}}}}};
 const render=nextTheme=>root.render(<SettingProvider endpoints={{}} connectorConfig={{window:{service:{uri:'/window'}}}} services={{dataConnectorTransport:transport,tablePreferences:{get:async()=>null}}}><ForgeThemeProvider themeId={nextTheme}><WindowContent window={{windowId,windowKey:'fixture'}} selectedMetadata={metadata}/></ForgeThemeProvider></SettingProvider>);
 await settle(()=>render(theme));
 const context=getWindowContext(windowId).Context('rows');
 const complete=async(records,info={})=>{const task=pending.shift();expect(task).toBeTruthy();await settle(()=>task.resolve({data:records,info}));return task.request;};
 const cleanup=async()=>{await settle(()=>root.unmount());host.remove();removeSignalsForKey(windowId);};
 return {host,context,transport,pending,complete,render,cleanup};
}

it.each(['page','offset','cursor'])('appends %s pages through the existing datasource and stops at the native last page',async mode=>{
 const f=await fixture(mode);
 try {
  await settle(()=>f.context.handlers.dataSource.fetchCollection());
  expect(f.host.querySelectorAll('.table-skeleton-row').length).toBeGreaterThan(0);
  expect(f.host.querySelector('.table-refresh-indicator')).toBeNull();
  await f.complete(data.slice(0,10),mode==='cursor'?{nextCursor:'second',hasMore:true}:{});
  const scroll=f.host.querySelector('.basic-table-scroll');
  Object.defineProperties(scroll,{clientHeight:{configurable:true,value:200},scrollHeight:{configurable:true,get:()=>f.context.signals.collection.peek().length*56+48},clientWidth:{configurable:true,value:800},getClientRects:{configurable:true,value:()=>[{}]}});
  await settle(()=>scroll.dispatchEvent(new Event('scroll')));
  await settle(()=>{scroll.scrollTop=480;scroll.dispatchEvent(new Event('scroll'));});
  await settle(()=>scroll.dispatchEvent(new Event('scroll')));
  expect(f.pending).toHaveLength(1);
  expect(f.context.signals.control.peek().appending).toBe(true);
  expect(f.host.querySelectorAll('td[data-col="id"]')).toHaveLength(10);
  expect(f.host.querySelectorAll('.table-skeleton-row')).toHaveLength(3);
  const second=await f.complete(data.slice(10,20),mode==='cursor'?{nextCursor:'third',hasMore:true}:{});
  expect(second.options.inputParameters).toMatchObject(mode==='offset'?{Offset:10,Limit:10}:mode==='page'?{Page:2,Limit:10}:{Cursor:'second',Limit:10});
  expect(f.context.signals.collection.peek()).toEqual(data.slice(0,20));
  expect(scroll.scrollTop).toBe(480);
  await settle(()=>{scroll.scrollTop=1100;scroll.dispatchEvent(new Event('scroll'));});
  await f.complete(data.slice(20),mode==='cursor'?{hasMore:false}:{});
  expect(f.context.signals.collection.peek()).toEqual(data);
  expect(f.host.querySelector('.forge-list-page__summary').textContent).toContain('25 Records');
  expect(f.host.querySelector('[aria-label="Next Page"]')).toBeNull();
  await settle(()=>{scroll.scrollTop=1800;scroll.dispatchEvent(new Event('scroll'));});
  expect(f.pending).toHaveLength(0);
  await settle(()=>f.render('baseline'));
  expect(f.pending).toHaveLength(1);
  await f.complete(data.slice(0,10),mode==='cursor'?{nextCursor:'second',hasMore:true}:{});
  expect(f.host.querySelector('.forge-list-page')).toBeNull();
  expect(f.host.querySelector('[aria-label="Next Page"]')).not.toBeNull();
 } finally {await f.cleanup();}
});

it('replaces stale rows with skeletons for search, keeps the field mounted, and preserves legacy loading',async()=>{
 const f=await fixture();
 try {
  await settle(()=>f.context.handlers.dataSource.fetchCollection());await f.complete(data.slice(0,10));
  const search=f.host.querySelector('input[type="search"]');
  search.focus();
  await settle(()=>f.context.handlers.dataSource.setFilter({filter:{name:'Record 25'}}));
  expect(f.host.querySelector('input[type="search"]')).toBe(search);
  expect(document.activeElement).toBe(search);
  expect(f.host.querySelectorAll('td[data-col="id"]')).toHaveLength(0);
  expect(f.host.querySelectorAll('.table-skeleton-row').length).toBeGreaterThan(0);
  expect(f.host.querySelector('.table-refresh-indicator')).toBeNull();
  await f.complete(data.slice(24));
  expect(f.host.querySelectorAll('.table-skeleton-row')).toHaveLength(0);
  expect(f.host.querySelectorAll('td[data-col="id"]')).toHaveLength(1);
  await settle(()=>f.render('baseline'));
  await settle(()=>f.context.handlers.dataSource.setFilter({filter:{name:'another'}}));
  expect(f.host.querySelector('.table-refresh-indicator')).not.toBeNull();
  expect(f.host.querySelector('.table-skeleton-row')).toBeNull();
  await f.complete([]);
 } finally {await f.cleanup();}
});

it('retains rows after a failed append, retries that page and replaces the collection on a new query',async()=>{
 const f=await fixture();
 try {
  await settle(()=>f.context.handlers.dataSource.fetchCollection());await f.complete(data.slice(0,10));
  await settle(()=>f.context.handlers.dataSource.setPage(2,{append:true}));
  await settle(()=>f.pending.shift().reject(Error('Temporary fixture failure')));
  expect(f.context.signals.collection.peek()).toEqual(data.slice(0,10));
  expect(f.host.querySelectorAll('td[data-col="id"]')).toHaveLength(10);
  const retry=[...f.host.querySelectorAll('button')].find(button=>button.textContent==='Retry loading rows');
  expect(retry).toBeTruthy();
  await settle(()=>retry.click());await f.complete(data.slice(10,20));
  expect(f.context.signals.collection.peek()).toEqual(data.slice(0,20));
  await settle(()=>f.context.handlers.dataSource.setPage(3,{append:true}));
  await settle(()=>f.context.handlers.dataSource.setFilter({filter:{name:'changed'}}));
  await f.complete(data.slice(20));
  expect(f.context.signals.collection.peek()).toEqual(data.slice(0,20));
  expect(f.pending).toHaveLength(1);
  const request=await f.complete([{id:100,name:'Changed query'}]);
  expect(request.options.inputParameters).toMatchObject({Page:1,Limit:10});
  expect(f.context.signals.collection.peek()).toEqual([{id:100,name:'Changed query'}]);
 } finally {await f.cleanup();}
});
