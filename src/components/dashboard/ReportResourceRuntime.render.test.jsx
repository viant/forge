import React, {act, StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
vi.mock('@blueprintjs/core', () => ({
    Button: ({children, onClick, disabled}) => <button onClick={onClick} disabled={disabled}>{children}</button>,
    Callout: ({children, title}) => <section role="status">{title}{children}</section>,
    Spinner: () => <span/>,
}));
vi.mock('./ReportRuntime.jsx', () => ({default: ({reportSpec}) => <output>{reportSpec.title}</output>}));
vi.mock('./ReportPrintPreview.jsx', () => ({default: () => <aside>Print</aside>}));
import ReportResourceRuntime from './ReportResourceRuntime.jsx';

const pin = {uri:'report://workspace/example', kind:'stamped', revision:2,
    contentFingerprint:'a'.repeat(64), authorityBinding:'selected-principal'};
const result = (resource=pin, title='Server report') => ({resource, reportSpec:{title}, reportFill:{}, reportPrint:{}});
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
        expect(run.mock.calls[0][0]).toEqual({resource:{uri:pin.uri,revision:2},resolvedResource:pin,parameters:{advertiserIds:[42]}});
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
