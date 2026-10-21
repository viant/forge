// Actual rendered transport regressions for nested tab fetch ownership.
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,expect,it} from 'vitest';
import WindowContent from './WindowContent.jsx';
import {SettingProvider} from '../core/context/Setting.jsx';
import {removeSignalsForKey} from '../core/store/signals.js';
import {getWindowContext} from '../core/context/registry.js';
import {invokeRegisteredControlAction} from '../core/ui/controlActions.js';
import '../packs/blueprint/index.jsx';
let host,root,windowId,serial=0;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;windowId=`nested-fetch-audit-${++serial}`;host=document.createElement('div');document.body.append(host);root=createRoot(host);HTMLElement.prototype.scrollIntoView ||=function(){};});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();removeSignalsForKey(windowId);});
const settle=async action=>act(async()=>{await action?.();for(let i=0;i<30;i++)await Promise.resolve();});
function definition(mountPolicy){
 const source=id=>({id,service:{uri:`mcp://fixture/${id}`},uniqueKey:[{field:'id'}],selectionMode:'single'});
 return {dataSource:{shared:source('shared'),first:source('first'),second:source('second'),writer:{...source('writer'),autoFetch:false}},view:{content:{id:'root',dataSourceRef:'shared',items:[{id:'shared-caption',type:'label',dataField:'name'}],containers:[{id:'outer',tabs:{renderActiveTabPanelOnly:true,defaultSelectedTabId:'measurement',keepVisitedTabPanelsMounted:true,dataSourceFetchMode:'once'},containers:[{id:'measurement',title:'Measurement',containers:[{id:'nested',tabs:{renderActiveTabPanelOnly:false,defaultSelectedTabId:'first-panel',keepVisitedTabPanelsMounted:true,dataSourceFetchMode:'once',...(mountPolicy?{mountPolicy}:{})},containers:[{id:'first-panel',title:'First panel',dataSourceRef:'first',fetchData:true,items:[{id:'first-name',type:'text',dataField:'name'}],containers:[{id:'shared-child',dataSourceRef:'shared',fetchData:true,items:[{id:'shared-again',type:'label',dataField:'name'}]}]},{id:'second-panel',title:'Second panel',dataSourceRef:'second',fetchData:true,items:[{id:'second-name',type:'text',dataField:'name'},{id:'save-second',type:'button',label:'Save second',mutationCommand:{commandId:'save-second',dataSourceRef:'writer'}}]}]}]},{id:'other-outer',title:'Other outer',items:[{id:'other-label',type:'label',value:'Other'}]}]}]}}};
}
async function mount(mountPolicy,configure){const def=definition(mountPolicy);configure?.(def);const calls=[];const transport=async request=>{calls.push(request.dataSourceRef);return {data:[{id:request.dataSourceRef==='second'?2:1,name:`${request.dataSourceRef} value`}]};};await settle(()=>root.render(<SettingProvider endpoints={{}} services={{dataConnectorTransport:transport}} connectorConfig={{window:{service:{uri:'/fixture-window'}}}}><WindowContent window={{windowId,windowKey:'fixture'}} selectedMetadata={def}/></SettingProvider>));return calls;}
const count=(calls,ref)=>calls.filter(value=>value===ref).length;
const tab=label=>[...host.querySelectorAll('[role=tab]')].find(node=>node.textContent===label);
it('unvisited nested default-active panel must issue zero reader requests despite legacy renderActiveTabPanelOnly:false',async()=>{
 const calls=await mount();expect(count(calls,'shared')).toBe(1);expect(count(calls,'first')).toBe(1);expect(host.querySelector('input[aria-label="second-name"]')).toBeNull();expect(tab('Second panel')).toBeTruthy();
 expect(count(calls,'second'),'actual fake transport request count; datasource declaration is not a request').toBe(0);
});
it('explicit mountPolicy:all deliberately mounts and reads both nested panels',async()=>{
 const calls=await mount('all');expect(count(calls,'first')).toBe(1);expect(count(calls,'second')).toBe(1);expect(count(calls,'shared')).toBe(1);expect(count(calls,'writer')).toBe(0);
});
it('later activation retains shared state/draft, keeps writer dormant until actual save, and reuses once-loaded reader',async()=>{
 const calls=await mount();await settle(()=>tab('Second panel').click());expect(count(calls,'second')).toBe(1);const context=getWindowContext(windowId).Context('second');
 await settle(()=>invokeRegisteredControlAction({windowId,dataSourceRef:'second',controlId:'second-name',value:'retained draft'},'setValue'));expect(context.signals.form.peek().name).toBe('retained draft');expect(count(calls,'writer')).toBe(0);
 await settle(()=>tab('First panel').click());await settle(()=>tab('Second panel').click());expect(context.signals.form.peek().name).toBe('retained draft');expect(count(calls,'second')).toBe(1);expect(count(calls,'shared')).toBe(1);
 let saved;await settle(()=>{saved=invokeRegisteredControlAction({windowId,dataSourceRef:'second',controlId:'save-second'},'click');});await act(async()=>{await saved;});expect(count(calls,'writer')).toBe(1);
});

