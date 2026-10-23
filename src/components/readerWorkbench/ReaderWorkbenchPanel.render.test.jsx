import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {expect,it,vi} from 'vitest';
let props;
vi.mock('./ReaderBuilder.jsx',()=>({ReaderBuilder:value=>{props=value;return <div>Workbench</div>;}}));
import ReaderWorkbenchPanel from './ReaderWorkbenchPanel.jsx';
it('binds live report state and declared operations while propagating dirty and pending writes',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host),dirty=vi.fn(),back=vi.fn(),calls=[];
 let finish;const form=signal({report:{id:'reader-a',namespace:'tenant-name'},namespaceId:'tenant-a'});
 const context={signals:{form},services:{hostWindow:{setDirty:dirty}},lookupHandler:()=>back,Context:ref=>ref==='state'?{signals:{form}}:{handlers:{dataSource:{fetchRecords:request=>{calls.push({ref,...request});return new Promise(resolve=>{finish=resolve;});}}}}};
 const container={readerWorkbench:{dataSourceRef:'state',resourceNamespace:'custom',operations:{save:{dataSourceRef:'writer',mutation:true,parameters:{id:{arg:0},input:{arg:1}}}},onBack:'actions.back'}};
 try{
  await act(async()=>root.render(<ReaderWorkbenchPanel container={container} context={context}/>));
  const originalAPI=props.api;
  await act(async()=>root.render(<ReaderWorkbenchPanel container={container} context={{...context}}/>));
  expect(props.api).toBe(originalAPI);
  expect(calls).toEqual([]);expect(props.report.id).toBe('reader-a');expect(props.api.namespaceId).toBe('tenant-a');expect(props.api.namespaceName).toBe('tenant-name');expect(props.api.resourceNamespace).toBe('custom');
  await act(async()=>props.onStateChange({dirty:true,busy:false}));expect(dirty).toHaveBeenLastCalledWith(true);
  await act(async()=>props.onStateChange({dirty:false,busy:false}));expect(dirty).toHaveBeenLastCalledWith(false);
  let saving;await act(async()=>{saving=props.api.save('reader-a',{expectedSourceRevision:7});});
  expect(calls).toEqual([{ref:'writer',parameters:{id:'reader-a',input:{expectedSourceRevision:7}}}]);expect(dirty).toHaveBeenLastCalledWith(true);
  await act(async()=>{finish({rows:[{sourceRevision:8}]});await saving;});expect(dirty).toHaveBeenLastCalledWith(false);
  await act(async()=>{form.value={...form.value,report:{id:'reader-b'}};});expect(props.report.id).toBe('reader-b');
  props.onBack();expect(back).toHaveBeenCalledWith({context,value:undefined});
 }finally{await act(async()=>root.unmount());host.remove();}
});
