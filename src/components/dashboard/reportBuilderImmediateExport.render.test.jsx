import React,{act,StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {useReportBuilderExportExecution} from './useReportBuilderExportExecution.js';

const request={version:1,kind:'reportExportRequest',source:{from:'draft',artifactKind:'dashboard.reportBuilder',artifactRef:'dashboard.reportBuilder://fixture',title:'Synthetic window'},target:{format:'pdf'}};
const selection={version:1,containerId:'fixture',state:{selectedMeasures:['count']}};
const artifact=()=>({kind:'immediateReportExport',format:'pdf',contentType:'application/pdf',filename:'fixture.pdf',data:btoa('%PDF-source-contract')});
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve:value=>resolve(value)}};
afterEach(()=>vi.restoreAllMocks());
async function mount(handler){
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 URL.createObjectURL=vi.fn(()=> 'blob:window-export');URL.revokeObjectURL=vi.fn();
 const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 const host=document.createElement('div'),root=createRoot(host);
 let current={handler,selection};
 let latest;
 const Harness=props=>{
  const [feedback,setFeedback]=React.useState(null);
  const output=useReportBuilderExportExecution({request,builderSelection:props.selection,windowParameters:props.parameters,tablePresentations:props.tables,reportExportHandler:props.handler,setFeedback});
  latest=output;
  return <><button onClick={()=>void output.submit()}>Export</button><output>{output.submitting?'Preparing':feedback?.message || ''}</output></>;
 };
 const render=async change=>{current={...current,...change};await act(async()=>root.render(<StrictMode><Harness {...current}/></StrictMode>));};
 await render();
 return{host,click,render,latest:()=>latest,submit:()=>act(async()=>host.querySelector('button').click()),close:()=>act(async()=>root.unmount())};
}
it('downloads immediate bytes without creating a durable job or polling history',async()=>{
 const getStatus=vi.fn(),getArtifact=vi.fn(),handler={exportCurrent:vi.fn(async()=>artifact()),getStatus,getArtifact};
 const v=await mount(handler);
 try{
  await v.submit();expect(v.click).toHaveBeenCalledOnce();expect(handler.exportCurrent.mock.calls[0][0]).toEqual({builder:selection,format:'pdf'});
  expect(v.latest().job).toBe(null);expect(v.latest().artifact).toBe(null);expect(getStatus).not.toHaveBeenCalled();expect(getArtifact).not.toHaveBeenCalled();
  expect(v.host.textContent).toContain('Downloaded PDF');
 }finally{await v.close()}
});
it('aborts changed builder state and suppresses its late download, then allows retry',async()=>{
 const pending=deferred(),handler={exportCurrent:vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(artifact())};
 const v=await mount(handler);
 try{
  await v.submit();const signal=handler.exportCurrent.mock.calls[0][1].signal;
  await v.render({selection:{...selection,state:{selectedMeasures:['other']}}});expect(signal.aborted).toBe(true);expect(v.latest().submitting).toBe(false);
  await act(async()=>pending.resolve(artifact()));expect(v.click).not.toHaveBeenCalled();
  await v.submit();expect(v.click).toHaveBeenCalledOnce();
 }finally{await v.close()}
});
it('unmount and host replacement discard pending artifacts',async()=>{
 for(const change of ['host','unmount']){
  const pending=deferred(),handler={exportCurrent:vi.fn(()=>pending.promise)},v=await mount(handler);
  await v.submit();const signal=handler.exportCurrent.mock.calls[0][1].signal;
  if(change==='host')await v.render({handler:{exportCurrent:vi.fn(async()=>artifact())}});else await v.close();
  expect(signal.aborted).toBe(true);await act(async()=>pending.resolve(artifact()));expect(v.click).not.toHaveBeenCalled();
  if(change==='host')await v.close();
 }
});
it('a replacement submission cancels the first and only releases the current artifact',async()=>{
 const first=deferred(),second=deferred(),handler={exportCurrent:vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)},v=await mount(handler);
 try{
  await v.submit();const firstSignal=handler.exportCurrent.mock.calls[0][1].signal;
  await v.submit();expect(firstSignal.aborted).toBe(true);
  await act(async()=>second.resolve(artifact()));expect(v.click).toHaveBeenCalledOnce();
  await act(async()=>first.resolve(artifact()));expect(v.click).toHaveBeenCalledOnce();expect(v.latest().submitting).toBe(false);
 }finally{await v.close()}
});
it('a live advertiser switch aborts the previous scope and snapshots the current declared parameters',async()=>{
 const pending=deferred(),handler={exportCurrent:vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(artifact())},v=await mount(handler);
 try{
  await v.render({parameters:()=>({AdvertiserId:[19],Trial:false})});await v.submit();
  const first=handler.exportCurrent.mock.calls[0];expect(first[0].parameters.AdvertiserId).toEqual([19]);
  await v.render({parameters:()=>({AdvertiserId:[42],Trial:false})});expect(first[1].signal.aborted).toBe(true);
  await act(async()=>pending.resolve(artifact()));expect(v.click).not.toHaveBeenCalled();
  await v.submit();expect(handler.exportCurrent.mock.calls[1][0].parameters).toEqual({AdvertiserId:[42],Trial:false});expect(v.click).toHaveBeenCalledOnce();
 }finally{await v.close()}
});
it('rejects malformed current results and clears pending status for retry',async()=>{
 const handler={exportCurrent:vi.fn().mockResolvedValueOnce({jobId:'not-a-current-artifact'}).mockResolvedValueOnce({...artifact(),contentType:'text/html'}).mockResolvedValue(artifact())};
 const v=await mount(handler);
 try{
  await v.submit();expect(v.host.textContent).toContain('downloadable report');expect(v.latest().submitting).toBe(false);expect(v.click).not.toHaveBeenCalled();
  await v.submit();expect(v.host.textContent).toContain('media type');expect(v.click).not.toHaveBeenCalled();
  await v.submit();expect(v.click).toHaveBeenCalledOnce();
 }finally{await v.close()}
});
it('snapshots only table presentation and cancels a result superseded by a local filter change',async()=>{
 const pending=deferred(),handler={exportCurrent:vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(artifact())},v=await mount(handler);
 try{
  await v.render({tables:{details:{filter:'East',sort:{key:'count',direction:'desc'}}}});await v.submit();
  const first=handler.exportCurrent.mock.calls[0];expect(first[0].tablePresentations).toEqual({details:{filter:'East',sort:{key:'count',direction:'desc'}}});
  await v.render({tables:{details:{filter:'West',sort:null}}});expect(first[1].signal.aborted).toBe(true);
  await act(async()=>pending.resolve(artifact()));expect(v.click).not.toHaveBeenCalled();
  await v.submit();expect(handler.exportCurrent.mock.calls[1][0].tablePresentations).toEqual({details:{filter:'West',sort:null}});expect(v.click).toHaveBeenCalledOnce();
 }finally{await v.close()}
});