it('an unvisited panel with implicit datasource fetch must not make a reader request',async()=>{
 const calls=await mount(undefined,def=>{delete def.view.content.containers[0].containers[0].containers[0].containers[1].fetchData;});
 expect(count(calls,'first')).toBe(1);expect(count(calls,'second'),'implicit source priming must follow actual visible consumer lifecycle').toBe(0);
});

it('a locally hidden configured default falls back to the visible implicit-fetch panel',async()=>{
 const calls=await mount(undefined,def=>{const nested=def.view.content.containers[0].containers[0].containers[0];nested.containers[0].visibleWhen={source:'windowForm',field:'showFirst',equals:true};delete nested.containers[1].fetchData;});
 expect(count(calls,'first')).toBe(0);expect(count(calls,'second')).toBe(1);expect(count(calls,'shared')).toBe(1);expect(tab('First panel')).toBeUndefined();
});

it.each(['tabs','stableTabs'])('an inferred default only used by an unvisited %s panel stays dormant until its actual consumer mounts',async tabKind=>{
 const calls=await mount(undefined,def=>{
  delete def.view.dataSourceRef;
  def.dataSource={details:{id:'details',cardinality:'collection',selectionMode:'single',autoSelect:true,selectors:{data:'data'},uniqueKey:[{field:'id'}]}};
  def.view.content={id:'inferred-tabs',[tabKind]:{defaultSelectedTabId:'home',renderActiveTabPanelOnly:true},containers:[{id:'home',title:'Home',content:'Home content'},{id:'details-panel',title:'Details',dataSourceRef:'details',fetchData:true,items:[{id:'detail-name',type:'text',dataField:'name'}]}]};
 });
 expect(count(calls,'details')).toBe(0);
 await settle(()=>tab('Details').click());
 expect(count(calls,'details')).toBe(1);
 const context=getWindowContext(windowId).Context('details');
 await settle(()=>context.handlers.dataSource.setEditedFormData({values:{...context.signals.form.peek(),name:'retained edit'}}));
 expect(context.signals.form.peek().name).toBe('retained edit');
});

it.each(['tabs','stableTabs'].flatMap(tabKind=>['root','window-title','view-title'].map(binding=>[tabKind,binding])))('preserves eager explicit %s %s dependencies despite an inactive inferred consumer',async(tabKind,binding)=>{
 const calls=await mount(undefined,def=>{
  delete def.view.dataSourceRef;def.dataSource={details:{id:'details',cardinality:'collection',selectionMode:'single',autoSelect:true,selectors:{data:'data'},uniqueKey:[{field:'id'}]}};
  def.view.content={id:'header-dependency-tabs',[tabKind]:{defaultSelectedTabId:'home',renderActiveTabPanelOnly:true},containers:[{id:'home',title:'Home',content:'Home content'},{id:'details-panel',title:'Details',dataSourceRef:'details',fetchData:true,items:[{id:'detail-name',type:'text',dataField:'name'}]}]};
  if(binding==='root')def.view.dataSourceRef='details';else if(binding==='window-title')def.window={...def.window,titleBinding:{dataSourceRef:'details',field:'name'}};else def.view.titleBinding={dataSourceRef:'details',field:'name'};
 });
 expect(count(calls,'details')).toBe(1);
});
