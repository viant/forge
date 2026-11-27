import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import MutationCommand from './primitives/MutationCommand.jsx';
import {it, expect} from 'vitest';
import WindowContent from './WindowContent.jsx';
import {SettingProvider} from '../core/context/Setting.jsx';
import {getWindowContext} from '../core/context/registry.js';
import {getDialogSignal, removeSignalsForKey} from '../core/store/signals.js';
import {executeCommand, getCommandState, retryCommandVerification} from './primitives/commandExecutor.js';
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

for (const [outcome, writerInContent] of [['acknowledged', true], ['rejected', true], ['unknown', true], ['acknowledged', false]]) {
    it('delivers the original ' + outcome + ' write without displaying its result in a replacement dialog (writer in content: ' + writerInContent + ')', async () => {
        const id = 'footer-receipt-' + outcome + '-' + writerInContent;
        const initial = {id: 'rows', dataSourceRef: 'rows', fetchData: false};
        const command = {
            commandId: 'update', dataSourceRef: 'write',
            parameters: [{name: 'rowId', in: 'input', location: 'draft.parameters.rowId'}],
            pendingState: {busy: true}, successState: {busy: false}, errorState: {busy: false}, indeterminateState: {busy: false},
            refresh: [{dataSourceRef: 'rows', bypassCache: true, clearSelection: true}],
        };
        const dialog = {
            id: 'form', title: 'Edit', dataSourceRef: 'draft', fetchOnOpen: false,
            content: {dataSourceRef: 'draft', fetchData: false, items: writerInContent ? [
                {id: 'receipt', type: 'label', dataSourceRef: 'write', scope: 'form', dataField: 'message'},
            ] : []},
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
            expect(invocations.filter(r => r.dataSourceRef === 'write')).toHaveLength(0);
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

it('retains a producer rejection across host rerenders, then scopes feedback to the writer and actor', async () => {
    const id = 'footer-context-replacement';
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    const signals = {control: signal({}), input: signal({}), form: signal({}), windowForm: signal({})};
    const dialog = getDialogSignal(id + 'Dialogedit');
    const presentation = {recordId: 17};
    dialog.value = {open: true, props: presentation};
    const pending = [];
    const target = {signals: {control: signal({}), collection: signal([])}, handlers: {dataSource: {
        setInputParameters() {},
        fetchCollection() { return new Promise((resolve, reject) => pending.push({resolve, reject})); },
    }}};
    const first = {principal: {subject: 'first', roles: ['owner']}};
    const second = {principal: {subject: 'second', roles: ['reader']}};
    const command = {commandId: 'submit', dataSourceRef: 'writer', label: 'Apply'};
    const message = 'Column names must match.';
    const status = () => host.querySelector('[data-command-phase]').textContent;
    const button = () => host.querySelector('button');
    let context;
    function draw(authority, writer = 'writer') {
        // A host publishing a notification creates a new facade for the same mounted form.
        context = {signals, authorization: authority, identity: {windowId: id, dataSourceRef: 'draft', protectedWindow: true},
            Context: () => target};
        root.render(<MutationCommand command={{...command, dataSourceRef: writer}} context={context} dialogId="edit"/>);
    }
    async function submitAndReject() {
        const prior = pending.length;
        await turn(() => button().click());
        await until(() => pending.length === prior + 1);
        await turn(() => pending[prior].reject(Object.assign(new Error(message), {status: 422, code: 'business_validation'})));
        await until(() => status() === message);
    }
    try {
        await turn(() => draw(first));
        await submitAndReject();
        const node = host.querySelector('[data-command-phase]');
        await turn(() => draw(first));
        expect(host.querySelector('[data-command-phase]')).toBe(node);
        expect(dialog.peek().props).toBe(presentation);
        expect(status()).toBe(message);

        await turn(() => draw(first, 'anotherWriter'));
        expect(status()).toBe('');
        await submitAndReject();
        await turn(() => draw(second, 'anotherWriter'));
        expect(dialog.peek().props).toBe(presentation);
        expect(status()).toBe('');

        await turn(() => button().click());
        await until(() => pending.length === 3);
        await turn(() => draw(first, 'anotherWriter'));
        await turn(() => pending[2].reject(Object.assign(new Error('Old actor rejection.'), {status: 422, code: 'business_validation'})));
        expect(status()).not.toContain('Old actor rejection.');
        await turn(() => button().click());
        await until(() => pending.length === 4);
        await turn(() => pending[3].resolve({data: []}));
        await until(() => getCommandState(context, command).phase === 'succeeded');
    } finally {
        await turn(() => root.unmount()); host.remove(); removeSignalsForKey(id);
    }
});

let readbackFixture = 0;
async function mountReadback({generated = false, resultPath = '0.data'} = {}) {
    const id = 'verified-footer-' + ++readbackFixture;
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    const invocations = [];
    const submitted = generated ? [{label: null}] : [{key: 7, label: null}, {key: 8}];
    const acknowledged = generated ? [19] : [7, 8];
    const stored = () => acknowledged.map(key => ({key, account: 41, workspace: 5, title: 'Old'}));
    let reply = () => ({rows: stored()});
    const command = {
        commandId: 'verify', dataSourceRef: 'write',
        parameters: [{name: 'items', in: 'form', location: 'draft.items'}],
        receiptIdentity: generated ? {field: 'key', generated: true} : {field: 'key', submittedRows: 'items'},
        receiptWhen: {source: 'collection', field: '0.marker', equals: 'accepted'},
        resultState: {receiptMessage: ['0.messages.0']},
        reconcile: {mode: 'refetch', resultPath, dataSourceRef: 'read', verify: {
            idsParameter: 'keys', ...(generated && {submittedRows: 'items'}),
            scope: [
                {field: 'account', parameter: {name: 'account', in: 'input', location: 'draft.parameters.account'}, passToReader: true},
                {field: 'workspace', parameter: {name: 'workspace', from: 'draft:windowform', to: 'read:input', location: 'workspace'}},
            ],
            fields: {label: 'title'},
        }},
    };
    const dialogs = [{id: 'form', title: 'Edit', dataSourceRef: 'draft', fetchOnOpen: false,
        content: {dataSourceRef: 'draft', fetchData: false},
        actions: [{id: 'save', label: 'Apply', close: true, mutationCommand: command}, {id: 'cancel', label: 'Dismiss', close: true}]}];
    const metadata = {
        dataSource: Object.fromEntries(['owner', 'draft', 'write', 'read'].map(ref => [ref, {
            service: {endpoint:'test', uri:'/'+ref, method:ref === 'write' ? 'POST' : 'GET'}, autoFetch: false, selectors: {data:'rows'},
            ...(ref === 'owner' && {selectionMode: 'multi', uniqueKey: [{field: 'key'}]}),
        }])),
        dialogs,
        view: {content: {id: 'owner', dataSourceRef: 'owner', fetchData: false, containers: [
            {id: 'readPanel', dataSourceRef: 'read', fetchData: false},
        ]}},
    };
    const transport = async request => {
        invocations.push(request);
        if (request.dataSourceRef === 'write') return {rows: [{data: acknowledged.map(key => ({key})), marker: 'accepted', messages: ['Acknowledged']}]};
        if (request.dataSourceRef === 'read') return reply();
        return {rows: []};
    };
    await turn(() => root.render(<SettingProvider endpoints={{}} services={{dataConnectorTransport:transport}}
        connectorConfig={{window:{service:{uri:'/editor'}}}}><WindowContent window={{windowId:id,windowKey:'editor'}}
        selectedMetadata={metadata}/></SettingProvider>));
    const owner = getWindowContext(id).Context('owner'), draft = owner.Context('draft');
    const dialog = getDialogSignal(id + 'Dialogform');
    const open = (account = 41) => turn(() => owner.handlers.window.openDialog({
        context: owner, parameters: {account: [account]}, execution: {args: ['form', {awaitResult: false}]},
    }));
    const selectOnOwner = rows => turn(() => {
        owner.signals.selection.value = {selection: rows, selected: rows[0], rowIndex: 0};
    });
    await selectOnOwner([{key: 7, title: 'Owner display 7'}, {key: 8, title: 'Owner display 8'}]);
    await open();
    const buttons = label => [...document.querySelectorAll('[role=dialog] button')].find(button => button.textContent.trim() === label);
    await until(() => buttons('Apply'));
    const seed = () => turn(() => {
        draft.handlers.dataSource.setEditedFormData({values: {items: submitted}});
        draft.signals.windowForm.value = {workspace: 5};
    });
    await seed();
    return {
        acknowledged, buttons, command, dialog, draft, invocations, open, seed, selectOnOwner, stored,
        setReply: next => {reply = next;},
        close: async () => {await turn(() => root.unmount()); host.remove(); removeSignalsForKey(id);},
    };
}

it('verifies nested writer identities and retries only the read from the same footer', async () => {
    const v = await mountReadback();
    try {
        await turn(() => v.buttons('Apply').click());
        await until(() => v.buttons('Retry verification'));
        expect(v.dialog.peek().open).toBe(true);
        expect(v.draft.signals.windowForm.peek().receiptMessage).toBeUndefined();
        expect(getCommandState(v.draft, v.command)).toMatchObject({phase: 'verification_failed', writerStatus: 'succeeded', syncStatus: 'verification_failed'});
        expect(v.invocations.map(r => r.dataSourceRef)).toEqual(['write', 'read']);
        expect(v.invocations[1].options).toMatchObject({inputParameters: {keys: [7, 8], account: [41]}, cache: {bypassCache: true}});
        expect(v.invocations[1].options.inputParameters).not.toHaveProperty('workspace');
        // The explicit null must be echoed by the reader; the omitted title of
        // the second row is deliberately left at its stored value.
        v.setReply(() => ({rows: [{...v.stored()[0], title: null}, v.stored()[1]]}));
        const retry = v.buttons('Retry verification');
        await turn(() => {retry.click(); retry.click();});
        await until(() => !v.dialog.peek().open);
        expect(v.invocations.map(r => r.dataSourceRef)).toEqual(['write', 'read', 'read']);
        expect(v.draft.signals.windowForm.peek().receiptMessage).toBe('Acknowledged');
    } finally {await v.close();}
});

it('does not retry or close a replacement scope after a verification failure', async () => {
    const v = await mountReadback();
    try {
        await turn(() => v.buttons('Apply').click());
        await until(() => v.buttons('Retry verification'));
        const staleRetry = v.buttons('Retry verification');
        await turn(() => {v.draft.signals.windowForm.value = {workspace: 6};});
        await turn(() => {v.draft.signals.windowForm.value = {workspace: 5};});
        expect(v.buttons('Retry verification')).toBeUndefined();
        expect(v.buttons('Apply').disabled).toBe(true);
        await turn(() => {staleRetry.click(); v.buttons('Apply').click();});
        expect(v.dialog.peek().open).toBe(true);
        expect(v.invocations.map(r => r.dataSourceRef)).toEqual(['write', 'read']);
        expect(getCommandState(v.draft, v.command)).toMatchObject({phase: 'verification_abandoned', writerStatus: 'succeeded', syncStatus: 'verification_superseded'});
        expect(v.draft.signals.windowForm.peek().receiptMessage).toBeUndefined();
        await turn(() => v.buttons('Dismiss').click());
        await until(() => !v.dialog.peek().open);
        await v.open();
        await until(() => v.buttons('Apply') && !v.buttons('Apply').disabled);
        await v.seed();
        await turn(() => v.buttons('Apply').click());
        await until(() => v.buttons('Retry verification'));
        expect(v.invocations.map(r => r.dataSourceRef)).toEqual(['write', 'read', 'write', 'read']);
    } finally {await v.close();}
});

it('verifies the generated identity with the submitted row', async () => {
    const v = await mountReadback({generated: true});
    try {
        v.setReply(() => ({rows: [{...v.stored()[0], title: null}]}));
        await turn(() => v.buttons('Apply').click());
        await until(() => !v.dialog.peek().open);
        expect(v.invocations.map(r => r.dataSourceRef)).toEqual(['write', 'read']);
        expect(v.invocations[1].options.inputParameters.keys).toEqual([19]);
    } finally {await v.close();}
});

it('does not substitute outer records for a missing explicit receipt path', async () => {
    const v = await mountReadback({resultPath: '0.missing'});
    try {
        await turn(() => v.buttons('Apply').click());
        await until(() => getCommandState(v.draft, v.command).phase === 'indeterminate');
        expect(v.invocations.map(r => r.dataSourceRef)).toEqual(['write']);
        expect(v.dialog.peek().open).toBe(true);
        expect(v.buttons('Retry verification')).toBeUndefined();
    } finally {await v.close();}
});

it('fences an in-flight read-only retry when selection changes', async () => {
    const v = await mountReadback();
    let finish;
    try {
        await turn(() => v.buttons('Apply').click());
        await until(() => v.buttons('Retry verification'));
        v.setReply(() => new Promise(resolve => {finish = resolve;}));
        await turn(() => v.buttons('Retry verification').click());
        await until(() => finish);
        await turn(() => {v.draft.signals.selection.value = {selected: {key: 9}, selection: [{key: 9}], rowIndex: 0};});
        await turn(() => finish({rows: [{...v.stored()[0], title: null}, v.stored()[1]]}));
        expect(v.dialog.peek().open).toBe(true);
        expect(v.buttons('Retry verification')).toBeUndefined();
        expect(v.draft.signals.windowForm.peek().receiptMessage).toBeUndefined();
        expect(getCommandState(v.draft, v.command)).toMatchObject({writerStatus: 'succeeded', syncStatus: 'verification_superseded'});
        expect(v.invocations.map(r => r.dataSourceRef)).toEqual(['write', 'read', 'read']);
    } finally {await v.close();}
});

it('cannot reuse an acknowledged submission after the actor changes away and back', async () => {
    const v = await mountReadback();
    const surface = document.createElement('div'); document.body.append(surface);
    const footer = createRoot(surface);
    const original = {principal: {subject: 'initiator'}};
    const draw = authority => turn(() => footer.render(<MutationCommand
        command={v.command} context={{...v.draft, authorization: authority}} dialogId="form">Apply</MutationCommand>));
    const button = () => surface.querySelector('button');
    try {
        await draw(original);
        await turn(() => button().click());
        await until(() => button()?.textContent === 'Retry verification');
        const obsoleteRetry = button();
        await draw({principal: {subject: 'replacement'}});
        await draw(original);
        expect(button().textContent).toBe('Apply');
        expect(button().disabled).toBe(true);
        await turn(() => {obsoleteRetry.click(); button().click();});
        expect(v.dialog.peek().open).toBe(true);
        expect(v.invocations.map(r => r.dataSourceRef)).toEqual(['write', 'read']);
        expect(v.draft.signals.windowForm.peek().receiptMessage).toBeUndefined();
    } finally {await turn(() => footer.unmount()); surface.remove(); await v.close();}
});

it('returns the original writer records and preserves reader errors without persisting evidence in command state', async () => {
    const v = await mountReadback({generated: true});
    const error = Object.assign(new Error('Fixture reader unavailable'), {code: 'reader_unavailable', status: 503});
    const expected = [{data: [{key: 19}], marker: 'accepted', messages: ['Acknowledged']}];
    const outcomes = [];
    try {
        v.setReply(() => {throw error;});
        let completion;
        await turn(() => {completion = executeCommand(v.draft, v.command, {}, {dialogId: 'form', onSettled: outcome => outcomes.push(outcome)});});
        const failed = await completion;
        expect(failed).toMatchObject({status: 'verification_failed', writerStatus: 'succeeded', error: {code: 'reader_unavailable'}, writerRecords: expected});
        expect(failed).not.toHaveProperty('readbackRows');
        expect(getCommandState(v.draft, v.command)).not.toHaveProperty('writerRecords');
        const row = {...v.stored()[0], title: null};
        v.setReply(() => ({rows: [row]}));
        await turn(() => {completion = retryCommandVerification(v.draft, v.command);});
        expect(await completion).toMatchObject({status: 'succeeded', writerRecords: expected, readbackRows: [row]});
        expect(outcomes.map(({status}) => status)).toEqual(['verification_failed', 'succeeded']);
        expect(getCommandState(v.draft, v.command)).not.toHaveProperty('readbackRows');
        expect(v.invocations.map(r => r.dataSourceRef)).toEqual(['write', 'read', 'read']);
    } finally {await v.close();}
});


it('fences distinct caller selection without discarding a harmless row-label refresh', async () => {
    const v = await mountReadback();
    try {
        await turn(() => v.buttons('Apply').click());
        await until(() => v.buttons('Retry verification'));
        await v.selectOnOwner([{key: 7, title: 'Updated label'}, {key: 8, title: 'Different label'}]);
        expect(v.buttons('Retry verification').disabled).toBe(false);
        const obsoleteRetry = v.buttons('Retry verification');
        await v.selectOnOwner([{key: 8, title: 'Different label'}]);
        await v.selectOnOwner([{key: 7, title: 'Updated label'}, {key: 8, title: 'Different label'}]);
        expect(v.buttons('Retry verification')).toBeUndefined();
        expect(v.buttons('Apply').disabled).toBe(true);
        expect(v.dialog.peek().open).toBe(true);
        await turn(() => {obsoleteRetry.click(); v.buttons('Apply').click();});
        expect(v.invocations.map(r => r.dataSourceRef)).toEqual(['write', 'read']);
        expect(v.draft.signals.windowForm.peek().receiptMessage).toBeUndefined();

        await turn(() => v.buttons('Dismiss').click());
        await until(() => !v.dialog.peek().open);
        await v.open();
        await v.seed();
        await until(() => v.buttons('Apply') && !v.buttons('Apply').disabled);
        await turn(() => v.buttons('Apply').click());
        await until(() => v.buttons('Retry verification'));
        expect(v.invocations.map(r => r.dataSourceRef)).toEqual(['write', 'read', 'write', 'read']);
    } finally {await v.close();}
});
