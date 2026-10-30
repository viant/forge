import React, {act, StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
vi.mock('@blueprintjs/core', () => ({
    Button: ({children, onClick, disabled}) => <button onClick={onClick} disabled={disabled}>{children}</button>,
    Callout: ({children, title}) => <section role="status">{title}{children}</section>,
    Spinner: () => <span/>,
    HTMLSelect: props => <select {...props}/>,
}));
vi.mock('./ReportRuntime.jsx', () => ({default: ({reportSpec,onChartMetricSelectionChange,sectionNavigation,selectedSectionId,onSectionChange,sectionLoading}) => <>
    {(sectionNavigation || (reportSpec.blocks || []).filter(block=>block.kind==='sectionBlock').map(block=>({id:block.id,label:block.title}))).map(section=><button key={section.id} onClick={()=>onSectionChange(section.id)}>{section.label}</button>)}
    {sectionLoading ? <p>Loading section…</p> : <output data-selected-section={selectedSectionId}>{reportSpec.title}</output>}
    {onChartMetricSelectionChange&&<button onClick={()=>onChartMetricSelectionChange({blockId:'trend',selection:{primaryField:'count',secondaryField:'rate'}})}>Choose metrics</button>}</>}));
vi.mock('./ReportPrintPreview.jsx', () => ({default: () => <aside>Print</aside>}));
import ReportResourceRuntime from './ReportResourceRuntime.jsx';

const pin = {uri:'report://workspace/example', kind:'stamped', revision:2,
    contentFingerprint:'a'.repeat(64), authorityBinding:'selected-principal'};
const result = (resource=pin, title='Server report') => ({resource, reportSpec:{title}, reportFill:{}});
const printedResult = (resource=pin, title='Fresh print') => ({...result(resource), reportPrint:{kind:'reportPrint', title, pages:[{number:1,elements:[]}],pageGeometry:{width:612,height:792}}});
const button = (view,label) => [...view.host.querySelectorAll('button')].find(item=>item.textContent===label);
const deferred = () => {let resolve, reject; const promise=new Promise((yes,no)=>{resolve=yes;reject=no;}); return {promise,resolve,reject};};
it('explains missing required inputs without exposing upstream details',async()=>{
    const failure=Object.assign(new Error('private-token https://internal/source'),{data:{diagnostics:[{code:'missing_report_parameter',message:'private-token'}]}});
    const view=await mount(vi.fn().mockRejectedValue(failure),{executeOnOpen:true});
    try {
        expect(view.host.textContent).toContain('Enter all required report inputs');
        expect(view.host.textContent).toContain('both a start and an end date');
        expect(view.host.textContent).not.toContain('private-token');
        expect(view.host.textContent).not.toContain('internal/source');
    } finally {await view.close();}
});
async function mount(runReport, parameters={}, storeServices={}, onViewStateChange) {
    globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    const host=document.createElement('div'), root=createRoot(host);
    const handlers={reportStore:{runReport,...storeServices}, reportRuns:{capabilities:{browserSnapshots:false},begin:vi.fn(),complete:vi.fn()},dataSource:{fetchCollection:vi.fn()}};
    const render = async (changes={}) => {parameters={...parameters,...changes};await act(async()=>root.render(
        <StrictMode><ReportResourceRuntime onViewStateChange={onViewStateChange} container={{parameters:{reportResource:pin,reportCapabilities:{run:true},...parameters}}} context={{handlers}}/></StrictMode>));};
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
        expect(view.host.textContent).toContain('This report could not be run. Please try again.');
    } finally {await view.close();}
});
it('rejects authority mismatch and surfaces producer denial without materializing data',async()=>{
    const run=vi.fn().mockResolvedValueOnce(result({...pin,authorityBinding:'other-principal'}));
    const view=await mount(run,{executeOnOpen:true});
    try {
        expect(view.host.querySelector('output')).toBeNull();
        expect(view.host.textContent).toContain('This report could not be run. Please try again.');
        run.mockRejectedValueOnce(new Error('automatic MCP protocol attempts failed: private transport details'));
        await act(async()=>view.host.querySelector('button').click());
        expect(view.host.textContent).toContain('This report could not be run. Please try again.');
        expect(view.host.textContent).not.toContain('automatic MCP protocol');
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

it('runs once per explicit host apply trigger while keeping the duplicate run control hidden',async()=>{
 const run=vi.fn().mockResolvedValue(result());
 const view=await mount(run,{executeOnOpen:false,showRunControl:false,runTrigger:0});
 try{
  expect(run).not.toHaveBeenCalled();
  expect(view.host.textContent).not.toContain('Run report');
  await view.render({executeOnOpen:true,showRunControl:false,runTrigger:1});
  expect(run).toHaveBeenCalledTimes(1);
  await view.render({executeOnOpen:true,showRunControl:false,runTrigger:1});
  expect(run).toHaveBeenCalledTimes(1);
  await view.render({executeOnOpen:true,showRunControl:false,runTrigger:2});
  expect(run).toHaveBeenCalledTimes(2);
 }finally{await view.close();}
});

it('shows real datasource progress on the shared StrictMode execution and discards stale callbacks',async()=>{
    const first=deferred(), second=deferred();
    const run=vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const view=await mount(run,{executeOnOpen:true});
    try {
        expect(run).toHaveBeenCalledTimes(1);
        const notify=run.mock.calls[0][1].onProgress;
        await act(async()=>notify({kind:'reportExecution',phase:'started',total:3,completed:0,datasetId:'sample',datasetLabel:'Sample dataset',tabs:[{id:'overview',label:'Overview'}]}));
        expect(view.host.textContent).toContain('Loading Sample dataset (Overview). 0 of 3 loaded.');
        await act(async()=>notify({kind:'reportExecution',phase:'completed',total:3,completed:1,datasetLabel:'Sample dataset'}));
        expect(view.host.textContent).toContain('Loaded Sample dataset. 1 of 3 loaded.');
        await view.render({prefill:{sampleIds:[2]}});
        await act(async()=>notify({kind:'reportExecution',phase:'completed',total:3,completed:2,datasetLabel:'Stale dataset'}));
        expect(view.host.textContent).not.toContain('Stale dataset');
        await act(async()=>second.resolve(result()));
        expect(view.host.querySelector('output').textContent).toBe('Server report');
        await act(async()=>first.resolve(result(pin,'Stale report')));
        expect(view.host.querySelector('output').textContent).toBe('Server report');
    } finally {await view.close();}
    const late=deferred(), closedRun=vi.fn(()=>late.promise), closed=await mount(closedRun,{executeOnOpen:true});
    const notify=closedRun.mock.calls[0][1].onProgress;
    await closed.close();
    await act(async()=>{notify({kind:'reportExecution',phase:'started',total:1,completed:0,datasetLabel:'Late'});late.resolve(result());});
    expect(closed.host.childNodes.length).toBe(0);
});

const sectionSnapshot = () => ({kind:'reportSectionReady',resource:pin,sectionId:'overview',sections:[{id:'overview',label:'Overview'},{id:'detail',label:'Detail'}],reportSpec:{title:'Initial section',datasets:[{id:'sample'}],blocks:[{id:'overview',kind:'sectionBlock',blockIds:['sampleTable']},{id:'sampleTable',kind:'tableBlock',datasetRef:'sample'}]},reportFill:{datasets:[{id:'sample',rows:[{amount:10}]}],blocks:[]}});

it('shows one ready section while pending tab clicks stay within the same StrictMode request',async()=>{
    const pending=deferred(),run=vi.fn(()=>pending.promise);
    const view=await mount(run,{executeOnOpen:true,reportCapabilities:{run:true,export:true}});
    try {
        expect(run).toHaveBeenCalledTimes(1);
        await act(async()=>run.mock.calls[0][1].onUpdate(sectionSnapshot()));
        expect(view.host.querySelector('output')?.textContent).toBe('Initial section');
        expect(button(view,'Print preview')?.disabled).toBe(true);
        await act(async()=>button(view,'Detail').click());
        expect(view.host.textContent).toContain('Loading section…');
        expect(view.host.querySelector('output')).toBeNull();
        expect(run).toHaveBeenCalledTimes(1);
        await act(async()=>button(view,'Overview').click());
        expect(view.host.querySelector('output')?.textContent).toBe('Initial section');
        await act(async()=>button(view,'Detail').click());
        await act(async()=>pending.resolve(result(pin,'Complete report')));
        expect(view.host.querySelector('output')?.textContent).toBe('Complete report');
        expect(view.host.querySelector('output')?.getAttribute('data-selected-section')).toBe('detail');
        expect(view.host.textContent).not.toContain('Loading section…');
        expect(run).toHaveBeenCalledTimes(1);
        run.mockResolvedValueOnce(result());
        await act(async()=>button(view,'Run report').click());
        expect(run.mock.calls[1][0].prioritySectionId).toBe('detail');
    } finally {await view.close();}
});
it('removes provisional sections on terminal failure and ignores snapshots from a stale parameter scope',async()=>{
    const first=deferred(),second=deferred(),run=vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const view=await mount(run,{executeOnOpen:true});
    try {
        const update=run.mock.calls[0][1].onUpdate;
        await act(async()=>update(sectionSnapshot()));
        expect(view.host.querySelector('output')).not.toBeNull();
        await view.render({prefill:{sampleIds:[2]}});
        expect(view.host.querySelector('output')).toBeNull();
        await act(async()=>run.mock.calls[1][1].onUpdate(sectionSnapshot()));
        await act(async()=>second.reject(Object.assign(new Error('sample denial'),{status:403})));
        expect(view.host.querySelector('output')).toBeNull();
        expect(view.host.textContent).toContain('Report unavailable');
        await act(async()=>first.resolve(result(pin,'Stale completion')));
        expect(view.host.querySelector('output')).toBeNull();
        expect(()=>update(sectionSnapshot())).not.toThrow();
    } finally {await view.close();}
});
it('rejects section snapshots that substitute authority or contain missing datasets',async()=>{
    const pending=deferred(),run=vi.fn(()=>pending.promise),view=await mount(run,{executeOnOpen:true});
    try {
        const snapshot=sectionSnapshot();snapshot.resource={...pin,authorityBinding:'different-principal'};
        expect(()=>run.mock.calls[0][1].onUpdate(snapshot)).toThrow();
        expect(view.host.querySelector('output')).toBeNull();
        await act(async()=>pending.resolve(result()));
    } finally {await view.close();}
    const next=deferred(),nextRun=vi.fn(()=>next.promise),missing=await mount(nextRun,{executeOnOpen:true});
    try {
        const snapshot=sectionSnapshot();snapshot.reportFill.datasets=[];
        expect(()=>nextRun.mock.calls[0][1].onUpdate(snapshot)).toThrow('Invalid report section snapshot');
        expect(missing.host.querySelector('output')).toBeNull();
        await act(async()=>next.resolve(result()));
    } finally {await missing.close();}
});

it('rejects malformed navigation label and ID types before rendering a snapshot',async()=>{
    const pending=deferred(),run=vi.fn(()=>pending.promise),view=await mount(run,{executeOnOpen:true});
    try {
        for(const label of [undefined,null,7,{text:'Invalid label'}]) {
            const snapshot=sectionSnapshot();snapshot.sections[1].label=label;
            expect(()=>run.mock.calls[0][1].onUpdate(snapshot)).toThrow('Invalid report section snapshot');
        }
        for(const id of [null,7,{}]) {
            const snapshot=sectionSnapshot();snapshot.sections[1].id=id;
            expect(()=>run.mock.calls[0][1].onUpdate(snapshot)).toThrow('Invalid report section snapshot');
        }
        expect(view.host.querySelector('output')).toBeNull();
        await act(async()=>pending.resolve(result()));
    } finally {await view.close();}
});

const clockStart=Date.parse('2026-01-01T00:00:00Z');
const timedPin=(until=clockStart+300_000)=>({...pin,providerIdentity:'sample-owner',validUntil:new Date(until).toISOString()});

it('refreshes near-expiry metadata once across StrictMode before starting a new run, and retains the fresh action pin',async()=>{
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(clockStart);
    const initial=timedPin(clockStart+3_000),renewed=timedPin(),metadata=deferred();
    const getReport=vi.fn(()=>metadata.promise),run=vi.fn(request=>Promise.resolve(result(request.resolvedResource)));
    const view=await mount(run,{reportResource:initial,executeOnOpen:true,prefill:{sampleIds:[7]}},{getReport});
    try {
        expect(getReport).toHaveBeenCalledTimes(1);expect(run).not.toHaveBeenCalled();
        expect(getReport.mock.calls[0][0]).toEqual({resource:{uri:initial.uri,revision:initial.revision},resolvedResource:initial,refreshMetadata:true});
        expect(view.host.textContent).toContain('Refreshing report details.');
        await act(async()=>metadata.resolve({resource:renewed}));
        expect(run).toHaveBeenCalledTimes(1);
        expect(run.mock.calls[0][0].resolvedResource).toEqual(renewed);
        expect(run.mock.calls[0][0].parameters).toEqual({sampleIds:[7]});
        expect(view.host.querySelector('output')).not.toBeNull();
        await act(async()=>button(view,'Run report').click());
        expect(run).toHaveBeenCalledTimes(2);expect(getReport).toHaveBeenCalledTimes(1);
    } finally {await view.close();vi.useRealTimers();}
});
it('keeps fresh metadata cached and refreshes expired metadata before an explicit rerun without replaying a failed dispatch',async()=>{
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(clockStart);
    const initial=timedPin(),renewed=timedPin(clockStart+700_000);
    const getReport=vi.fn().mockResolvedValue({resource:renewed});
    const run=vi.fn().mockResolvedValueOnce(result(initial)).mockRejectedValueOnce(new Error('sample dispatch failure'));
    const view=await mount(run,{reportResource:initial,executeOnOpen:true},{getReport});
    try {
        expect(getReport).not.toHaveBeenCalled();
        vi.setSystemTime(clockStart+301_000);
        await act(async()=>button(view,'Run report').click());
        expect(getReport).toHaveBeenCalledTimes(1);expect(run).toHaveBeenCalledTimes(2);
        expect(run.mock.calls[1][0].resolvedResource).toEqual(renewed);
        await view.render();
        expect(getReport).toHaveBeenCalledTimes(1);expect(run).toHaveBeenCalledTimes(2);
        expect(view.host.textContent).toContain('This report could not be run.');
    } finally {await view.close();vi.useRealTimers();}
});
it('refreshes expired Print against its new pin and preserves captured parameters while metadata refresh is visible',async()=>{
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(clockStart);
    const initial=timedPin(),renewed=timedPin(clockStart+700_000),metadata=deferred();
    const getReport=vi.fn(()=>metadata.promise);
    const run=vi.fn(request=>Promise.resolve(request.fillOnly?result(request.resolvedResource):printedResult(request.resolvedResource)));
    const view=await mount(run,{reportResource:initial,executeOnOpen:true,prefill:{sampleIds:[7]},reportCapabilities:{run:true,export:true}},{getReport});
    try {
        expect(getReport).not.toHaveBeenCalled();
        vi.setSystemTime(clockStart+301_000);
        await act(async()=>button(view,'Print preview').click());
        expect(view.host.textContent).toContain('Refreshing report details.');
        expect(run).toHaveBeenCalledTimes(1);expect(getReport).toHaveBeenCalledTimes(1);
        await act(async()=>metadata.resolve({resource:renewed}));
        expect(run).toHaveBeenCalledTimes(2);
        expect(run.mock.calls[1][0]).toEqual({resource:{uri:initial.uri,revision:initial.revision},resolvedResource:renewed,parameters:{sampleIds:[7]}});
        expect(view.host.querySelector('aside')).not.toBeNull();
        expect(view.host.textContent).not.toContain('Refreshing report details.');
    } finally {await view.close();vi.useRealTimers();}
});
it('refreshes expired Export once and retains the selected table, format and parameters',async()=>{
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(clockStart);
    const initial=timedPin(),renewed=timedPin(clockStart+700_000),metadata=deferred();
    const getReport=vi.fn(()=>metadata.promise);
    const run=vi.fn().mockResolvedValue({...result(initial),reportSpec:{title:'Sample',blocks:[{id:'sampleTable',kind:'tableBlock',title:'Sample table'}]}});
    const view=await mount(run,{reportResource:initial,executeOnOpen:true,prefill:{sampleIds:[7]},reportCapabilities:{run:true,export:true,tableBlockSelection:true}},{getReport});
    const submitResource=vi.fn().mockResolvedValue({jobId:'sample-job'});
    view.handlers.reportExport={submitResource,getStatus:vi.fn().mockResolvedValue({status:'failed',error:'Sample export stop'})};
    try {
        vi.setSystemTime(clockStart+301_000);
        await act(async()=>button(view,'Export CSV').click());
        expect(getReport).toHaveBeenCalledTimes(1);expect(submitResource).not.toHaveBeenCalled();
        expect(view.host.textContent).toContain('Refreshing report details.');
        await act(async()=>metadata.resolve({resource:renewed}));
        expect(submitResource).toHaveBeenCalledExactlyOnceWith({resource:{uri:initial.uri,revision:initial.revision},resolvedResource:renewed,parameters:{sampleIds:[7]},format:'csv',tableBlockId:'sampleTable'});
        expect(run).toHaveBeenCalledTimes(1);expect(getReport).toHaveBeenCalledTimes(1);
    } finally {await view.close();vi.useRealTimers();}
});
it('explains definition or authority changes before dispatch and never retries metadata refresh',async()=>{
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(clockStart);
    const initial=timedPin(clockStart-1),changed={...timedPin(),authorityBinding:'different-binding'};
    const getReport=vi.fn().mockResolvedValue({resource:changed}),run=vi.fn();
    const view=await mount(run,{reportResource:initial,executeOnOpen:true},{getReport});
    try {
        expect(getReport).toHaveBeenCalledTimes(1);expect(run).not.toHaveBeenCalled();
        expect(view.host.textContent).toContain('This report changed while it was open. Refresh or reopen it');
        await view.render();expect(getReport).toHaveBeenCalledTimes(1);
    } finally {await view.close();vi.useRealTimers();}
});
it('does not dispatch after a metadata refresh settles for a closed report',async()=>{
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(clockStart);
    const metadata=deferred(),getReport=vi.fn(()=>metadata.promise),run=vi.fn();
    const view=await mount(run,{reportResource:timedPin(clockStart-1),executeOnOpen:true},{getReport});
    await view.close();await act(async()=>metadata.resolve({resource:timedPin()}));
    expect(run).not.toHaveBeenCalled();expect(getReport).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
});

it('uses fresh action metadata for Run, Print and Export without any metadata reads',async()=>{
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(clockStart);
    const initial=timedPin(),getReport=vi.fn();
    const run=vi.fn(request=>Promise.resolve(request.fillOnly?result(request.resolvedResource):printedResult(request.resolvedResource)));
    const view=await mount(run,{reportResource:initial,executeOnOpen:true,reportCapabilities:{run:true,export:true}},{getReport});
    view.handlers.reportExport={submitResource:vi.fn().mockResolvedValue({jobId:'sample'}),getStatus:vi.fn().mockResolvedValue({status:'failed',error:'Sample stop'})};
    try {
        await act(async()=>button(view,'Run report').click());
        await act(async()=>button(view,'Print preview').click());
        await act(async()=>button(view,'Close print preview').click());
        await act(async()=>button(view,'Export PDF').click());
        expect(getReport).not.toHaveBeenCalled();expect(run).toHaveBeenCalledTimes(3);
        expect(view.handlers.reportExport.submitResource).toHaveBeenCalledTimes(1);
    } finally {await view.close();vi.useRealTimers();}
});
it('never refreshes or replays an already dispatched run when its cached metadata ages during execution',async()=>{
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(clockStart);
    const initial=timedPin(),pending=deferred(),getReport=vi.fn(),run=vi.fn(()=>pending.promise);
    const view=await mount(run,{reportResource:initial,executeOnOpen:true},{getReport});
    try {
        expect(run).toHaveBeenCalledTimes(1);
        vi.setSystemTime(clockStart+301_000);
        await act(async()=>run.mock.calls[0][1].onProgress({kind:'reportExecution',phase:'completed',total:2,completed:1,datasetLabel:'Sample'}));
        expect(getReport).not.toHaveBeenCalled();expect(run).toHaveBeenCalledTimes(1);
        expect(run.mock.calls[0][0].resolvedResource.validUntil).toBe(initial.validUntil);
        await act(async()=>pending.reject(new Error('sample original execution failed')));
        expect(getReport).not.toHaveBeenCalled();expect(run).toHaveBeenCalledTimes(1);
    } finally {await view.close();vi.useRealTimers();}
});

it.each([30_000,59_000])('dispatches once after accepting a new server grant with %ims remaining',async(remaining)=>{
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(clockStart);
    const initial=timedPin(clockStart-1),short=timedPin(clockStart+remaining);
    const getReport=vi.fn().mockResolvedValue({resource:short});
    const run=vi.fn(request=>Promise.resolve(result(request.resolvedResource)));
    const view=await mount(run,{reportResource:initial,executeOnOpen:true},{getReport});
    try {
        expect(getReport).toHaveBeenCalledTimes(1);expect(run).toHaveBeenCalledTimes(1);
        expect(run.mock.calls[0][0].resolvedResource).toEqual(short);
        expect(view.host.querySelector('output')?.textContent).toBe('Server report');
        await view.render();expect(getReport).toHaveBeenCalledTimes(1);expect(run).toHaveBeenCalledTimes(1);
    } finally {await view.close();vi.useRealTimers();}
});
it.each(['expired','malformed'])('rejects an %s fresh response before dispatch without retrying metadata',async(condition)=>{
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(clockStart);
    const initial=timedPin(clockStart-1),invalid={...initial,validUntil:condition==='expired'?initial.validUntil:'invalid'};
    const getReport=vi.fn().mockResolvedValue({resource:invalid}),run=vi.fn();
    const view=await mount(run,{reportResource:initial,executeOnOpen:true},{getReport});
    try {
        expect(getReport).toHaveBeenCalledTimes(1);expect(run).not.toHaveBeenCalled();
        expect(view.host.textContent).toContain('Report details are expired or invalid.');
        await view.render();expect(getReport).toHaveBeenCalledTimes(1);expect(run).not.toHaveBeenCalled();
    } finally {await view.close();vi.useRealTimers();}
});

it('publishes current report view context without copying report rows',async()=>{
 const states=[];const run=vi.fn(async()=>({...result(),reportSpec:{title:'Current report',blocks:[{kind:'tabGroupBlock',defaultSectionId:'summary'},{kind:'sectionBlock',id:'summary',title:'Summary'},{kind:'sectionBlock',id:'detail',title:'Detail'}]},reportFill:{datasets:[{rows:[{privateField:'not context'}]}]}}));
 const view=await mount(run,{executeOnOpen:true},{},value=>states.push(value));
 try {expect(states.at(-1)).toMatchObject({title:'Current report',status:'ready',activeSectionId:'summary'});await act(async()=>button(view,'Detail').click());expect(states.at(-1).activeSectionId).toBe('detail');expect(run).toHaveBeenCalledOnce();expect(JSON.stringify(states)).not.toContain('privateField');}finally{await view.close();}
});
