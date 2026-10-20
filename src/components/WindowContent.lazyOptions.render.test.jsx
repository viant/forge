// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import WindowContent,{resolveRequiredDataSourceRefs} from './WindowContent.jsx';
import {SettingProvider} from '../core/context/Setting.jsx';
import {removeSignalsForKey} from '../core/store/signals.js';
import {getWindowContext} from '../core/context/registry.js';
import '../packs/blueprint/index.jsx';
let root,host,windowId,serial=0;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;windowId='lazy-options-mounted-'+(++serial);host=document.createElement('div');document.body.append(host);root=createRoot(host);HTMLElement.prototype.scrollIntoView ||= function(){};});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();removeSignalsForKey(windowId);});
const pick={id:'pick',type:'select',label:'Category',scope:'form',dataField:'category',optionsDataSourceRef:'choices',optionsFetchMode:'onFocus',optionValueField:'caption',optionLabelField:'caption'};
it('mounts a report builder campaign-choice datasource without fetching it on open',()=>{
 const def=metadata();def.view.content={id:'builder',kind:'dashboard.reportBuilder',dashboard:{reportBuilder:{campaignChoicesDataSourceRef:'choices'}},dataSourceRef:'record'};
 expect(resolveRequiredDataSourceRefs(def,'record')).toContain('choices');
});
function metadata(){return {dataSource:{record:{id:'record',service:{uri:'mcp://fixture/record'},selectionMode:'single'},choices:{id:'choices',service:{uri:'mcp://fixture/choices'},selectionMode:'none'}},view:{content:{id:'root',dataSourceRef:'record',items:[pick]}}};}
async function mount(def){const requests=[];const transport=vi.fn(async request=>{requests.push(request.dataSourceRef);if(request.dataSourceRef==='record')return {data:[{id:1,category:'Existing caption'}]};if(request.dataSourceRef==='choices')return {data:[{caption:'Existing caption'},{caption:'Another caption'}]};throw new Error('Unexpected startup metadata request');});await act(async()=>{root.render(<SettingProvider endpoints={{}} connectorConfig={{window:{service:{uri:"/window"}}}} services={{dataConnectorTransport:transport}}><WindowContent window={{windowId,windowKey:'mcp://fixture/lazy'}} selectedMetadata={def}/></SettingProvider>);for(let i=0;i<15;i++)await Promise.resolve();});return {requests,transport};}
async function settle(action){await act(async()=>{action?.();for(let i=0;i<15;i++)await Promise.resolve();});}
it('mounted window initializes lazy handlers without a choices RPC; real select focus fetches once',async()=>{
 const def=metadata(),before=JSON.stringify(def);const {requests}=await mount(def);expect(requests.filter(x=>x==='record')).toHaveLength(1);expect(requests.filter(x=>x==='choices')).toHaveLength(0);
 const button=host.querySelector('button[aria-label="Category"]');expect(button.textContent).toContain('Existing caption');await settle(()=>button.focus());expect(requests.filter(x=>x==='choices')).toHaveLength(1);await settle(()=>{button.blur();button.focus();button.click();});expect(requests.filter(x=>x==='choices')).toHaveLength(1);expect(JSON.stringify(def)).toBe(before);
});
it('shared eager consumer still loads exactly once with lazy consumer present',async()=>{
 const def=metadata();def.view.content.items.push({...pick,id:'eager',label:'Eager category',optionsFetchMode:undefined});const {requests}=await mount(def);expect(requests.filter(x=>x==='choices')).toHaveLength(1);await settle(()=>host.querySelector('button[aria-label="Category"]').focus());expect(requests.filter(x=>x==='choices')).toHaveLength(1);
});
it('inactive tab does not load choices; selecting lazy tab mounts handlers but waits for focus',async()=>{
 const def=metadata();def.view.content={id:'root',dataSourceRef:'record',containers:[{id:'sections',tabs:{renderActiveTabPanelOnly:true,defaultSelectedTabId:'empty'},containers:[{id:'empty',title:'Empty',items:[{id:'notice',type:'label',value:'No options here'}]},{id:'pick-tab',title:'Pick',items:[pick]}]}]};const {requests}=await mount(def);expect(requests.filter(x=>x==='choices')).toHaveLength(0);
 const tab=Array.from(host.querySelectorAll('[role="tab"]')).find(e=>e.textContent==='Pick');expect(tab).toBeTruthy();await settle(()=>tab.click());expect(requests.filter(x=>x==='choices')).toHaveLength(0);const button=host.querySelector('button[aria-label="Category"]');expect(button).toBeTruthy();await settle(()=>button.focus());expect(requests.filter(x=>x==='choices')).toHaveLength(1);
});

