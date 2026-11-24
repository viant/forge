// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {SettingProvider} from '../../core/context/Setting.jsx';
import WindowContent from '../WindowContent.jsx';
import {ForgeThemeProvider} from '../ThemeBoundary.jsx';
import {getWindowContext} from '../../core/context/registry.js';
import {removeSignalsForKey} from '../../core/store/signals.js';
import '../../packs/blueprint/index.jsx';

let serial=0;
async function fixture(themeId='design-system-2',mode='light'){
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const windowId=`operation-toolbar-${++serial}`,host=document.createElement('div');document.body.append(host);
 const root=createRoot(host),create=vi.fn(),upload=vi.fn(),save=vi.fn(),dialog=vi.fn();
 const operations=[
  {id:'save',label:'Save names',handler:'example.save',disabledWhen:{any:[{source:'windowForm',field:'changes',equals:0},{source:'windowForm',field:'invalid',equals:true}]}},
  {id:'reset',label:'Reset names',dialogId:'resetDialog',disabledWhen:{source:'windowForm',field:'changes',equals:0}},
  {id:'new',label:'New record',handler:'example.create',visibleWhen:{source:'windowForm',field:'canCreate',equals:true}},
  {id:'upload',label:'Upload entries',handler:'example.upload',requiresSelection:true,selection:{min:1,max:1,every:{source:'row',field:'writable',equals:true}}},
  {id:'archive',label:'Archive',dialogId:'archiveDialog',requiresSelection:true,selection:{min:1,max:100},visibleWhen:{source:'windowForm',field:'canArchive',equals:true}},
 ];
 const metadata={
  dataSource:{rows:{id:'rows',autoFetch:false,service:{uri:'/unused'},selectionMode:'multi',uniqueKey:[{field:'id'}],selectors:{data:'data'}}},
  namespace:'example',actions:{code:'({create:args=>context.services.example.create(args),upload:args=>context.services.example.upload(args),save:args=>context.services.example.save(args)})'},
  view:{content:{id:'root',containers:[{id:'records',title:'Records',dataSourceRef:'rows',fetchData:false,editableCollection:{operations},table:{
   columns:[{id:'id',name:'ID'},{id:'name',name:'Name'}],toolbar:{items:[]},
   targetOverrides:{'theme:design-system-2':{presentation:'list-page',operationToolbar:{
    primary:'new',menu:{label:'Actions',operations:['upload','archive']},
    editReview:{apply:'save',revert:'reset',countField:'changes',rowCountField:'changedRows'},
   }}},
  }}]}},
 };
 const settle=async fn=>act(async()=>{fn?.();for(let i=0;i<30;i++)await Promise.resolve()});
 await settle(()=>root.render(<SettingProvider endpoints={{}} connectorConfig={{window:{service:{uri:'/window'}}}} services={{example:{create,upload,save},dataConnectorTransport:async()=>({data:[]})}}><ForgeThemeProvider themeId={themeId} mode={mode}><WindowContent window={{windowId,windowKey:'fixture'}} selectedMetadata={metadata}/></ForgeThemeProvider></SettingProvider>));
 expect(getWindowContext(windowId),host.innerHTML).toBeTruthy();
 const context=getWindowContext(windowId).Context('rows');
 await settle(()=>{context.signals.windowForm.value={canCreate:true,canArchive:true,changes:0,changedRows:0};context.signals.control.value={loaded:true};context.signals.collection.value=[{id:1,name:'First',writable:true},{id:2,name:'Protected',writable:false}];});
 context.handlers.window.openDialog=dialog;
 const button=text=>[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===text);
 const click=async node=>{expect(node).toBeTruthy();await settle(()=>node.dispatchEvent(new MouseEvent('click',{bubbles:true})));};
 const item=text=>[...document.querySelectorAll('[role="menuitem"]')].find(node=>node.textContent.trim()===text);
 const select=async rows=>settle(()=>{context.signals.selection.value={selected:rows[0],selection:rows};});
 return {host,context,create,upload,save,dialog,button,item,click,select,settle,close:async()=>{await settle(()=>root.unmount());host.remove();removeSignalsForKey(windowId);}};
}

