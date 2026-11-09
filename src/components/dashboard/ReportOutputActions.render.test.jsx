import React,{act,StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('@blueprintjs/core',()=>({
 Button:({children,...props})=><button {...props}>{children}</button>,
 Callout:({children,...props})=><section {...props}>{children}</section>,Spinner:()=>null,
 HTMLSelect:({options,...props})=><select {...props}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>,
}));
import ReportOutputActions from './ReportOutputActions.jsx';
import {useReportOutput} from './useReportOutput.js';
const artifact=format=>({format,data:btoa('authorized bytes'),contentType:'application/octet-stream',filename:`report.${format}`});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return{promise,resolve}};
afterEach(()=>vi.restoreAllMocks());
async function mount(props={}){
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 URL.createObjectURL=vi.fn(()=> 'blob:report');URL.revokeObjectURL=vi.fn();
 const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 const host=document.createElement('div'),root=createRoot(host);
 let latestOutput;
 const Harness=p=>{const output=useReportOutput(p);latestOutput=output;return <><ReportOutputActions {...p} output={output} cancelable/><output>{output.printModel?.title}</output></>};
 let current={scopeKey:'first',tableBlocks:[{id:'evidence',title:'Evidence'}],...props};
 const render=async change=>{current={...current,...change};await act(async()=>root.render(<StrictMode><Harness {...current}/></StrictMode>));};
 await render();return{host,render,click,get output(){return latestOutput},button:label=>[...host.querySelectorAll('button')].find(b=>b.textContent===label),close:()=>act(async()=>root.unmount())};
}
it('downloads the chosen complete table through the shared file path',async()=>{
 const run=vi.fn(async({format})=>artifact(format)),v=await mount({onExport:run});
 try{await act(async()=>v.button('Export CSV').click());expect(run).toHaveBeenCalledTimes(1);expect(run.mock.calls[0][0]).toMatchObject({format:'csv',tableBlockId:'evidence'});expect(v.click).toHaveBeenCalledOnce();}finally{await v.close()}
});
it('disambiguates equal table captions by their authored report tab',async()=>{
 const tables=[{id:'overviewTable',kind:'tableBlock',title:'Evidence'},{id:'detailTable',kind:'tableBlock',title:'Evidence'}];
 const reportSpec={blocks:[{id:'tabs',kind:'tabGroupBlock',sectionIds:['overview','detail'],includeUnlistedSections:false},
  {id:'overview',kind:'sectionBlock',title:'Overview',blockIds:['overviewTable']},...tables,
  {id:'detail',kind:'sectionBlock',title:'Detail',navigationLabel:'Details',blockIds:['detailTable']}]};
 const run=vi.fn(async({format})=>artifact(format)),v=await mount({onExport:run,tableBlocks:tables,reportSpec});
 try{const select=v.host.querySelector('select');expect([...select.options].map(option=>option.textContent)).toEqual(['Choose a table','Overview — Evidence','Details — Evidence']);
  await act(async()=>{select.value='detailTable';select.dispatchEvent(new Event('change',{bubbles:true}))});await act(async()=>v.button('Export CSV').click());expect(run.mock.calls[0][0].tableBlockId).toBe('detailTable');
 }finally{await v.close()}
});
it('exports a complete workbook without requiring a CSV table selection',async()=>{
 const run=vi.fn(async({format})=>artifact(format)),v=await mount({onExport:run,workbookExport:true,tableBlocks:[{id:'one'},{id:'two'}]});
 try{expect(v.button('Export CSV').disabled).toBe(true);expect(v.button('Export XLSX').disabled).toBe(false);await act(async()=>v.button('Export XLSX').click());expect(run.mock.calls[0][0]).toMatchObject({format:'xlsx'});expect(run.mock.calls[0][0].tableBlockId).toBeUndefined();}finally{await v.close()}
});
it('aborts an obsolete scope and never downloads its late result',async()=>{
 const pending=deferred(),run=vi.fn(()=>pending.promise),v=await mount({onExport:run});
 try{await act(async()=>v.button('Export PDF').click());const request=run.mock.calls[0][0];await v.render({scopeKey:'different-advertiser'});expect(request.signal.aborted).toBe(true);expect(request.isCurrent()).toBe(false);await act(async()=>pending.resolve(artifact('pdf')));expect(v.click).not.toHaveBeenCalled();expect(v.host.textContent).not.toContain('Preparing PDF');}finally{await v.close()}
});
it('cancel and unmount abort pending output without a stale alert',async()=>{
 const first=deferred(),second=deferred(),run=vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise),v=await mount({onExport:run});
 await act(async()=>v.button('Export CSV').click());await act(async()=>v.button('Cancel').click());expect(run.mock.calls[0][0].signal.aborted).toBe(true);await act(async()=>first.resolve(artifact('csv')));expect(v.click).not.toHaveBeenCalled();
 await act(async()=>v.button('Export PDF').click());await v.close();expect(run.mock.calls[1][0].signal.aborted).toBe(true);await act(async()=>second.resolve(artifact('pdf')));expect(v.click).not.toHaveBeenCalled();
});
it('requires an explicit table when several are authored and resets selection with scope',async()=>{
 const run=vi.fn(async({format})=>artifact(format)),v=await mount({onExport:run,tableBlocks:[{id:'one',title:'First'},{id:'two',title:'Second'}]});
 try{expect(v.button('Export CSV').disabled).toBe(true);expect(v.button('Export PDF').disabled).toBe(false);const select=v.host.querySelector('select');await act(async()=>{select.value='two';select.dispatchEvent(new Event('change',{bubbles:true}))});await act(async()=>v.button('Export XLSX').click());expect(run.mock.calls[0][0].tableBlockId).toBe('two');await v.render({scopeKey:'another-report'});expect(v.button('Export CSV').disabled).toBe(true);}finally{await v.close()}
});
it('rejects malformed, partial and mismatched output rather than invoking a download',async()=>{
 const run=vi.fn().mockResolvedValueOnce({...artifact('csv'),data:'invalid!'}).mockResolvedValueOnce({...artifact('csv'),incompleteDatasetIds:['primary']}).mockResolvedValueOnce(artifact('xlsx')),v=await mount({onExport:run});
 try{for(const message of ['valid base64','incomplete','different file format']){await act(async()=>v.button('Export CSV').click());expect(v.host.textContent).toContain(message)}expect(v.click).not.toHaveBeenCalled();}finally{await v.close()}
});
it('opens a fresh canonical print model, closes it, and drops it on identity change',async()=>{
 const print=vi.fn(async()=>({kind:'reportPrint',title:'Fresh complete print',pages:[{number:1}],pageGeometry:{width:612,height:792}})),v=await mount({onPrint:print});
 try{await act(async()=>v.button('Print preview').click());expect(print).toHaveBeenCalledTimes(1);expect(v.host.querySelector('output').textContent).toBe('Fresh complete print');await act(async()=>v.button('Close print preview').click());expect(v.host.querySelector('output').textContent).toBe('');await act(async()=>v.button('Print preview').click());await v.render({scopeKey:'new-metrics'});expect(v.host.querySelector('output').textContent).toBe('');}finally{await v.close()}
});

