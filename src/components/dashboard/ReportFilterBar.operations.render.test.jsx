// @vitest-environment jsdom
import React,{act,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import ReportFilterBar from './ReportFilterBar.jsx';
import {activeWindows,getMetadataSignal,getViewSignal} from '../../core/store/signals.js';
import {runUICommand} from '../../core/ui/commands.js';
import '../../packs/blueprint/index.jsx';
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

it('sets both preset dates through one native action before applying the draft', async () => {
 const host = document.createElement('div');
 document.body.append(host);
 const root = createRoot(host);
 const windowId = 'example-range';
 const rangeControlId = 'report-filter:date-range:from';
 activeWindows.value = [{windowId, conversationId:'example-chat'}];
 const apply = vi.fn();
 const initial = {from:'2026-01-01',to:'2026-01-31'};
 const range = {start:'2026-02-01',end:'2026-02-28'};
 const changeRange = vi.fn();
 const datePresets = {options:[{value:'custom',label:'Custom'}]};
 function Filters({busy=false}) {
  const [values,setValues] = useState(initial);
  useEffect(() => {getViewSignal(windowId).value = {report:{draftParameters:values}};}, [values]);
  return <ReportFilterBar context={{identity:{windowId}}} busy={busy}
   controls={[{id:'from',label:'Period',kind:'dateRange',start:'from',end:'to',required:true,datePresets}]}
   values={values} onDatePreset={()=>{}}
   onDateRange={(id,next)=>{changeRange(id,next);setValues({from:next.start,to:next.end});}}
   onChange={(key,value)=>setValues(previous=>({...previous,[key]:value}))}
   onApply={()=>apply(values)}/>;
 }
 const read = () => runUICommand({method:'ui.controls.list',params:{windowId}});
 const setRange = expectedRevision => runUICommand({method:'ui.control.setValue',params:{windowId,controlId:rangeControlId,scope:'windowForm',value:range,expectedRevision}});
 try {
  await act(async()=>root.render(<Filters busy/>));
  const busy = await read();
  expect(busy.controls).toEqual(expect.arrayContaining([expect.objectContaining({controlId:rangeControlId,type:'dateRangePreset',disabled:true})]));
  await expect(setRange(busy.operationRevision)).rejects.toThrow(/disabled/);
  await act(async()=>root.render(<Filters/>));
  const before = await read();
  expect(before.controls.map(control=>control.controlId)).toEqual(expect.arrayContaining([rangeControlId,'from','to','report-filter:apply']));
  let changed;
  await act(async()=>{changed = await setRange(before.operationRevision);});
  expect(changeRange).toHaveBeenCalledExactlyOnceWith('from',range);
  expect(apply).not.toHaveBeenCalled();
  expect(host.querySelector('[aria-label="Period from"]').value).toBe(range.start);
  expect(host.querySelector('[aria-label="Period to"]').value).toBe(range.end);
  expect(changed.operationRevision).toBe((await read()).operationRevision);
  await act(async()=>runUICommand({method:'ui.control.click',params:{windowId,controlId:'report-filter:apply',expectedRevision:changed.operationRevision}}));
  expect(apply).toHaveBeenCalledExactlyOnceWith({from:range.start,to:range.end});
 } finally {
  await act(async()=>root.unmount());
  host.remove();
  activeWindows.value=[];
 }
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

it('returns the completed export receipt through the mounted native action without file bytes',async()=>{
 const {default:ReportOutputActions}=await import('./ReportOutputActions.jsx');
 const {useReportOutput}=await import('./useReportOutput.js');
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const layout=vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{width:100,height:20}]);
 const download=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 URL.createObjectURL=vi.fn(()=> 'blob:example');URL.revokeObjectURL=vi.fn();
 const id='receipt-report';activeWindows.value=[{windowId:id,conversationId:'example-chat'}];getMetadataSignal(id).value={};
 const exportData=vi.fn(async()=>({artifactId:'artifact-1',jobId:'job-1',format:'xlsx',filename:'example.xlsx',contentType:'application/octet-stream',data:btoa('synthetic file bytes')}));
 function Output(){const output=useReportOutput({scopeKey:'same',onExport:exportData});return <ReportOutputActions context={{identity:{windowId:id}}} scopeKey="same" output={output} workbookExport/>;}
 try{
  await act(async()=>root.render(<Output/>));
  let result;await act(async()=>{result=await runUICommand({method:'ui.control.click',params:{windowId:id,controlId:'report-output:xlsx'}})});
  expect(result.receipt).toEqual({status:'succeeded',format:'xlsx',artifactId:'artifact-1',jobId:'job-1'});
  expect(result.status).toBe('succeeded');expect(download).toHaveBeenCalledOnce();expect(exportData).toHaveBeenCalledOnce();
  expect(JSON.stringify(result).length).toBeLessThan(400);expect(JSON.stringify(result)).not.toContain('data:');
 }finally{await act(async()=>root.unmount());host.remove();activeWindows.value=[];layout.mockRestore();download.mockRestore();}
});
