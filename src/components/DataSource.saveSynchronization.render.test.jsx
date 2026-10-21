import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import WindowContent from './WindowContent.jsx';
import {SettingProvider} from '../core/context/Setting.jsx';
import {getWindowContext} from '../core/context/registry.js';
import {removeSignalsForKey} from '../core/store/signals.js';
import {executeCommand, getCommandState} from './primitives/commandExecutor.js';
import '../packs/blueprint/index.jsx';

let index = 0;
async function mount() {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const windowId = `saved-projection-${++index}`, host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    let row = {id: 7, name: 'Original', channels: ['DISPLAY']};
    const transport = vi.fn(async request => {
        if (request.dataSourceRef === 'writer') {
            row = {...row, name: 'Normalized'};
            return {data: [{id: 7}]};
        }
        return {data: [row]};
    });
    const metadata = {
        dataSource: {
            record: {id: 'record', service: {uri: 'mcp://fixture/record'}, uniqueKey: [{field: 'id'}], selectors: {data: 'data'}, selectionMode: 'single'},
            writer: {id: 'writer', service: {uri: 'mcp://fixture/write'}, autoFetch: false},
            properties: {id: 'properties', dataSourceRef: 'record', uniqueKey: [{field: 'id'}], selectors: {metrics: '.'}, selectionMode: 'single'},
            defaults: {id: 'defaults', dataSourceRef: 'record', uniqueKey: [{field: 'id'}], selectors: {metrics: '.'}, selectionMode: 'single'},
        },
        view: {dataSourceRef: 'properties', content: {id: 'root', containers: [
            {id: 'propertiesPanel', dataSourceRef: 'properties', fetchData: true,
                draftForm: {dataSourceRef: 'properties', submit: {dataSourceRef: 'writer', refresh: [{dataSourceRef: 'properties', bypassCache: true}]}}},
            {id: 'defaultsPanel', dataSourceRef: 'defaults', fetchData: true},
            {id: 'writerPanel', dataSourceRef: 'writer', fetchData: false},
        ]}},
    };
    const settle = async fn => act(async () => {fn?.(); for (let n = 0; n < 60; n++) await Promise.resolve();});
    await settle(() => root.render(<SettingProvider endpoints={{}} connectorConfig={{window: {service: {uri: '/window'}}}} services={{dataConnectorTransport: transport}}><WindowContent window={{windowId, windowKey: 'fixture'}} selectedMetadata={metadata}/></SettingProvider>));
    const context = getWindowContext(windowId), properties = context.Context('properties'), defaults = context.Context('defaults');
    const edit = (target, patch) => settle(() => target.handlers.dataSource.setEditedFormData({values: {...target.signals.form.peek(), ...patch}}));
    const command = {dataSourceRef: 'writer', synchronizeForm: true, refresh: [{dataSourceRef: 'properties', bypassCache: true}]};
    return {context, properties, defaults, command, transport, settle, edit, host, setRow: value => {row = value;},
        close: async () => {await settle(() => root.unmount()); host.remove(); removeSignalsForKey(windowId);}};
}

it('DraftForm save accepts normalized readback and keeps the sibling draft dirty', async () => {
    const v = await mount();
    try {
        await v.edit(v.properties, {name: ' submitted '});
        await v.edit(v.defaults, {channels: ['VIDEO']});
        const save = [...v.host.querySelectorAll('button')].find(button => button.textContent === 'Save');
        expect(save).toBeDefined();
        await v.settle(() => save.click());
        expect(v.properties.signals.form.peek().name).toBe('Normalized');
        expect(v.properties.signals.formStatus.peek().dirty).toBe(false);
        expect(v.defaults.signals.form.peek().channels).toEqual(['VIDEO']);
        expect(v.defaults.signals.formStatus.peek().dirty).toBe(true);
        expect(v.transport.mock.calls.filter(([request]) => request.dataSourceRef === 'writer')).toHaveLength(1);
    } finally {await v.close();}
});

