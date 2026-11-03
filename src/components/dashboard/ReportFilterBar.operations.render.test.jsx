// @vitest-environment jsdom
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import ReportFilterBar from './ReportFilterBar.jsx';
import {activeWindows,getMetadataSignal} from '../../core/store/signals.js';
import {runUICommand} from '../../core/ui/commands.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

it('native Read and Operate reuse normal filter callbacks and Apply exactly once',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),apply=vi.fn();
 const layout=vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{width:100,height:20}]);
 const id='example-report';activeWindows.value=[{windowId:id,conversationId:'example-chat'}];getMetadataSignal(id).value={};
 function Filters(){const [values,set]=useState({from:'2026-01-01',to:'2026-01-31'});return <ReportFilterBar context={{identity:{windowId:id}}} controls={[{id:'period',label:'Period',kind:'dateRange',start:'from',end:'to',required:true}]} values={values} onChange={(key,value)=>set(old=>({...old,[key]:value}))} onApply={()=>apply(values)}/>;}
 try{
  await act(async()=>root.render(<Filters/>));
  let read=await runUICommand({method:'ui.controls.list',params:{windowId:id,conversationId:'example-chat',limit:20}});
  expect(read.controls.map(item=>item.controlId)).toContain('from');
  await act(async()=>runUICommand({method:'ui.control.setValue',params:{windowId:id,controlId:'from',value:'2026-01-02',expectedRevision:read.operationRevision}}));
  expect(apply).not.toHaveBeenCalled();
  read=await runUICommand({method:'ui.controls.list',params:{windowId:id,limit:20}});
  await act(async()=>runUICommand({method:'ui.control.click',params:{windowId:id,controlId:'report-filter:apply',expectedRevision:read.operationRevision}}));
  expect(apply).toHaveBeenCalledTimes(1);expect(apply).toHaveBeenCalledWith({from:'2026-01-02',to:'2026-01-31'});
  await expect(runUICommand({method:'ui.controls.list',params:{windowId:id,conversationId:'other'}})).rejects.toThrow(/conversation/);
 }finally{await act(async()=>root.unmount());host.remove();activeWindows.value=[];layout.mockRestore();}
});

it('native export operates the existing enabled output callback and rejects unavailable output',async()=>{
 const {default:ReportOutputActions}=await import('./ReportOutputActions.jsx');
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),exportReport=vi.fn();
 const layout=vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{width:100,height:20}]);
 const id='example-output';activeWindows.value=[{windowId:id,conversationId:'example-chat'}];getMetadataSignal(id).value={};
 const output={exportReport,previewPrint:vi.fn()};
 const render=disabled=>act(async()=>root.render(<ReportOutputActions context={{identity:{windowId:id}}} scopeKey="applied-example" output={output} disabled={disabled}/>));
 try{
  await render(true);
  await expect(runUICommand({method:'ui.control.click',params:{windowId:id,controlId:'report-output:pdf'}})).rejects.toThrow(/disabled/);
  expect(exportReport).not.toHaveBeenCalled();await render(false);
  const read=await runUICommand({method:'ui.controls.list',params:{windowId:id,limit:20}});
  await act(async()=>runUICommand({method:'ui.control.click',params:{windowId:id,controlId:'report-output:pdf',expectedRevision:read.operationRevision}}));
  expect(exportReport).toHaveBeenCalledExactlyOnceWith('pdf',undefined);
 }finally{await act(async()=>root.unmount());host.remove();activeWindows.value=[];layout.mockRestore();}
});
