// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import ReportFilterBar from './ReportFilterBar.jsx';

it('loads choices lazily, reuses an unchanged scope, and ignores a late old-scope response', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    const host=document.createElement('div'),root=createRoot(host);
    let complete;
    const load=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}))
        .mockResolvedValue([{value:0,label:'Zero'},{value:false,label:'False'}]);
    const change=vi.fn();
    const controls=[{id:'items',label:'Items',kind:'choice',dataSourceId:'choices',inputs:{scope:'scope'},multiple:true}];
    const render=async scope=>act(async()=>root.render(<ReportFilterBar controls={controls} values={{scope}} onChange={change} loadChoices={load}/>));
    try {
        await render(1);expect(load).not.toHaveBeenCalled();
        await act(async()=>{host.querySelector('details').open=true;host.querySelector('details').dispatchEvent(new Event('toggle'));});
        expect(load).toHaveBeenCalledTimes(1);
        await render(2);
        expect(load).toHaveBeenCalledTimes(2);
        expect(load.mock.calls[0][2].signal.aborted).toBe(true);
        await act(async()=>complete([{value:99,label:'Stale'}]));
        expect(host.textContent).not.toContain('Stale');
        await act(async()=>host.querySelector('input[type=checkbox]').click());
        expect(change).toHaveBeenCalledWith('items',[0]);
        await act(async()=>{host.querySelector('details').open=false;host.querySelector('details').dispatchEvent(new Event('toggle'));});
        await act(async()=>{host.querySelector('details').open=true;host.querySelector('details').dispatchEvent(new Event('toggle'));});
        expect(load).toHaveBeenCalledTimes(2);
    } finally {await act(async()=>root.unmount());}
});

it('keeps Apply disabled while busy and exposes a retryable choice failure', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    const host=document.createElement('div'),root=createRoot(host);
    const load=vi.fn().mockRejectedValueOnce(new Error('Choice service unavailable')).mockResolvedValue([]);
    try {
        await act(async()=>root.render(<ReportFilterBar controls={[{id:'items',label:'Items',kind:'choice',dataSourceId:'choices'}]} values={{}} onChange={()=>{}} loadChoices={load} busy/>));
        expect(host.querySelector('button[type=submit]').disabled).toBe(true);
        await act(async()=>{host.querySelector('details').open=true;host.querySelector('details').dispatchEvent(new Event('toggle'));});
        expect(host.querySelector('[role=alert]').textContent).toBe('Choice service unavailable');
        await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Retry choices').click());
        expect(load).toHaveBeenCalledTimes(2);
        expect(host.querySelector('[role=alert]')).toBeNull();
    } finally {await act(async()=>root.unmount());}
});

it('supports above and both side placements without changing controlled values', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    const host=document.createElement('div'),root=createRoot(host),change=vi.fn();
    try {
        for(const [placement,expected] of [['top','top'],['left','left'],['right','right'],['rail-right','right'],['above','top']]) {
            await act(async()=>root.render(<ReportFilterBar placement={placement} controls={[{id:'search',label:'Search',kind:'text'}]} values={{search:'retained'}} onChange={change}/>));
            expect(host.querySelector('form').dataset.filterPlacement).toBe(expected);
            expect(host.querySelector('input').value).toBe('retained');
        }
        expect(change).not.toHaveBeenCalled();
    } finally {await act(async()=>root.unmount());}
});
