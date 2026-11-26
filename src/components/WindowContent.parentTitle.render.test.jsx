// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it} from 'vitest';
import {SettingProvider} from '../core/context/Setting.jsx';
import {getWindowContext} from '../core/context/registry.js';
import {activeWindows, removeSignalsForKey, selectedTabId, selectedWindowId} from '../core/store/signals.js';
import {registerPack} from '../packs/blueprint/index.jsx';
import WindowContent from './WindowContent.jsx';
import WindowManager from './WindowManager.jsx';

registerPack();

it('keeps a prepared parent warm when the window manager publishes its bound title', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const windowId = 'prepared-parent-title';
    const host = document.body.appendChild(document.createElement('div'));
    const root = createRoot(host);
    const initialWindow = {windowId, windowKey: 'record', windowTitle: 'Record', inTab: true, parameters: {RecordId: [12]}};
    const metadata = {
        namespace: 'fixture',
        actions: {code: '({prepare: ({rows}) => ({parentName: rows[0].name})})'},
        window: {titleBinding: {dataSourceRef: 'parent', source: 'data', selector: 'name'}},
        dataSource: {
            parent: {
                service: {uri: '/parent'},
                selectors: {data: 'data', metrics: 'data.0'},
                uniqueKey: [{field: 'id'}],
                parameters: [{name: 'Id', in: 'windowForm', location: 'RecordId', codec: {name: 'int[]'}}],
            },
            list: {autoFetch: false, service: {uri: '/list'}},
            draft: {autoFetch: false, service: {uri: '/draft'}},
        },
        dialogs: [{
            id: 'draftDialog',
            title: 'New draft',
            dataSourceRef: 'draft',
            fetchOnOpen: false,
            content: {id: 'draftForm', dataSourceRef: 'draft', fetchData: false},
            actions: [{id: 'cancel', label: 'Cancel', close: true}],
        }],
        view: {content: {id: 'root', containers: [
            {id: 'parentReader', dataSourceRef: 'parent', fetchData: true},
            {id: 'relatedRecords', dataSourceRef: 'list', fetchData: false, table: {columns: [{id: 'name', name: 'Name'}]},
                editableCollection: {operations: [{
                    id: 'newDraft', label: 'New draft', dialogId: 'draftDialog',
                    parameters: [{name: 'Id', in: 'windowForm', location: 'RecordId'}],
                    prepareSelection: {dataSourceRef: 'parent', parentParameter: 'Id', identityField: 'id', prepare: 'fixture.prepare'},
                }]}},
        ]}},
    };
    const reads = [];
    let release;
    const response = {data: [{id: 12, name: 'Verified parent'}]};
    const services = {
        dataConnectorTransport: async ({dataSourceRef, options}) => {
            if (dataSourceRef !== 'parent') return {data: []};
            reads.push(options.inputParameters);
            return reads.length === 1 ? new Promise(resolve => { release = () => resolve(response); }) : response;
        },
    };
    const render = (hostServices = services) => root.render(
        <SettingProvider connectorConfig={{window: {service: {uri: '/window'}}}} services={hostServices}>
            <WindowManager renderWindowContent={({window, isInTab}) =>
                <WindowContent window={window} isInTab={isInTab} selectedMetadata={metadata} />
            } />
        </SettingProvider>,
    );
    const parent = () => getWindowContext(windowId)?.Context('parent');
    const button = () => host.querySelector('button[aria-label="New draft"]');
    try {
        await act(async () => {
            activeWindows.value = [initialWindow];
            selectedTabId.value = selectedWindowId.value = windowId;
            render();
        });
        expect(reads).toEqual([{Id: [12]}]);
        const connector = parent().connector;
        await act(async () => release());
        expect(activeWindows.peek()[0].windowTitle).toBe('Verified parent');
        expect(host.textContent).toContain('Verified parent');
        await act(async () => button().click());
        expect(document.querySelector('[role="dialog"]')).toBeTruthy();
        expect(reads).toEqual([{Id: [12]}]);
        expect(parent().connector).toBe(connector);
        expect(getWindowContext(windowId).Context('draft').signals.form.peek()).toEqual({parentName: 'Verified parent'});

        const otherReads = [];
        await act(async () => [...document.querySelectorAll('[role="dialog"] button')].find(node => node.textContent === 'Cancel').click());
        await act(async () => render({dataConnectorTransport: async ({dataSourceRef, options}) => {
            if (dataSourceRef === 'parent') otherReads.push(options.inputParameters);
            return response;
        }}));
        expect(parent().connector).not.toBe(connector);
        await act(async () => button().click());
        expect(otherReads).toEqual([{Id: [12]}]);
        expect(reads).toEqual([{Id: [12]}]);
    } finally {
        await act(async () => root.unmount());
        activeWindows.value = [];
        selectedTabId.value = selectedWindowId.value = null;
        removeSignalsForKey(windowId);
        host.remove();
    }
});