it.each(['light','dark'])('groups the original guarded operations only in DS2 (%s)',async mode=>{
 const f=await fixture('design-system-2',mode);
 try{
  expect(f.button('New record').classList.contains('bp6-intent-primary')).toBe(true);
  expect(f.button('New record').classList.contains('forge-toolbar-action')).toBe(true);
  expect(f.button('Actions').classList.contains('forge-toolbar-action')).toBe(true);
  expect(f.button('Actions').disabled).toBe(true);
  expect(f.button('Save names')).toBeUndefined();expect(f.button('Reset names')).toBeUndefined();
  expect(f.button('Upload entries')).toBeUndefined();expect(f.button('Archive')).toBeUndefined();
  await f.click(f.button('New record'));expect(f.create).toHaveBeenCalledTimes(1);
  await f.select([{id:1,name:'First',writable:true}]);await f.click(f.button('Actions'));
  expect(f.item('Upload entries').getAttribute('aria-disabled')).not.toBe('true');
  await f.click(f.item('Upload entries'));
  expect(f.upload).toHaveBeenCalledTimes(1);expect(f.upload.mock.calls[0][0].parameters.selectedRows).toEqual([{id:1,name:'First',writable:true}]);
  await f.click(f.button('Actions'));await f.click(f.item('Archive'));
  expect(f.dialog.mock.calls.at(-1)[0]).toMatchObject({execution:{args:['archiveDialog',{awaitResult:false}]},parameters:{operationId:'archive',selectedRows:[{id:1,name:'First',writable:true}]}});
 }finally{await f.close();}
});

it('retains single-row writability, multi-selection limits and producer visibility',async()=>{
 const f=await fixture();
 try{
  await f.select([{id:2,writable:false}]);await f.click(f.button('Actions'));
  expect(f.item('Upload entries').getAttribute('aria-disabled')).toBe('true');
  await f.click(f.item('Upload entries'));expect(f.upload).not.toHaveBeenCalled();
  await f.select([{id:1,writable:true},{id:2,writable:true}]);
  expect(f.item('Upload entries').getAttribute('aria-disabled')).toBe('true');
  expect(f.item('Archive').getAttribute('aria-disabled')).not.toBe('true');
  await f.select(Array.from({length:101},(_,id)=>({id,writable:true})));
  expect(f.item('Archive').getAttribute('aria-disabled')).toBe('true');
  await f.settle(()=>{f.context.signals.windowForm.value={...f.context.signals.windowForm.value,canArchive:false,canCreate:false};});
  expect(f.item('Archive')).toBeUndefined();expect(f.button('New record').disabled).toBe(true);
 }finally{await f.close();}
});

it('uses Apply/Revert for pending edits and preserves original validation and confirmation',async()=>{
 const f=await fixture();
 try{
  expect(f.button('Apply changes')).toBeUndefined();
  await f.settle(()=>{f.context.signals.windowForm.value={...f.context.signals.windowForm.value,changes:1,changedRows:1,invalid:true};});
  expect(f.host.textContent).toContain('1 unsaved change in 1 row');
  expect(f.button('Apply changes').disabled).toBe(true);expect(f.button('Save names')).toBeUndefined();
  await f.click(f.button('Revert all'));expect(f.dialog.mock.calls.at(-1)[0].execution.args[0]).toBe('resetDialog');
  await f.settle(()=>{f.context.signals.windowForm.value={...f.context.signals.windowForm.value,invalid:false};});
  await f.click(f.button('Apply changes'));expect(f.save).toHaveBeenCalledTimes(1);
 }finally{await f.close();}
});

it('leaves the prior operation bar unchanged in Baseline',async()=>{
 const f=await fixture('baseline');
 try{
  for(const label of ['Save names','Reset names','New record','Upload entries','Archive'])expect(f.button(label)).toBeTruthy();
  expect(f.button('Actions')).toBeUndefined();expect(f.button('Apply changes')).toBeUndefined();
 }finally{await f.close();}
});
