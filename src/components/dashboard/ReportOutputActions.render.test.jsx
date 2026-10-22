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
 const Harness=p=>{const output=useReportOutput(p);return <><ReportOutputActions {...p} output={output} cancelable/><output>{output.printModel?.title}</output></>};
 let current={scopeKey:'first',tableBlocks:[{id:'evidence',title:'Evidence'}],...props};
 const render=async change=>{current={...current,...change};await act(async()=>root.render(<StrictMode><Harness {...current}/></StrictMode>));};
 await render();return{host,render,click,button:label=>[...host.querySelectorAll('button')].find(b=>b.textContent===label),close:()=>act(async()=>root.unmount())};
}
it('downloads the chosen complete table through the shared file path',async()=>{
 const run=vi.fn(async({format})=>artifact(format)),v=await mount({onExport:run});
 try{await act(async()=>v.button('Export CSV').click());expect(run).toHaveBeenCalledTimes(1);expect(run.mock.calls[0][0]).toMatchObject({format:'csv',tableBlockId:'evidence'});expect(v.click).toHaveBeenCalledOnce();}finally{await v.close()}
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