it('writer failure and cancelled confirmation retain the initiating draft', async () => {
    const v = await mount();
    try {
        await v.edit(v.properties, {name: 'Keep me'});
        v.transport.mockRejectedValueOnce(new Error('Write failed'));
        let result;
        await v.settle(() => {result = executeCommand(v.properties, v.command);});
        expect((await result).status).toBe('failed');
        expect(v.properties.signals.form.peek().name).toBe('Keep me');
        expect(v.properties.signals.formStatus.peek().dirty).toBe(true);
        await v.settle(() => {result = executeCommand(v.properties, {...v.command, confirm: 'Continue?'}, {}, {confirm: async () => false});});
        expect((await result).status).toBe('cancelled');
        expect(v.properties.signals.form.peek().name).toBe('Keep me');
        expect(v.properties.signals.formStatus.peek().dirty).toBe(true);
        expect(v.transport).toHaveBeenCalledTimes(2);
    } finally {await v.close();}
});

it('programmatic edits during writer and readback waits survive synchronization', async () => {
    const v = await mount();
    try {
        await v.edit(v.properties, {name: 'Submitted'});
        let finishWrite, finishRead, result;
        v.transport.mockImplementationOnce(() => new Promise(resolve => {finishWrite = resolve;}));
        v.transport.mockImplementationOnce(() => new Promise(resolve => {finishRead = resolve;}));
        await v.settle(() => {result = executeCommand(v.properties, v.command);});
        await v.edit(v.properties, {name: 'Newer draft'});
        await v.settle(() => finishWrite({data: [{id: 7}]}));
        await v.edit(v.properties, {name: 'Newest draft'});
        await v.settle(() => finishRead({data: [{id: 7, name: 'Normalized', channels: ['DISPLAY']}]}));
        expect((await result).status).toBe('succeeded');
        expect(v.properties.signals.collection.peek()[0].name).toBe('Normalized');
        expect(v.properties.signals.form.peek().name).toBe('Newest draft');
        expect(v.properties.signals.formStatus.peek().dirty).toBe(true);
    } finally {await v.close();}
});

it('simultaneous explicit local refreshes share one parent dispatch and settle every caller', async () => {
    const v = await mount();
    try {
        let finish, first, second;
        v.transport.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
        await v.settle(() => {
            first = v.properties.handlers.dataSource.fetchCollection({cache: {bypassCache: true}, invocationId: 'first'});
            second = v.defaults.handlers.dataSource.fetchCollection({cache: {bypassCache: true}, invocationId: 'second'});
        });
        expect(v.transport).toHaveBeenCalledTimes(2);
        await v.settle(() => finish({data: [{id: 7, name: 'Refreshed', channels: ['CTV']}]}));
        await expect(Promise.all([first, second])).resolves.toHaveLength(2);
        expect(v.transport).toHaveBeenCalledTimes(2);
        expect(v.properties.signals.control.peek().loading).toBe(false);
        expect(v.defaults.signals.control.peek().loading).toBe(false);
    } finally {await v.close();}
});

it('a second local caller joining an in-flight parent read does not queue another read', async () => {
    const v = await mount();
    try {
        let finish, first, second;
        v.transport.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
        await v.settle(() => {first = v.properties.handlers.dataSource.fetchCollection({cache: {bypassCache: true}, invocationId: 'started'});});
        await v.settle(() => {second = v.defaults.handlers.dataSource.fetchCollection({cache: {bypassCache: true}, invocationId: 'joining'});});
        await v.settle(() => finish({data: [{id: 7, name: 'Joined', channels: ['CTV']}]}));
        await expect(Promise.all([first, second])).resolves.toHaveLength(2);
        expect(v.transport).toHaveBeenCalledTimes(2);
    } finally {await v.close();}
});

it('a failed normalized readback settles with a warning and preserves drafts for retry', async () => {
    const v = await mount();
    try {
        await v.edit(v.properties, {name: 'Submitted'});
        await v.edit(v.defaults, {channels: ['VIDEO']});
        v.transport.mockResolvedValueOnce({data: [{id: 7}]}).mockRejectedValueOnce(new Error('Temporary read failure'));
        const save = [...v.host.querySelectorAll('button')].find(button => button.textContent === 'Save');
        await v.settle(() => save.click());
        const outcome = getCommandState(v.properties, {commandId: 'propertiesPanel:submit'});
        expect(outcome.phase).toBe('succeeded');
        expect(outcome.warnings).toHaveLength(1);
        expect(v.properties.signals.form.peek().name).toBe('Submitted');
        expect(v.properties.signals.formStatus.peek().dirty).toBe(true);
        expect(v.defaults.signals.form.peek().channels).toEqual(['VIDEO']);
        expect(v.defaults.signals.formStatus.peek().dirty).toBe(true);
        expect(v.properties.signals.input.peek().formSynchronization).toBeNull();
    } finally {await v.close();}
});

