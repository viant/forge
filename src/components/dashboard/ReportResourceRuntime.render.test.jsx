import React, {act, StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
vi.mock('@blueprintjs/core', () => ({
    Button: ({children, onClick, disabled}) => <button onClick={onClick} disabled={disabled}>{children}</button>,
    Callout: ({children, title}) => <section role="status">{title}{children}</section>,
    Spinner: () => <span/>,
    HTMLSelect: props => <select {...props}/>,
}));
vi.mock('./ReportRuntime.jsx', () => ({default: ({reportSpec,onChartMetricSelectionChange}) => <><output>{reportSpec.title}</output>{onChartMetricSelectionChange&&<button onClick={()=>onChartMetricSelectionChange({blockId:'trend',selection:{primaryField:'count',secondaryField:'rate'}})}>Choose metrics</button>}</>}));
vi.mock('./ReportPrintPreview.jsx', () => ({default: () => <aside>Print</aside>}));
import ReportResourceRuntime from './ReportResourceRuntime.jsx';

const pin = {uri:'report://workspace/example', kind:'stamped', revision:2,
    contentFingerprint:'a'.repeat(64), authorityBinding:'selected-principal'};
const result = (resource=pin, title='Server report') => ({resource, reportSpec:{title}, reportFill:{}});
const printedResult = (resource=pin, title='Fresh print') => ({...result(resource), reportPrint:{kind:'reportPrint', title, pages:[{number:1,elements:[]}],pageGeometry:{width:612,height:792}}});
const button = (view,label) => [...view.host.querySelectorAll('button')].find(item=>item.textContent===label);
const deferred = () => {let resolve, reject; const promise=new Promise((yes,no)=>{resolve=yes;reject=no;}); return {promise,resolve,reject};};
async function mount(runReport, parameters={}) {
    globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    const host=document.createElement('div'), root=createRoot(host);
    const handlers={reportStore:{runReport}, reportRuns:{capabilities:{browserSnapshots:false},begin:vi.fn(),complete:vi.fn()},dataSource:{fetchCollection:vi.fn()}};
    const render = async (changes={}) => {parameters={...parameters,...changes};await act(async()=>root.render(
        <StrictMode><ReportResourceRuntime container={{parameters:{reportResource:pin,reportCapabilities:{run:true},...parameters}}} context={{handlers}}/></StrictMode>));};
    await render();
    return {host,handlers,render,close:()=>act(async()=>root.unmount())};
}
it('auto-opens once under StrictMode, preserves scope and server materialization, and allows manual rerun',async()=>{
    const pending=deferred();const run=vi.fn(()=>pending.promise);
    const view=await mount(run,{executeOnOpen:true,prefill:{advertiserIds:[42]}});
    try {
        expect(run).toHaveBeenCalledTimes(1);
        expect(run.mock.calls[0][0]).toEqual({resource:{uri:pin.uri,revision:2},resolvedResource:pin,parameters:{advertiserIds:[42]},fillOnly:true});
        await act(async()=>pending.resolve(result()));
        expect(view.host.querySelector('output').textContent).toBe('Server report');
        await view.render();expect(run).toHaveBeenCalledTimes(1);
        run.mockResolvedValueOnce(result(pin,'Rerun'));
        await act(async()=>view.host.querySelector('button').click());
        expect(run).toHaveBeenCalledTimes(2);
        expect(view.host.querySelector('output').textContent).toBe('Rerun');
        expect(view.handlers.reportRuns.begin).not.toHaveBeenCalled();
        expect(view.handlers.reportRuns.complete).not.toHaveBeenCalled();
        expect(view.handlers.dataSource.fetchCollection).not.toHaveBeenCalled();
    } finally {await view.close();}
});
it('does not execute an ordinary open, and does not execute without capability',async()=>{
    const run=vi.fn(()=>Promise.resolve(result()));const view=await mount(run);
    try {
        expect(run).not.toHaveBeenCalled();
        await view.render({executeOnOpen:true,reportCapabilities:{run:false}});
        expect(run).not.toHaveBeenCalled();
        expect(view.host.textContent).toContain('Report execution is unavailable');
    } finally {await view.close();}
});
it('rejects authority mismatch and surfaces producer denial without materializing data',async()=>{
    const run=vi.fn().mockResolvedValueOnce(result({...pin,authorityBinding:'other-principal'}));
    const view=await mount(run,{executeOnOpen:true});
    try {
        expect(view.host.querySelector('output')).toBeNull();
        expect(view.host.textContent).toContain('did not return the selected report run');
        run.mockRejectedValueOnce(new Error('Report denied'));
        await act(async()=>view.host.querySelector('button').click());
        expect(view.host.textContent).toContain('Report denied');
        expect(view.handlers.reportRuns.begin).not.toHaveBeenCalled();
        expect(view.handlers.dataSource.fetchCollection).not.toHaveBeenCalled();
    } finally {await view.close();}
});
it('discards stale selection results and ignores settlement after close',async()=>{
    const first=deferred(), second=deferred();const run=vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const view=await mount(run,{executeOnOpen:true,prefill:{advertiserIds:[1]}});
    try {
        await view.render({prefill:{advertiserIds:[2]}});expect(run).toHaveBeenCalledTimes(2);
        await act(async()=>second.resolve(result(pin,'Current selection')));
        await act(async()=>first.resolve(result(pin,'Stale selection')));
        expect(view.host.querySelector('output').textContent).toBe('Current selection');
    } finally {await view.close();}
    const closing=deferred();const closed=await mount(()=>closing.promise,{executeOnOpen:true});
    await closed.close();await act(async()=>closing.resolve(result()));
    expect(closed.host.childNodes.length).toBe(0);
});

it('reruns opted-in presentation choices and keeps scope parameters unchanged',async()=>{
 const chosen={...result(),reportSpec:{title:'Chosen report',blocks:[{id:'trend',chartSpec:{metricSelection:{primaryField:'count',secondaryField:'rate'}}}]}};
 const run=vi.fn().mockResolvedValueOnce(result()).mockResolvedValueOnce(chosen);
 const view=await mount(run,{executeOnOpen:true,prefill:{advertiserIds:[42]},reportCapabilities:{run:true,export:true,chartMetricSelection:true}});
 try{
  const button=[...view.host.querySelectorAll('button')].find(b=>b.textContent==='Choose metrics');
  await act(async()=>button.click());
  expect(run).toHaveBeenCalledTimes(2);
  expect(run.mock.calls[1][0]).toEqual({resource:{uri:pin.uri,revision:2},resolvedResource:pin,parameters:{advertiserIds:[42]},chartMetricSelections:{trend:{primaryField:'count',secondaryField:'rate'}},fillOnly:true});
  expect([...view.host.querySelectorAll('button')].find(b=>b.textContent==='Print preview').disabled).toBe(false);
 }finally{await view.close();}
});
it('blocks stale print/export after local selection when the host has not opted in',async()=>{
 const run=vi.fn().mockResolvedValue(result());
 const view=await mount(run,{executeOnOpen:true,reportCapabilities:{run:true,export:true}});
 try{
  await act(async()=>[...view.host.querySelectorAll('button')].find(b=>b.textContent==='Choose metrics').click());
  expect(run).toHaveBeenCalledTimes(1);
  expect(view.host.textContent).toContain('Chart selections cannot be exported');
  for(const label of ['Print preview','Export PDF','Export CSV','Export XLSX'])expect([...view.host.querySelectorAll('button')].find(b=>b.textContent===label).disabled).toBe(true);
  await act(async()=>view.host.querySelector('button').click());
  expect(run).toHaveBeenCalledTimes(2);
  expect(view.host.textContent).not.toContain('Chart selections cannot be exported');
 }finally{await view.close();}
});

it('metric changes cancel a pending export before stale artifact retrieval',async()=>{
 const run=vi.fn().mockResolvedValue(result());
 const view=await mount(run,{executeOnOpen:true,reportCapabilities:{run:true,export:true}});
 const status=deferred(),getArtifact=vi.fn();
 view.handlers.reportExport={submitResource:vi.fn().mockResolvedValue({jobId:'pending'}),getStatus:vi.fn(()=>status.promise),getArtifact};
 try{
  await act(async()=>[...view.host.querySelectorAll('button')].find(b=>b.textContent==='Export PDF').click());
  expect(view.handlers.reportExport.getStatus).toHaveBeenCalledTimes(1);
  await act(async()=>[...view.host.querySelectorAll('button')].find(b=>b.textContent==='Choose metrics').click());
  await act(async()=>status.resolve({status:'succeeded',artifactId:'stale'}));
  expect(getArtifact).not.toHaveBeenCalled();
  expect(view.host.textContent).not.toContain('Preparing PDF export');
  expect(view.host.textContent).toContain('Chart selections cannot be exported');
 }finally{await view.close();}
});

it('reruns metric choices after an explicitly started report without executeOnOpen',async()=>{
 const choice={primaryField:'count',secondaryField:'rate'};
 const chosen={...result(),reportSpec:{title:'Selected metrics',blocks:[{id:'trend',chartSpec:{metricSelection:choice}}]}};
 const run=vi.fn().mockResolvedValueOnce(result()).mockResolvedValueOnce(chosen);
 const view=await mount(run,{reportCapabilities:{run:true,export:true,chartMetricSelection:true}});
 try{
  expect(run).not.toHaveBeenCalled();
  await act(async()=>view.host.querySelector('button').click());
  await act(async()=>[...view.host.querySelectorAll('button')].find(b=>b.textContent==='Choose metrics').click());
  expect(run).toHaveBeenCalledTimes(2);
  expect(view.host.querySelector('output').textContent).toBe('Selected metrics');
 }finally{await view.close();}
});


it('renders a fill-only run, then prepares print only on an explicit action without blocking the report',async()=>{
 const print=deferred();
 const run=vi.fn().mockResolvedValueOnce(result()).mockReturnValueOnce(print.promise);
 const view=await mount(run,{executeOnOpen:true,prefill:{advertiserIds:[42],from:'2026-08-01'},reportCapabilities:{run:true,export:true}});
 try{
  expect(run).toHaveBeenCalledTimes(1);
  expect(run.mock.calls[0][0].fillOnly).toBe(true);
  expect(view.host.querySelector('output').textContent).toBe('Server report');
  expect(view.host.querySelector('aside')).toBeNull();
  await act(async()=>button(view,'Print preview').click());
  expect(run).toHaveBeenCalledTimes(2);
  expect(run.mock.calls[1][0]).toEqual({resource:{uri:pin.uri,revision:2},resolvedResource:pin,parameters:{advertiserIds:[42],from:'2026-08-01'}});
  expect(view.host.textContent).toContain('Preparing print preview.');
  expect(view.host.querySelector('output').textContent).toBe('Server report');
  expect(button(view,'Run report').disabled).toBe(false);
  await act(async()=>print.resolve(printedResult()));
  expect(view.host.querySelector('aside').textContent).toBe('Print');
  expect(view.host.querySelector('output')).toBeNull();
  await act(async()=>button(view,'Close print preview').click());
  expect(view.host.querySelector('output').textContent).toBe('Server report');
  expect(run).toHaveBeenCalledTimes(2);
 }finally{await view.close();}
});

it('uses the completed run snapshot for lazy Print, including exact selected metrics and scope',async()=>{
 const choice={primaryField:'count',secondaryField:'rate'};
 const chosen={...result(),reportSpec:{title:'Chosen',blocks:[{id:'trend',chartSpec:{metricSelection:choice}}]}};
 const print={...printedResult(),reportSpec:chosen.reportSpec};
 const run=vi.fn().mockResolvedValueOnce(result()).mockResolvedValueOnce(chosen).mockResolvedValueOnce(print);
 const view=await mount(run,{executeOnOpen:true,prefill:{advertiserIds:[42]},reportCapabilities:{run:true,export:true,chartMetricSelection:true}});
 try{
  await act(async()=>button(view,'Choose metrics').click());
  expect(run.mock.calls[1][0].fillOnly).toBe(true);
  await act(async()=>button(view,'Print preview').click());
  expect(run.mock.calls[2][0]).toEqual({resource:{uri:pin.uri,revision:2},resolvedResource:pin,parameters:{advertiserIds:[42]},chartMetricSelections:{trend:choice}});
  expect(view.host.querySelector('aside')).not.toBeNull();
 }finally{await view.close();}
});

it.each([
 ['missing full print',()=>Promise.resolve(result()),'did not return the selected report run'],
 ['invalid print shape',()=>Promise.resolve({...result(),reportPrint:{kind:'reportPrint',pages:null,pageGeometry:{}}}),'canonical print layout'],
 ['different authority',()=>Promise.resolve(printedResult({...pin,authorityBinding:'foreign'})),'did not return the selected report run'],
 ['producer failure',()=>Promise.reject(new Error('Producer denied print')),'Producer denied print'],
])('keeps the screen report available after %s',async(_name,prepare,message)=>{
 const run=vi.fn().mockResolvedValueOnce(result()).mockImplementationOnce(prepare);
 const view=await mount(run,{executeOnOpen:true,reportCapabilities:{run:true,export:true}});
 try{
  await act(async()=>button(view,'Print preview').click());
  expect(view.host.textContent).toContain(message);
  expect(view.host.textContent).not.toContain('Preparing print preview.');
  expect(view.host.querySelector('aside')).toBeNull();
  expect(view.host.querySelector('output').textContent).toBe('Server report');
  expect(button(view,'Run report').disabled).toBe(false);
 }finally{await view.close();}
});

it.each(['parameters','resource'])('discards a pending Print after %s changes',async(change)=>{
 const print=deferred();const nextPin=change==='resource'?{...pin,revision:3,contentFingerprint:'b'.repeat(64)}:pin;
 const run=vi.fn().mockResolvedValueOnce(result()).mockReturnValueOnce(print.promise).mockResolvedValueOnce(result(nextPin,'New selection'));
 const view=await mount(run,{executeOnOpen:true,prefill:{advertiserIds:[1]},reportCapabilities:{run:true,export:true}});
 try{
  await act(async()=>button(view,'Print preview').click());
  await view.render(change==='resource'?{reportResource:nextPin}:{prefill:{advertiserIds:[2]}});
  expect(run).toHaveBeenCalledTimes(3);
  expect(run.mock.calls[1][0].parameters).toEqual({advertiserIds:[1]});
  expect(run.mock.calls[1][0].resolvedResource).toEqual(pin);
  await act(async()=>print.resolve(printedResult()));
  expect(view.host.querySelector('aside')).toBeNull();
  expect(view.host.querySelector('output').textContent).toBe('New selection');
 }finally{await view.close();}
});

it('invalidates a pending Print when an immediately completed rerun keeps the same scope',async()=>{
 const print=deferred();const run=vi.fn().mockResolvedValueOnce(result()).mockReturnValueOnce(print.promise).mockResolvedValueOnce(result(pin,'New execution'));
 const view=await mount(run,{executeOnOpen:true,reportCapabilities:{run:true,export:true}});
 try{
  await act(async()=>button(view,'Print preview').click());
  await act(async()=>button(view,'Run report').click());
  expect(run).toHaveBeenCalledTimes(3);
  expect(run.mock.calls[2][0].fillOnly).toBe(true);
  await act(async()=>print.resolve(printedResult()));
  expect(view.host.querySelector('aside')).toBeNull();
  expect(view.host.querySelector('output').textContent).toBe('New execution');
 }finally{await view.close();}
});

it('ignores Print settlement after the report view closes',async()=>{
 const print=deferred();const run=vi.fn().mockResolvedValueOnce(result()).mockReturnValueOnce(print.promise);
 const view=await mount(run,{executeOnOpen:true,reportCapabilities:{run:true,export:true}});
 await act(async()=>button(view,'Print preview').click());
 await view.close();
 await act(async()=>print.resolve(printedResult()));
 expect(view.host.childNodes.length).toBe(0);
});

it('keeps explicit export requests full and independent of the fill-only screen run',async()=>{
 const run=vi.fn().mockResolvedValue(result());
 const view=await mount(run,{executeOnOpen:true,prefill:{advertiserIds:[42]},reportCapabilities:{run:true,export:true}});
 const submitResource=vi.fn().mockResolvedValue({jobId:'export'});
 view.handlers.reportExport={submitResource,getStatus:vi.fn().mockResolvedValue({status:'failed',error:'Expected export stop'})};
 try{
  for(const format of ['pdf','csv','xlsx']){
   await act(async()=>button(view,`Export ${format.toUpperCase()}`).click());
   expect(submitResource.mock.lastCall[0]).toEqual({resource:{uri:pin.uri,revision:2},resolvedResource:pin,parameters:{advertiserIds:[42]},format});
  }
  expect(run).toHaveBeenCalledTimes(1);
  expect(view.host.querySelector('output').textContent).toBe('Server report');
 }finally{await view.close();}
});
