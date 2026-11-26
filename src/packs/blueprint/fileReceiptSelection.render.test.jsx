import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it, expect} from 'vitest';
import './index.jsx';
import {getWidget} from '../../runtime/widgetRegistry.jsx';
import {getEventAdapter} from '../../runtime/binding.js';
import {executeCommand} from '../../components/primitives/commandExecutor.js';
import {getDialogSignal, removeSignalsForKey} from '../../core/store/signals.js';

const signal = value => ({value, peek() {return this.value;}});
function gate() {
    let resolve, reject;
    const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
    return {promise, resolve, reject};
}

for (const kind of ['successFormState', 'clearFormFields', 'combined']) {
    it(kind + ' preserves a newer file while the browser reads it', async () => {
        const id = 'replacement-' + kind, dialogId = 'editor', item = {id:'attachment', scope:'form'};
        const original = {name:'same.csv', filename:'same.csv', data:'AQ=='};
        const form = signal({attachment:original, saved:false});
        const change = gate(), receipt = gate(), started = gate();
        let writes = 0, edits = 0;
        const writer = {handlers:{dataSource:{setInputParameters(){}, fetchCollection(){
            writes++; started.resolve(); return receipt.promise;
        }}}};
        const context = {identity:{windowId:id,dataSourceRef:'draft'}, signals:{form,windowForm:signal({})},
            Context:()=>writer, handlers:{dataSource:{setEditedFormData({values}){form.value=values;}}}};
        const adapter = {set(file){edits++; form.value={...form.value,attachment:file};}};
        const onChange = getEventAdapter('file').onChange({adapter, item, context});
        const Widget = getWidget('file'), host = document.createElement('div');
        document.body.append(host); const root = createRoot(host);
        getDialogSignal(id+'Dialog'+dialogId).value = {open:true,props:{id:1}};
        const command = {dataSourceRef:'writer',
            ...(kind !== 'successFormState' && {clearFormFields:['attachment']}),
            ...(kind === 'successFormState' && {successFormState:{attachment:null,saved:true}}),
            ...(kind === 'combined' && {successFormState:{saved:true}}),
        };
        try {
            await act(async()=>root.render(<Widget value={original} item={item} context={context} adapter={adapter} onChange={onChange}/>));
            const first = executeCommand(context,command,{}, {dialogId});
            await started.promise;
            const input=host.querySelector('input[type=file]');
            Object.defineProperty(input,'files',{configurable:true,value:[{name:'same.csv',size:1,type:'text/csv',arrayBuffer:()=>change.promise}]});
            let decoded;
            await act(async()=>{decoded=onChange({target:input});});
            expect(edits).toBe(0);
            receipt.resolve([]);
            expect((await first).status).toBe('succeeded');
            expect(form.value).toEqual({attachment:original,saved:false});
            expect((await executeCommand(context,command,{}, {dialogId})).accepted).toBe(false);
            expect(writes).toBe(1);
            change.resolve(Uint8Array.of(1).buffer);
            await act(async()=>{await decoded;});
            expect(edits).toBe(1);
            expect(form.value.attachment.data).toBe('AQ==');
            expect(form.value.attachment).not.toBe(original);
        } finally {
            change.resolve(new ArrayBuffer(1)); receipt.resolve([]);
            await act(async()=>root.unmount()); host.remove(); removeSignalsForKey(id);
        }
    });
}

it('reports a current file read failure and discards a superseded failure', async () => {
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host), Widget = getWidget('file');
    const item = {dataField:'document'}, bound=[];
    const context = {signals:{form:signal({document:{name:'first.csv'}})}};
    const adapter = {set: value => bound.push(value)};
    const onChange = getEventAdapter('file').onChange({adapter, context, item});
    try {
        await act(async()=>root.render(<Widget value={{name:'first.csv'}} item={item} context={context} adapter={adapter} onChange={onChange}/>));
        const input = host.querySelector('input[type=file]');
        const pick = async (name, read) => {
            Object.defineProperty(input,'files',{configurable:true,value:[{name,size:1,arrayBuffer:()=>read.promise}]});
            await act(async()=>{input.dispatchEvent(new Event('change',{bubbles:true}));});
        };
        const first = gate(), second = gate();
        await pick('first-replacement.csv',first); await pick('second-replacement.csv',second);
        await act(async()=>{first.reject(new Error('First read failed'));});
        expect(host.querySelector('[role=alert]')).toBeNull();
        await act(async()=>{second.reject(new Error('Second read failed'));});
        expect(host.querySelector('[role=alert]').textContent).toContain('Could not read the selected file');
        expect(bound).toEqual([]);
        const retry = gate(); await pick('retry.csv',retry);
        expect(host.querySelector('[role=alert]')).toBeNull();
        await act(async()=>{retry.resolve(Uint8Array.of(42).buffer);});
        expect(bound.map(file => file.name)).toEqual(['retry.csv']);
    } finally {await act(async()=>root.unmount()); host.remove();}
});
