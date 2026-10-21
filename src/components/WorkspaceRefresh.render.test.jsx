import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {SettingProvider} from '../core/context/Setting.jsx';
import WindowContent from './WindowContent.jsx';
import {activeWindows,getMetadataSignal,getInputSignal,getSelectionSignal,getFormSignal,getViewSignal} from '../core/store/signals.js';
import {getWindowContext} from '../core/context/registry.js';
import {runUICommand} from '../core/ui/commands.js';
import {listWorkspaceRefreshCapabilities} from '../core/ui/workspaceRefresh.js';
import '../packs/blueprint/index.jsx';
it('normal metadata loader refresh retains actual edited form, filter/page/selection and navigation without datasource fetches',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const windowId='refresh-render',host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const metadata={title:'Fixture',dataSource:{record:{autoFetch:false,service:{uri:'/reader'},uniqueKey:[{field:'id'}],autoSelect:false}},view:{content:{id:'editor',dataSourceRef:'record',fetchData:false,items:[{id:'name',type:'text',dataField:'name'}],containers:[{id:'sections',tabs:{appearance:'section'},containers:[{id:'first',title:'First',items:[]},{id:'second',title:'Second',items:[]}]}]}}};
 let denied=false,changedScope=false,reads=0;const transport=vi.fn(async request=>{if(request.dataSource.service.uri.includes('/fixture-window')){expect(request.options.fresh).toBe(true);reads++;if(denied)throw new Error('host admission denied');return {data:{...metadata,title:'Fresh definition',...(changedScope?{resource:{uri:'window://other/fixture'}}:{})}};}throw new Error('Unexpected business datasource read');});
 const services={workspaceRefresh:{loadMetadata:({load})=>load()},dataConnectorTransport:transport};activeWindows.value=[{windowId,windowKey:'fixture'}];
 try{await act(async()=>{root.render(<SettingProvider services={services} endpoints={{}} connectorConfig={{window:{service:{uri:'/fixture-window'}}}}><WindowContent window={{windowId,windowKey:'fixture'}} selectedMetadata={metadata}/></SettingProvider>);for(let i=0;i<30;i++)await Promise.resolve();});
 await act(async()=>{await runUICommand({method:'ui.control.setValue',params:{windowId,dataSourceRef:'record',controlId:'name',value:'unsaved draft'}});});
 const context=getWindowContext(windowId).Context('record'),input=getInputSignal(`${windowId}DSrecord`),selection=getSelectionSignal(`${windowId}DSrecord`),view=getViewSignal(windowId);
 await act(async()=>{context.handlers.dataSource.setSilentFilterValues({filter:{name:'keep'}});input.value={...input.peek(),page:3,fetch:false,refresh:false};selection.value={selected:{id:7},rowIndex:0};view.value={tabs:{sections:'second'}};for(let i=0;i<30;i++)await Promise.resolve();});
 const before=JSON.stringify([getFormSignal(`${windowId}DSrecord`).peek(),input.peek(),selection.peek(),view.peek()]);expect(listWorkspaceRefreshCapabilities(windowId).some(item=>item.scope==='form'&&item.formId==='editor'&&item.metadata&&!item.data)).toBe(true);
 await act(async()=>{await runUICommand({method:'ui.workspace.refresh',params:{windowId,scope:'form',formId:'editor',reloadMetadata:true}});for(let i=0;i<30;i++)await Promise.resolve();});expect(reads).toBe(1);expect(getMetadataSignal(windowId).peek().title).toBe('Fresh definition');expect(JSON.stringify([getFormSignal(`${windowId}DSrecord`).peek(),input.peek(),selection.peek(),view.peek()])).toBe(before);expect(host.querySelector('input').value).toBe('unsaved draft');
 changedScope=true;await act(async()=>{await expect(runUICommand({method:'ui.workspace.refresh',params:{windowId,reloadMetadata:true}})).rejects.toThrow(/scope/);});expect(getMetadataSignal(windowId).peek().title).toBe('Fresh definition');changedScope=false;
 denied=true;await act(async()=>{await expect(runUICommand({method:'ui.workspace.refresh',params:{windowId,reloadMetadata:true}})).rejects.toThrow(/denied/);});expect(getMetadataSignal(windowId).peek().title).toBe('Fresh definition');expect(getFormSignal(`${windowId}DSrecord`).peek().name).toBe('unsaved draft');
 }finally{await act(async()=>{root.unmount();activeWindows.value=[];});host.remove();}
});
