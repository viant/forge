import React, {act, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it} from 'vitest';
import {RetainedWindowContent} from './WindowContentMount.jsx';

it('defers restored inactive reads, preserves visited drafts, and cleans up on close', async()=>{
    globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    const host=document.createElement('div');
    const root=createRoot(host);
    let reads=0,cleanups=0;
    function Window(){
        const [draft,setDraft]=useState('');
        useEffect(()=>{reads++;return ()=>{cleanups++;};},[]);
        return <input value={draft} onInput={event=>setDraft(event.target.value)}/>;
    }
    const show=active=>act(async()=>root.render(<RetainedWindowContent active={active}><Window/></RetainedWindowContent>));
    try {
        await show(false);expect(host.querySelector('input')).toBeNull();expect(reads).toBe(0);
        await show(true);expect(reads).toBe(1);
        const input=host.querySelector('input');
        await act(async()=>{input.value='unsaved draft';input.dispatchEvent(new Event('input',{bubbles:true}));});
        await show(false);expect(cleanups).toBe(0);
        await show(true);expect(host.querySelector('input')).toBe(input);
        expect(input.value).toBe('unsaved draft');expect(reads).toBe(1);
    } finally {await act(async()=>root.unmount());}
    expect(cleanups).toBe(1);
});
