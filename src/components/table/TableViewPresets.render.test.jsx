import React, {act, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import TableViewPresets from './TableViewPresets.jsx';
import {useTableViews} from './useTableViews.js';

let host, root;
beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {await act(async () => root.unmount()); host.remove();});
const baseColumns = [{id: 'a', name: 'Attribute', visible: true}, {id: 'b', name: 'Reach', visible: true}];
const preferences = {version: 1, columns: [{id: 'b', visible: false}, {id: 'a', visible: true}], density: 'compact'};
function Harness({adapter, viewKey = 'grid', active = true}) {
    const model = useTableViews({adapter, config: {key: viewKey}, active});
    const [columns, setColumns] = useState(baseColumns);
    return <><TableViewPresets model={model} columns={columns} baseColumns={baseColumns} density="normal"
        onApply={setColumns}/><output>{JSON.stringify(columns)}</output></>;
}
const button = name => [...host.querySelectorAll('button')].find(element => element.textContent === name);
async function change(element, value) {
    await act(async () => {
        const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
        element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true}));
    });
}

it('loads named views, applies order/visibility, updates, creates and deletes through the host adapter', async () => {
    let rows = [{id: 7, name: 'Existing', preferences}];
    const adapter = {
        list: vi.fn(async () => rows),
        save: vi.fn(async (_, input) => {rows = [{...input, id: input.id ?? 8}];}),
        remove: vi.fn(async () => {rows = [];}),
    };
    await act(async () => root.render(<Harness adapter={adapter}/>));
    expect(adapter.list).toHaveBeenCalledWith('grid');
    expect(button('Add selection as preset').disabled).toBe(true);
    await change(host.querySelector('select'), '7');
    expect(JSON.parse(host.querySelector('output').textContent).map(column => [column.id, column.visible])).toEqual([['b', false], ['a', true]]);
    expect(host.querySelector('input').value).toBe('Existing');
    await change(host.querySelector('input'), 'Renamed');
    await act(async () => button('Update view').click());
    expect(adapter.save.mock.calls[0][0]).toBe('grid');
    expect(adapter.save.mock.calls[0][1]).toMatchObject({id: 7, name: 'Renamed', preferences: {columns: [{id: 'b', visible: false}, {id: 'a', visible: true}]}});
    await act(async () => button('Delete view').click());
    expect(adapter.remove).toHaveBeenCalledWith('grid', 7);
    expect(host.querySelector('input').value).toBe('');
    await act(async () => button('All columns').click());
    expect(JSON.parse(host.querySelector('output').textContent).every(column => column.visible)).toBe(true);
    await change(host.querySelector('input'), 'New');
    await act(async () => button('Add selection as preset').click());
    expect(adapter.save.mock.calls.at(-1)[1]).toMatchObject({name: 'New'});
    expect(adapter.save.mock.calls.at(-1)[1]).not.toHaveProperty('id');
});

it('does not read while closed and replaces the session when the host actor adapter changes', async () => {
    let resolveOld;
    const old = {list: vi.fn(() => new Promise(resolve => {resolveOld = resolve;}))};
    const next = {list: vi.fn(async () => [{id: 2, name: 'New actor view', preferences}])};
    await act(async () => root.render(<Harness adapter={old} active={false}/>));
    expect(old.list).not.toHaveBeenCalled();
    await act(async () => root.render(<Harness adapter={old}/>));
    await act(async () => root.render(<Harness adapter={next}/>));
    await act(async () => resolveOld([{id: 1, name: 'Old actor view', preferences}]));
    expect(host.textContent).toContain('New actor view');
    expect(host.textContent).not.toContain('Old actor view');
});

it('shows missing-provider and producer errors with a retry action', async () => {
    await act(async () => root.render(<Harness/>));
    expect(host.querySelector('[role="alert"]').textContent).toContain('provider is unavailable');
    await change(host.querySelector('input'), 'No provider');
    expect(button('Add selection as preset').disabled).toBe(true);
    const adapter = {list: vi.fn().mockRejectedValueOnce(new Error('Producer unavailable')).mockResolvedValue([])};
    await act(async () => root.render(<Harness adapter={adapter}/>));
    expect(host.querySelector('[role="alert"]').textContent).toContain('Producer unavailable');
    await act(async () => button('Retry saved views').click());
    expect(host.querySelector('[role="alert"]')).toBeNull();
});
