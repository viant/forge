// @vitest-environment jsdom
import React,{act}from'react';
import{createRoot}from'react-dom/client';
import{expect,it,vi}from'vitest';
import WindowContent from'../../WindowContent.jsx';
import{SettingProvider}from'../../../core/context/Setting.jsx';
import{getWindowContext}from'../../../core/context/registry.js';
import{removeSignalsForKey}from'../../../core/store/signals.js';
import{updateQuickSearch}from'./QuickSearch.jsx';
import'../../../packs/blueprint/index.jsx';

it.each(['server','client'])('search and clear with %s filtering and client pagination retain the fetch decision',async filterMode=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const windowId='search-client-pages-'+filterMode,host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const rows=Array.from({length:31},(_,i)=>({id:i+1,name:`Item-${String(i+1).padStart(2,'0')}`}));
 const requests=[];
 const transport=vi.fn(async request=>{requests.push(request.options);const term=request.options?.inputParameters?.Search||request.options?.filter?.Search;return{data:term?rows.filter(row=>row.name.includes(term)):rows,meta:{cnt:term?1:31,pageCnt:1}}});
 const metadata={dataSource:{rows:{id:'rows',service:{uri:'mcp://fixture/rows'},uniqueKey:[{field:'id'}],selectionMode:'none',selectors:{data:'data',dataInfo:'meta'},filterMode,paginationMode:'client',paging:{enabled:true,size:10},filterSet:[{name:'quick',default:true,template:[{id:'Search',field:'name',label:'Item search',operator:filterMode==='server'?'producer':'contains'}]}]}},view:{content:{id:'items',dataSourceRef:'rows',fetchData:true,table:{selectionEnabled:false,toolbar:{items:[]},columns:[{id:'id',name:'ID'},{id:'name',name:'Name'}]}}}};
 const settle=async fn=>act(async()=>{fn?.();for(let i=0;i<40;i++)await Promise.resolve()});
 const ids=()=>[...host.querySelectorAll('td[data-col="id"]')].map(e=>e.textContent.trim()).filter(Boolean);
 try{
 await settle(()=>root.render(<SettingProvider endpoints={{}} connectorConfig={{window:{service:{uri:'/window'}}}} services={{dataConnectorTransport:transport}}><WindowContent window={{windowId,windowKey:'fixture'}} selectedMetadata={metadata}/></SettingProvider>));
 const context=getWindowContext(windowId).Context('rows');
 expect(transport).toHaveBeenCalledTimes(1);
 await settle(()=>context.handlers.dataSource.setPage(3));expect(ids()).toEqual(rows.slice(20,30).map(row=>String(row.id)));
 await settle(()=>updateQuickSearch(context,'Search','Item-21'));
 expect(context.handlers.dataSource.getPage()).toBe(1);
 expect(ids(),JSON.stringify(requests)).toEqual(['21']);
 expect(transport).toHaveBeenCalledTimes(filterMode==='server'?2:1);
 await settle(()=>updateQuickSearch(context,'Search',''));
 expect(context.handlers.dataSource.getPage()).toBe(1);
 expect(ids()).toEqual(rows.slice(0,10).map(row=>String(row.id)));
 expect(transport).toHaveBeenCalledTimes(filterMode==='server'?3:1);
 await settle();expect(transport).toHaveBeenCalledTimes(filterMode==='server'?3:1);
 }finally{await settle(()=>root.unmount());host.remove();removeSignalsForKey(windowId)}
});