it('coalescing is scoped to resolved read arguments and never absorbs a direct writer dispatch', async () => {
    const {useDataSourceHandlers} = await import('../hooks/dataSource.js');
    const {signal} = await import('@preact/signals-react');
    const {settleDataSourceRequest} = await import('./dataSourceRequestLifecycle.js');
    const input = signal({parameters: {Id: [7]}, sort: [{columnId: 'name', direction: 'asc'}]});
    const signals = {input, control: signal({}), form: signal({}), selection: signal({}), collection: signal([]), collectionInfo: signal({}), formStatus: signal({dirty: false, version: 0})};
    const identity = {windowId: `read-identity-${++index}`, dataSourceId: `read-source-${index}`, dataSourceRef: 'rows'};
    const handlers = useDataSourceHandlers(identity, signals, {rows: {}}, {});
    const first = handlers.fetchCollection({sharedRead: true, cache: {bypassCache: true}});
    const join = handlers.fetchCollection({sharedRead: true, cache: {bypassCache: true}});
    expect(join).toBe(first);
    input.value = {...input.peek(), parameters: {Id: [8]}};
    const differentArgs = handlers.fetchCollection({sharedRead: true, cache: {bypassCache: true}});
    expect(differentArgs).not.toBe(first);
    await expect(first).rejects.toMatchObject({code: 'request_superseded'});
    settleDataSourceRequest(identity.dataSourceId, input.peek().invocationId, null, []);
    await expect(differentArgs).resolves.toEqual([]);
    const sortedRead = handlers.fetchCollection({sharedRead: true, cache: {bypassCache: true}});
    input.value = {...input.peek(), sort: [{columnId: 'name', direction: 'desc'}]};
    const changedSort = handlers.fetchCollection({sharedRead: true, cache: {bypassCache: true}});
    expect(changedSort).not.toBe(sortedRead);
    await expect(sortedRead).rejects.toMatchObject({code: 'request_superseded'});
    settleDataSourceRequest(identity.dataSourceId, input.peek().invocationId, null, []);
    await changedSort;
    const actorRead = handlers.fetchCollection({sharedRead: true, cache: {bypassCache: true}});
    const {clearProtectedWindowState} = await import('../core/store/signals.js');
    clearProtectedWindowState(identity.windowId);
    const newActorRead = handlers.fetchCollection({sharedRead: true, cache: {bypassCache: true}});
    expect(newActorRead).not.toBe(actorRead);
    await expect(actorRead).rejects.toMatchObject({code: 'request_superseded'});
    settleDataSourceRequest(identity.dataSourceId, input.peek().invocationId, null, []);
    await newActorRead;
    const read = handlers.fetchCollection({sharedRead: true, cache: {bypassCache: true}});
    const write = handlers.fetchCollection({cache: {bypassCache: true}, invocationId: 'direct-writer'});
    expect(write).not.toBe(read);
    expect(input.peek().invocationId).toBe('direct-writer');
    await expect(read).rejects.toMatchObject({code: 'request_superseded'});
    settleDataSourceRequest(identity.dataSourceId, 'direct-writer', null, []);
    await expect(write).resolves.toEqual([]);
});

it('a saved draft becomes clean when normalization returns the unchanged server baseline', async () => {
    const v = await mount();
    try {
        await v.edit(v.properties, {name: ' Original '});
        // The writer normalizes back to the record that was already loaded.
        v.transport.mockResolvedValueOnce({data: [{id: 7}]});
        const save = [...v.host.querySelectorAll('button')].find(button => button.textContent === 'Save');
        await v.settle(() => save.click());
        expect(v.properties.signals.collection.peek()[0].name).toBe('Original');
        expect(v.properties.signals.form.peek().name).toBe('Original');
        expect(v.properties.signals.formStatus.peek().dirty).toBe(false);
    } finally {await v.close();}
});
