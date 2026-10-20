import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import WindowContent from './WindowContent.jsx';
import {SettingProvider} from '../core/context/Setting.jsx';
import {getWindowContext} from '../core/context/registry.js';
import {removeSignalsForKey} from '../core/store/signals.js';
import '../packs/blueprint/index.jsx';

it('honors the metadata close guard and invokes onClose for dialog chrome',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;HTMLElement.prototype.scrollIntoView ||= function(){};
 const windowId='dialog-close-contract',host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const metadata={namespace:'fixture',dataSource:{draft:{id:'draft',cardinality:'object',backend:{kind:'inline',rows:[]}}},actions:{code:'({closed:()=>{context.Context("draft").handlers.dataSource.setFormField({item:{dataField:"closed"},value:true});return true;}})'},actionAliases:['actions'],view:{content:{id:'root',dataSourceRef:'draft',fetchData:false,items:[{id:'notice',type:'label',value:'Record'}]}},dialogs:[{id:'edit',title:'Edit record',dataSourceRef:'draft',fetchOnOpen:false,closeDisabledWhen:{selector:'saving',equals:true},on:[{event:'onClose',handler:'actions.closed'}],content:{id:'form',items:[{id:'name',label:'Name',dataField:'name',type:'text'}]},actions:[{id:'cancel',label:'Cancel',close:true}]}]};
 const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
 try{
  await act(async()=>{root.render(<SettingProvider endpoints={{}} services={{dataConnectorTransport:async()=>({data:[]})}} connectorConfig={{window:{service:{uri:'/window'}}}}><WindowContent window={{windowId,windowKey:'edit'}} selectedMetadata={metadata}/></SettingProvider>);await flush();});
  const context=getWindowContext(windowId);expect(context).toBeTruthy();const draft=context.Context('draft').handlers.dataSource;
  await act(async()=>{draft.setFormData({values:{name:'Original',saving:true}});context.handlers.window.openDialog({execution:{args:['edit']}});await flush();});
  expect(document.querySelector('[role="dialog"]')).toBeTruthy();expect(document.querySelector('.bp6-dialog-close-button')).toBeNull();
  await act(async()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await flush();});expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  await act(async()=>{draft.setFormField({item:{dataField:'saving'},value:false});await flush();});
  await act(async()=>{document.querySelector('.bp6-dialog-close-button').click();await flush();});
  expect(draft.getFormData().closed).toBe(true);
 }finally{await act(async()=>root.unmount());host.remove();removeSignalsForKey(windowId);}
});
