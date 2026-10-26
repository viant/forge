import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {useSetting} from '../core/context/Setting.jsx';
let activeHost;
vi.mock('./WindowContent.jsx',()=>({default:()=>{activeHost=useSetting().services.hostWindow;return <div>Metadata window</div>;}}));
import {ResourceWindow} from './ResourceWindow.jsx';
const resource={schemaVersion:3,format:'window.references',targets:[{variant:'default'}],variants:{default:{window:{windowKey:'fixture',dataSource:{}},dataSources:{}}}};
it('keeps independent child scopes and dialogs protected until every scope is released',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const target=document.createElement('div');document.body.append(target);const root=createRoot(target),dirty=vi.fn();
 const services={hostWindow:{loadResource:async()=>resource}};
 try{
  await act(async()=>{root.render(<ResourceWindow uri="window://fixture/root" hostServices={services} onDirtyChange={dirty}/>);});
  await act(async()=>{activeHost.setScopeDirty('first',true);activeHost.setScopeDirty('second',true);activeHost.setScopeDirty('first',false);});
  expect(dirty.mock.calls).toEqual([[true]]);
  await act(async()=>{activeHost.setDialogOpen('edit',true);activeHost.setScopeDirty('second',false);activeHost.setDirty(false);});
  expect(dirty.mock.calls).toEqual([[true]]);
  await act(async()=>activeHost.setDialogOpen('edit',false));
  expect(dirty.mock.calls).toEqual([[true],[false]]);
  await act(async()=>activeHost.setDirty(true));
  await act(async()=>root.unmount());
  expect(dirty.mock.calls).toEqual([[true],[false],[true],[false]]);
 }finally{target.remove();}
});
it('publishes nested scope state to its parent and clears it on unmount',async()=>{
 const target=document.createElement('div');document.body.append(target);const root=createRoot(target),scope=vi.fn();
 try{
  await act(async()=>{root.render(<ResourceWindow uri="window://fixture/child" disabled hostServices={{hostWindow:{loadResource:async()=>resource,setScopeDirty:scope}}}/>);});
  expect(target.querySelector('fieldset').disabled).toBe(true);
  await act(async()=>activeHost.setDirty(true));
  expect(scope).toHaveBeenLastCalledWith(expect.stringContaining('window://fixture/child'),true);
  await act(async()=>root.unmount());
  expect(scope).toHaveBeenLastCalledWith(expect.stringContaining('window://fixture/child'),false);
 }finally{target.remove();}
});
