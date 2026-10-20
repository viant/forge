// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import WindowContent from './WindowContent.jsx';
import {SettingProvider} from '../core/context/Setting.jsx';
import {getWindowContext} from '../core/context/registry.js';
import {removeSignalsForKey} from '../core/store/signals.js';
import '../packs/blueprint/index.jsx';

it('fetches a required spread binding after the window supplies flattened values', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const windowId = 'required-spread-render';
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const transport = vi.fn(async () => ({data: [{EventDate: '2026-10-17', Avails: 9901}]}));
    const metadata = {
        dataSource: {forecast: {
            id: 'forecast', service: {uri: 'mcp://fixture/forecast'}, autoFetch: false,
            parameters: [{name: '...', in: 'windowForm', location: 'forecastRequest', required: true}],
            selectors: {data: 'data'}, selectionMode: 'none',
        }},
        view: {content: {id: 'root', dataSourceRef: 'forecast', fetchData: false}},
    };
    const settle = async (action) => act(async () => {
        action?.();
        for (let i = 0; i < 20; i++) await Promise.resolve();
    });
    try {
        await settle(() => root.render(
            <SettingProvider endpoints={{}} connectorConfig={{window: {service: {uri: '/window'}}}} services={{dataConnectorTransport: transport}}>
                <WindowContent window={{windowId, windowKey: 'fixture'}} selectedMetadata={metadata}/>
            </SettingProvider>,
        ));
        const context = getWindowContext(windowId).Context('forecast');
        await settle(() => context.handlers.dataSource.fetchCollection());
        expect(transport).not.toHaveBeenCalled();
        await settle(() => {
            context.handlers.dataSource.setWindowFormData({values: {forecastRequest: {From: '2026-10-17', To: '2026-10-17'}}});
            context.handlers.dataSource.fetchCollection();
        });
        expect(transport).toHaveBeenCalledTimes(1);
        expect(context.signals.collection.peek()).toEqual([{EventDate: '2026-10-17', Avails: 9901}]);
        await settle(() => {
            context.handlers.dataSource.setWindowFormData({values: {}, replace: true});
            context.handlers.dataSource.fetchCollection();
        });
        expect(transport).toHaveBeenCalledTimes(1);
        expect(context.signals.collection.peek()).toEqual([]);
    } finally {
        await settle(() => root.unmount());
        host.remove();
        removeSignalsForKey(windowId);
    }
});

it('an open dialog fetches each detail datasource only when its tab activates', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const windowId = 'lazy-dialog-spread-render';
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const calls = [];
    const transport = vi.fn(async request => {
        calls.push(request.dataSourceRef);
        return {data: [{caption: request.dataSourceRef}]};
    });
    const source = id => ({id, service: {uri: `mcp://fixture/${id}`}, autoFetch: false,
        parameters: [{name: '...', in: 'windowForm', location: 'forecastRequest', required: true}],
        selectors: {data: 'data'}, selectionMode: 'none'});
    const metadata = {
        dataSource: {overview: source('overview'), inventory: source('inventory')},
        view: {content: {id: 'root', dataSourceRef: 'overview', fetchData: false}},
        dialogs: [{id: 'detail', title: 'Forecast details', dataSourceRef: 'overview', fetchOnOpen: false,
            content: {id: 'detail-root', fetchData: false, containers: [{id: 'tabs',
                tabs: {renderActiveTabPanelOnly: true, keepVisitedTabPanelsMounted: true, dataSourceFetchMode: 'once', defaultSelectedTabId: 'overview-tab'},
                containers: ['overview', 'inventory'].map(id => ({id: `${id}-tab`, title: id,
                    dataSourceRef: id, fetchData: true,
                    items: [{id: `${id}-caption`, type: 'label', scope: 'collection', dataField: 'caption'}]})),
            }]},
        }],
    };
    const settle = async action => act(async () => {
        action?.();
        for (let i = 0; i < 20; i++) await Promise.resolve();
    });
    try {
        await settle(() => root.render(
            <SettingProvider endpoints={{}} connectorConfig={{window: {service: {uri: '/window'}}}} services={{dataConnectorTransport: transport}}>
                <WindowContent window={{windowId, windowKey: 'fixture'}} selectedMetadata={metadata}/>
            </SettingProvider>,
        ));
        const context = getWindowContext(windowId).Context('overview');
        await settle(() => context.handlers.dataSource.setWindowFormData({values: {forecastRequest: {From: '2026-10-17', To: '2026-10-17'}}}));
        expect(calls).toEqual([]);
        await settle(() => context.handlers.window.openDialog({context, execution: {args: ['detail', {awaitResult: false}]}}));
        expect(calls).toEqual(['overview']);
        const tab = title => [...document.querySelectorAll('[role="dialog"] [role="tab"]')].find(element => element.textContent === title);
        await settle(() => tab('inventory').click());
        expect(calls).toEqual(['overview', 'inventory']);
        await settle(() => tab('overview').click());
        await settle(() => tab('inventory').click());
        expect(calls).toEqual(['overview', 'inventory']);
    } finally {
        await settle(() => root.unmount());
        host.remove();
        removeSignalsForKey(windowId);
    }
});