it('returns compact successful export receipts without retaining file bytes',async()=>{
 const run=vi.fn(async()=>({...artifact('xlsx'),artifactId:'artifact-1',jobId:'job-1',extra:'not part of receipt'})),v=await mount({onExport:run});
 try{let receipt;await act(async()=>{receipt=await v.output.exportReport('xlsx')});expect(receipt).toEqual({status:'succeeded',receipt:{status:'succeeded',format:'xlsx',artifactId:'artifact-1',jobId:'job-1'}});expect(v.click).toHaveBeenCalledOnce();}finally{await v.close()}
});
it('returns failed export outcomes to automation as well as the visible alert',async()=>{
 const v=await mount({onExport:async()=>{throw Error('Synthetic export failure')}});
 try{let receipt;await act(async()=>{receipt=await v.output.exportReport('xlsx')});expect(receipt).toEqual({status:'failed',error:{message:'Synthetic export failure'}});expect(v.host.textContent).toContain('Synthetic export failure');expect(v.click).not.toHaveBeenCalled();}finally{await v.close()}
});
it('does not return successful receipts after a scope change or cancellation',async()=>{
 for(const changeScope of [true,false]){
  const pending=deferred(),v=await mount({onExport:()=>pending.promise});let result;
  try{await act(async()=>{result=v.output.exportReport('xlsx')});if(changeScope)await v.render({scopeKey:'different'});else await act(async()=>v.output.cancelOutput());let receipt;await act(async()=>{pending.resolve({...artifact('xlsx'),artifactId:'stale'});receipt=await result});expect(receipt.status).toBe('cancelled');expect(v.click).not.toHaveBeenCalled();}finally{await v.close()}
 }
});
it('awaits a host download and keeps delivery busy until acknowledgement',async()=>{
 const ack=deferred(),download=vi.fn(()=>ack.promise),value=artifact('pdf'),v=await mount({onExport:async()=>value,onDownload:download});
 let outcome;
 try{
  await act(async()=>{outcome=v.output.exportReport('pdf')});
  expect(download).toHaveBeenCalledOnce();expect(download.mock.calls[0][0]).toBe(value);expect(download.mock.calls[0][1]).toBe('pdf');
  expect(download.mock.calls[0][2].signal.aborted).toBe(false);expect(download.mock.calls[0][2].isCurrent()).toBe(true);
  expect(v.output.busy).toBe('pdf');expect(v.click).not.toHaveBeenCalled();
  await act(async()=>ack.resolve());expect(await outcome).toMatchObject({status:'succeeded'});expect(v.output.busy).toBe('');
 }finally{await v.close()}
});
it('validates format, completeness and payload before invoking a host download',async()=>{
 const download=vi.fn(),run=vi.fn().mockResolvedValueOnce({...artifact('csv'),data:'invalid!'}).mockResolvedValueOnce({...artifact('csv'),incompleteDatasetIds:['primary']}).mockResolvedValueOnce(artifact('xlsx'));
 const v=await mount({onExport:run,onDownload:download});
 try{for(const message of ['valid base64','incomplete','different file format']){await act(async()=>v.button('Export CSV').click());expect(v.host.textContent).toContain(message)}expect(download).not.toHaveBeenCalled();expect(v.click).not.toHaveBeenCalled();}finally{await v.close()}
});
it('shows a rejected or unsupported host download without a browser fallback',async()=>{
 for(const message of ['Host declined the download.','This host does not support file downloads.']){
  const download=vi.fn(async()=>{throw Error(message)}),v=await mount({onExport:async()=>artifact('pdf'),onDownload:download});
  try{let outcome;await act(async()=>{outcome=await v.output.exportReport('pdf')});expect(outcome).toEqual({status:'failed',error:{message}});expect(v.host.textContent).toContain(message);expect(v.click).not.toHaveBeenCalled();}finally{await v.close()}
 }
});
it('never invokes the host for cancelled or obsolete producer output',async()=>{
 for(const invalidate of ['scope','cancel','unmount']){
  const pending=deferred(),download=vi.fn(),v=await mount({onExport:()=>pending.promise,onDownload:download});let outcome,closed=false;
  try{
   await act(async()=>{outcome=v.output.exportReport('pdf')});
   if(invalidate==='scope')await v.render({scopeKey:'new-scope'});
   else if(invalidate==='cancel')await act(async()=>v.output.cancelOutput());
   else{await v.close();closed=true;}
   await act(async()=>pending.resolve(artifact('pdf')));expect(await outcome).toEqual({status:'cancelled'});expect(download).not.toHaveBeenCalled();expect(v.click).not.toHaveBeenCalled();
  }finally{if(!closed)await v.close()}
 }
});
it('a late host acknowledgement cannot overwrite output for a later scope',async()=>{
 const ack=deferred(),delivered=[],download=vi.fn(async(value,format,{signal,isCurrent})=>{if(value.filename==='old.pdf')await ack.promise;if(signal.aborted||!isCurrent())return;delivered.push(value.filename)});
 let old=true;const v=await mount({onExport:async()=>({...artifact('pdf'),filename:old?'old.pdf':'new.pdf'}),onDownload:download});let previous;
 try{
  await act(async()=>{previous=v.output.exportReport('pdf')});const first=download.mock.calls[0][2];
  await v.render({scopeKey:'new-scope'});expect(first.signal.aborted).toBe(true);expect(first.isCurrent()).toBe(false);old=false;
  let current;await act(async()=>{current=await v.output.exportReport('pdf')});expect(current.status).toBe('succeeded');
  await act(async()=>ack.resolve());expect(await previous).toEqual({status:'cancelled'});expect(delivered).toEqual(['new.pdf']);expect(v.output.error).toBe('');expect(v.output.busy).toBe('');
 }finally{await v.close()}
});
it('cancel and unmount abort an awaiting host delivery before it commits',async()=>{
 for(const unmount of [false,true]){
  const ack=deferred(),delivered=vi.fn(),download=vi.fn(async(value,format,{signal,isCurrent})=>{await ack.promise;if(!signal.aborted&&isCurrent())delivered(value)});
  const v=await mount({onExport:async()=>artifact('pdf'),onDownload:download});let outcome,closed=false;
  try{
   await act(async()=>{outcome=v.output.exportReport('pdf')});
   if(unmount){await v.close();closed=true;}else await act(async()=>v.output.cancelOutput());
   expect(download.mock.calls[0][2].signal.aborted).toBe(true);
   await act(async()=>ack.resolve());expect(await outcome).toEqual({status:'cancelled'});expect(delivered).not.toHaveBeenCalled();expect(v.click).not.toHaveBeenCalled();
  }finally{if(!closed)await v.close()}
 }
});

it('retains the ordinary browser download for an omitted host callback',async()=>{
 const v=await mount({onExport:async()=>artifact('csv'),onDownload:null});
 try{await act(async()=>v.button('Export CSV').click());expect(v.click).toHaveBeenCalledOnce();}finally{await v.close()}
});
