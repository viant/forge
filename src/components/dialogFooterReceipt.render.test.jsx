import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it, expect} from 'vitest';
import WindowContent from './WindowContent.jsx';
import {SettingProvider} from '../core/context/Setting.jsx';
import {getWindowContext} from '../core/context/registry.js';
import {removeSignalsForKey} from '../core/store/signals.js';
import {getCommandState} from './primitives/commandExecutor.js';
import '../packs/blueprint/index.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} };
HTMLElement.prototype.scrollIntoView ||= function () {};
const turn = (fn) => act(async () => { fn?.(); await new Promise(resolve => setTimeout(resolve, 20)); });
async function until(check) {
    const end = Date.now() + 4000;
    while (!check() && Date.now() < end) await turn();
    expect(Boolean(check())).toBe(true);
}

for (const outcome of ['acknowledged', 'rejected', 'unknown']) {
    it('delivers the original ' + outcome + ' write without displaying its result in a replacement dialog', async () => {
        const id = 'footer-receipt-' + outcome;
        const initial = {id: 'rows', dataSourceRef: 'rows', fetchData: false};
        const command = {
            commandId: 'update', dataSourceRef: 'write',
            parameters: [{name: 'rowId', in: 'input', location: 'draft.parameters.rowId'}],
            pendingState: {busy: true}, successState: {busy: false}, errorState: {busy: false}, indeterminateState: {busy: false},
            refresh: [{dataSourceRef: 'rows', bypassCache: true, clearSelection: true}],
        };
        const dialog = {
            id: 'form', title: 'Edit', dataSourceRef: 'draft', fetchOnOpen: false,
            content: {dataSourceRef: 'draft', fetchData: false, items: [
                {id: 'receipt', type: 'label', dataSourceRef: 'write', scope: 'form', dataField: 'message'},
            ]},
            actions: [{id: 'cancel', label: 'Dismiss', close: true}, {id: 'save', label: 'Apply', mutationCommand: command}],
        };
        const dataSource = Object.fromEntries(['rows', 'draft', 'write'].map(ref => [ref, {
            service: {endpoint:'test', uri:'/'+ref, method:'POST'}, autoFetch: false, replayPendingFetchOnRestore: false, selectors: {data:'rows'},
        }]));
        const metadata = {windowKey:'editor', namespace:'Editor', dataSource, dialogs:[dialog], view:{content:initial}};
        const host = document.createElement('div');
        document.body.append(host);
        const root = createRoot(host);
        const invocations = [];
        let resolveWrite, rejectWrite;
        const deferred = new Promise((yes, no) => { resolveWrite = yes; rejectWrite = no; });
        const transport = async request => {
            invocations.push(request);
            return request.dataSourceRef === 'write' ? deferred : {rows: [{id:2}]};
        };
        const button = label => [...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === label);
        const feedback = () => document.querySelector('[role=dialog] .forge-mutation-command__status')?.textContent;
        try {
            await turn(() => root.render(<SettingProvider endpoints={{}} services={{dataConnectorTransport:transport}}
                connectorConfig={{window:{service:{uri:'/editor'}}}}><WindowContent window={{windowId:id,windowKey:'editor'}}
                selectedMetadata={metadata}/></SettingProvider>));
            const owner = getWindowContext(id).Context('rows'), source = owner.Context('draft');
            const open = rowId => owner.handlers.window.openDialog({context:owner,parameters:{rowId},execution:{args:['form',{awaitResult:false}]}});
            await turn(() => open(1)); await until(() => button('Apply'));
            await turn(() => button('Apply').click()); await until(() => invocations.some(r => r.dataSourceRef === 'write'));
            await turn(() => button('Dismiss').click()); await until(() => !button('Apply'));
            await turn(() => open(2)); await until(() => button('Apply'));
            await turn(() => {owner.signals.selection.value={selected:{id:2},selection:[{id:2}],rowIndex:0};});
            expect(source.signals.input.peek().parameters.rowId).toBe(2);
            expect(source.signals.windowForm.peek().busy).toBe(true);
            expect(getCommandState(source,command).writerStatus).toBe('pending');
            expect(feedback()).not.toBe('Completed');

            const before = invocations.filter(r=>r.dataSourceRef==='rows').length;
            if (outcome === 'acknowledged') await turn(() => resolveWrite({rows:[]}));
            else if (outcome === 'rejected') await turn(() => rejectWrite(Object.assign(new Error('Denied'),{status:403,code:'forbidden'})));
            else await turn(() => rejectWrite(Object.assign(new Error('Connection lost'),{code:'request_superseded'})));
            const expected = {acknowledged:'succeeded',rejected:'failed',unknown:'indeterminate'}[outcome];
            await until(() => getCommandState(source,command).writerStatus === expected);
            expect(getCommandState(source,command).guarded).toBe(outcome === 'unknown');
            expect(source.signals.windowForm.peek().busy).toBe(false);
            expect(source.signals.input.peek().parameters.rowId).toBe(2);
            expect(owner.signals.selection.peek().selected?.id).toBe(2);
            if (outcome === 'unknown') expect(feedback()).toMatch(/previous submission/i);
            else expect(feedback()).toBe('');
            expect(invocations.filter(r=>r.dataSourceRef==='rows')).toHaveLength(before + (outcome==='acknowledged'?1:0));
            expect(invocations.filter(r=>r.dataSourceRef==='write').map(r=>r.options.inputParameters)).toEqual([{rowId:1}]);
        } finally {
            resolveWrite({rows:[]}); await turn(() => root.unmount()); host.remove(); removeSignalsForKey(id);
        }
    });
}