function manualDefinition(){const def=metadata();def.view.content.items=[];def.view.content.containers=[{id:'manual-binding',className:'forge-container-hidden',dataSourceRef:'choices',fetchData:false}];return def;}
it('fetchData:false hidden binding mounts manual handlers with zero startup RPC and immutable metadata',async()=>{
 const def=manualDefinition(),before=JSON.stringify(def);const {requests}=await mount(def);
 expect(requests.filter(x=>x==='choices')).toHaveLength(0);const context=getWindowContext(windowId).Context('choices');expect(typeof context.handlers.dataSource.fetchCollection).toBe('function');
 await settle(()=>context.handlers.dataSource.fetchCollection());expect(requests.filter(x=>x==='choices')).toHaveLength(1);expect(JSON.stringify(def)).toBe(before);
});
it('active visible fetchData:true sharing a deferred binding remains eager exactly once in either order',async()=>{
 const def=manualDefinition();def.view.content.containers.unshift({id:'visible',dataSourceRef:'choices',fetchData:true,items:[{id:'caption',type:'label',scope:'form',dataField:'caption'}]});const before=JSON.stringify(def);const {requests}=await mount(def);
 expect(requests.filter(x=>x==='choices')).toHaveLength(1);expect(JSON.stringify(def)).toBe(before);
});
it('inactive eager tab does not override the active fetchData:false binding; explicit fetch stays supported',async()=>{
 const def=manualDefinition();const manual=def.view.content.containers[0];def.view.content.containers=[{id:'sections',tabs:{renderActiveTabPanelOnly:true,defaultSelectedTabId:'manual'},containers:[{id:'manual',title:'Manual',containers:[manual]},{id:'other',title:'Other',dataSourceRef:'choices',fetchData:true}]}];
 const {requests}=await mount(def);expect(requests.filter(x=>x==='choices')).toHaveLength(0);const context=getWindowContext(windowId).Context('choices');await settle(()=>context.handlers.dataSource.fetchCollection());expect(requests.filter(x=>x==='choices')).toHaveLength(1);
});
it('advertiser-like hidden binding defers sibling-tab data until activation, then visited-once reuses it',async()=>{
 const def=manualDefinition();def.view.content.containers.push({id:'sections',tabs:{renderActiveTabPanelOnly:true,defaultSelectedTabId:'properties',keepVisitedTabPanelsMounted:true,dataSourceFetchMode:'once'},containers:[{id:'properties',title:'Properties',dataSourceRef:'record',fetchData:true},{id:'related',title:'Related',dataSourceRef:'choices',fetchData:true,items:[{id:'caption',type:'label',scope:'form',dataField:'caption'}]}]});const before=JSON.stringify(def);const {requests}=await mount(def);
 expect(requests.filter(x=>x==='record')).toHaveLength(1);expect(requests.filter(x=>x==='choices')).toHaveLength(0);
 const tab=name=>Array.from(host.querySelectorAll('[role="tab"]')).find(e=>e.textContent===name);await settle(()=>tab('Related').click());expect(requests.filter(x=>x==='choices')).toHaveLength(1);
 await settle(()=>tab('Properties').click());await settle(()=>tab('Related').click());expect(requests.filter(x=>x==='choices')).toHaveLength(1);expect(JSON.stringify(def)).toBe(before);
});
it('omits a missing datasource region while the healthy root and sibling controls remain usable',async()=>{
 const def=metadata();def.view.content.containers=[
  {id:'missing-history',dataSourceRef:'missingHistory',fetchData:true,items:[{id:'history',type:'label',value:'Missing history'}]},
  {id:'healthy-sibling',dataSourceRef:'record',items:[{id:'healthy-label',type:'label',value:'Healthy sibling'}]},
 ];
 const errors=[];const original=console.error;console.error=(...args)=>errors.push(args.join(' '));
 let requests;
 try {({requests}=await mount(def));} finally {console.error=original;}
 expect(host.textContent).toContain('Healthy sibling');
 expect(host.textContent).not.toContain('Missing history');
 expect(host.querySelector('button[aria-label="Category"]')).not.toBeNull();
 expect(requests).not.toContain('missingHistory');
 expect(errors.filter(message=>message.includes('MissingDataSourceReferenceError'))).toHaveLength(0);
});
it('keeps the tab rail and healthy tab when an inactive tab definition is absent',async()=>{
 const def=metadata();def.view.content.containers=[{id:'sections',tabs:{defaultSelectedTabId:'properties',renderActiveTabPanelOnly:true},containers:[
  {id:'properties',title:'Properties',dataSourceRef:'record',items:[{id:'title',type:'label',value:'Healthy properties'}]},
  {id:'history',title:'History',dataSourceRef:'missingHistory',items:[{id:'history-value',type:'label',value:'Missing history'}]},
 ]}];
 const errors=[];const original=console.error;console.error=(...args)=>errors.push(args.join(' '));
 let requests;
 try {({requests}=await mount(def));} finally {console.error=original;}
 expect(host.textContent).toContain('Properties');
 expect(host.textContent).toContain('Healthy properties');
 expect(host.textContent).not.toContain('Missing history');
 expect(host.querySelector('button[aria-label="Category"]')).not.toBeNull();
 expect(requests).not.toContain('missingHistory');
 expect(errors.filter(message=>message.includes('MissingDataSourceReferenceError'))).toHaveLength(0);
});
