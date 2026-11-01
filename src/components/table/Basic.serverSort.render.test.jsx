// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {signal} from '@preact/signals-react';
import Basic from './Basic.jsx';
import {SettingProvider} from '../../core/context/Setting.jsx';

let host, root;
beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});
afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
});

async function fixture(sortMode) {
    const collection = signal([{id: 3, rank: 2}, {id: 2, rank: 1}, {id: 1, rank: 2}]);
    const signals = {
        collection, input: signal({fetch: false, page: 1}), control: signal({loaded: true, loading: false}),
        selection: signal({selected: null, rowIndex: -1, selection: []}), message: signal([]),
        form: signal({}), formStatus: signal({dirty: false, version: 1}), windowForm: signal({}), metrics: signal({}),
    };
    let complete;
    const setSort = vi.fn(() => {
        signals.control.value = {loaded: true, loading: true};
        return new Promise(resolve => {
            complete = rows => {
                collection.value = rows;
                signals.control.value = {loaded: true, loading: false};
                resolve();
            };
        });
    });
    const handlers = {dataSource: {
        setSort, fetchCollection: vi.fn(), getCollection: () => collection.peek(), peekCollection: () => collection.peek(),
        getCollectionInfo: () => ({}), isInactive: () => false, getSelection: () => signals.selection.peek(),
        isSelected: () => false, getPage: () => 1, getFilterSets: () => [], getFilterSet: () => [],
        peekFilter: () => ({}), setAllSelection() {}, resetSelection() {},
    }};
    const context = {
        identity: {windowId: 'sort-window', dataSourceRef: 'rows'}, signals, handlers,
        dataSource: {selectionMode: 'none', sortMode, backend: {kind: 'mcp_tool'}},
        tableSettingKey: () => 'sort-window',
    };
    const container = {id: 'sort-grid', table: {selectionEnabled: false, toolbar: {items: []}}};
    const columns = [
        {id: 'id', name: 'ID', visible: true, width: 100},
        {id: 'rank', name: 'Rank', visible: true, sortable: true, width: 100},
    ];
    const services = {tablePreferences: {get: async () => null, set: async () => null, reset: async () => null}};
    await act(async () => root.render(
        <SettingProvider endpoints={{}} connectorConfig={{}} services={services}>
            <Basic context={context} container={container} columns={columns}/>
        </SettingProvider>,
    ));
    return {
        collection, setSort,
        ids: () => [...host.querySelectorAll('td[data-col="id"]')].map(cell => cell.textContent.trim()).filter(Boolean),
        sort: async () => act(async () => host.querySelector('button[aria-label="Sort by Rank"]').click()),
        replace: async rows => act(async () => complete(rows)),
    };
}

it('keeps the old page order during a pending server sort and retains the replacement producer order', async () => {
    const f = await fixture('server');
    expect(f.ids()).toEqual(['3', '2', '1']);
    await f.sort();
    expect(f.setSort).toHaveBeenCalledWith({columnId: 'rank', direction: 'asc', fetch: true});
    expect(f.ids()).toEqual(['3', '2', '1']);
    // A producer can apply collation, ranking or grouping that differs from
    // a JavaScript comparator. Its returned page remains authoritative.
    await f.replace([{id: 8, rank: 2}, {id: 9, rank: 1}, {id: 7, rank: 2}]);
    expect(f.ids()).toEqual(['8', '9', '7']);
    expect(f.collection.peek().map(row => row.id)).toEqual([8, 9, 7]);
});

it('continues sorting client rows in both directions without a server request', async () => {
    const f = await fixture('client');
    await f.sort();
    expect(f.ids()).toEqual(['2', '3', '1']);
    await f.sort();
    expect(f.ids()).toEqual(['3', '1', '2']);
    expect(f.setSort).not.toHaveBeenCalled();
    expect(f.collection.peek().map(row => row.id)).toEqual([3, 2, 1]);
});
