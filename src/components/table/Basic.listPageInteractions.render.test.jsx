// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {Context} from '../../core/context/Context.jsx';
import {SettingProvider} from '../../core/context/Setting.jsx';
import {ForgeThemeProvider, ForgeThemeBoundary} from '../ThemeBoundary.jsx';
import Basic from './Basic.jsx';

let host, root, owner, fixtureSequence=0;
beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    host = document.createElement('div'); document.body.append(host);
    root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); owner?.dispose(); host.remove(); });

async function fixture(mode = 'light', themeId = 'design-system-2', options = {}) {
    const rows = [{id: 1, name: 'Zulu', group: 'A', email: 'one@example.com', editable: true}, {id: 2, name: 'Alpha', group: 'B', email: 'two@example.com', editable: false}];
    const filters = [{name: 'records', default: true, template: [{id: 'group', field: 'group', label: 'Group', operator: 'in', options: [{value: 'A', label: 'Group A'}, {value: 'B', label: 'Group B'}]}, {id: 'name', field: 'name', label: 'Name', operator: 'contains'}]}];
    owner = Context(`list-interaction-test-${++fixtureSequence}`, {dataSource: {records: {autoFetch: false, selectionMode: 'none', sortMode: 'client', filterMode: 'client', uniqueKey: [{field: 'id'}], filterSet: filters}}, actions: {import: () => ({})}}, 'records');
    owner.init();
    const context = owner.Context('records');
    context.handlers.dataSource.setCollection(rows);
    context.signals.control.value = {loaded: true};
    const saved = vi.fn(async () => null);
    const services = {tablePreferences: {get: async () => options.preferences || null, set: saved}};
    const columns = [{id: 'starred', name: '', icon: 'lucide:star', tooltip: 'Starred', width: 48, sticky: 'left'}, {id: 'id', name: 'ID', width: 100, sticky: 'left', sortable: true}, {id: 'name', name: 'Name', width: 200, sticky: 'left', sortable: true}, {id: 'hidden', name: 'Hidden', visible: false}, {id: 'group', name: 'Group', width: 120, sortable: true}, {id: 'email', name: 'Email', width: 230, type: 'editableText', readOnlyWhen: {source: 'row', field: 'editable', equals: false}}];
    columns.push(...(options.columns || []));
    const render = theme => root.render(<SettingProvider endpoints={{}} connectorConfig={{}} services={services}><ForgeThemeProvider themeId={theme} mode={mode}><ForgeThemeBoundary><Basic context={context} container={{id: 'interaction-records', title: 'Records', fetchData: false, table: {presentation: 'list-page', fillRemainingWidth: options.fillRemainingWidth, toolbar: {items: options.toolbarItems || []}}}} columns={columns}/></ForgeThemeBoundary></ForgeThemeProvider></SettingProvider>);
    await act(async () => render(themeId));
    const order = () => [...host.querySelectorAll('thead th[data-column-id]')].map(node => node.dataset.columnId);
    const drag = async (from, to) => act(async () => {
        const dataTransfer = {effectAllowed: '', dropEffect: '', setData: vi.fn()};
        for (const [type, id] of [['dragstart', from], ['dragover', to], ['drop', to], ['dragend', from]]) {
            const event = new Event(type, {bubbles: true, cancelable: true});
            Object.defineProperty(event, 'dataTransfer', {value: dataTransfer});
            host.querySelector(`th[data-column-id="${id}"]`).dispatchEvent(event);
        }
    });
    return {context, saved, order, drag, render};
}

it.each(['light', 'dark'])('reorders headers through existing preferences and preserves hidden/frozen columns (%s)', async mode => {
    const f = await fixture(mode);
    await f.drag('group', 'email');
    expect(f.order()).toEqual(['starred', 'id', 'name', 'email', 'group']);
    const preferences = f.saved.mock.calls.at(-1)[1];
    expect(preferences.columns.map(column => column.id)).toEqual(['starred', 'id', 'name', 'hidden', 'email', 'group']);
    expect(preferences.columns.find(column => column.id === 'hidden').visible).toBe(false);
    await f.drag('name', 'group');
    await f.drag('starred', 'id');
    expect(f.order()).toEqual(['starred', 'id', 'name', 'email', 'group']);
    expect(f.saved).toHaveBeenCalledTimes(1);
    const email = host.querySelector('th[data-column-id="email"]');
    expect(email.querySelector('.forge-table-header-content').tabIndex).toBe(0);
    await act(async () => email.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', altKey: true, bubbles: true, cancelable: true})));
    expect(f.order()).toEqual(['starred', 'id', 'name', 'group', 'email']);
});

it.each(['light', 'dark'])('removes only the chosen applied filter using the native filter path (%s)', async mode => {
    const f = await fixture(mode);
    await act(async () => {f.context.signals.input.value = {...f.context.signals.input.peek(), filter: {group: ['A'], name: 'Zulu'}};});
    expect(host.querySelector('.forge-list-page__filters').textContent).toContain('Group: Group A');
    expect(host.querySelectorAll('.forge-list-page__filters .forge-removable-chip')).toHaveLength(2);
    await act(async () => host.querySelector('button[aria-label="Remove Group filter"]').click());
    expect(f.context.signals.input.peek().filter).toEqual({name: 'Zulu'});
    expect(host.querySelector('.forge-list-page__filters').textContent).toContain('Name: Zulu');
    expect(host.querySelector('button[aria-label="Remove Group filter"]')).toBeNull();
    await act(async () => host.querySelector('button[aria-label="Remove Name filter"]').click());
    expect(host.querySelector('.forge-list-page__filters')).toBeNull();
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
});

it.each(['light','dark'])('summarizes multiple choices per category without discarding their native values (%s)',async mode=>{
    const f=await fixture(mode);
    await act(async()=>{f.context.signals.input.value={...f.context.signals.input.peek(),filter:{group:['A','B'],name:'Alpha'}};});
    expect(host.querySelector('.forge-list-page__filters').textContent).toContain('Group: 2 Selected');
    expect(host.querySelector('.forge-list-page__filters').textContent).not.toContain('Group A, Group B');
    expect(f.context.signals.input.peek().filter.group).toEqual(['A','B']);
    await act(async()=>host.querySelector('button[aria-label="Remove Group filter"]').click());
    expect(f.context.signals.input.peek().filter).toEqual({name:'Alpha'});
});

it('keeps sorting, icon-only headers and inline read-only restrictions independent', async () => {
    await fixture();
    expect(host.querySelector('th[data-column-id="starred"] svg')).not.toBeNull();
    expect(host.querySelector('button[aria-label="Edit Email 1"]')).not.toBeNull();
    expect(host.querySelector('button[aria-label="Edit Email 2"]')).toBeNull();
    await act(async()=>host.querySelector('button[aria-label="Edit Email 1"]').click());
    expect(host.querySelector('input[aria-label="Email 1"]').readOnly).toBe(false);
    expect(host.querySelector('input[aria-label="Email 2"]')).toBeNull();
    const names = () => [...host.querySelectorAll('td[data-col="name"]')].map(node => node.textContent.trim());
    await act(async () => host.querySelector('button[aria-label="Sort by Name"]').click());
    expect(names()).toEqual(['Alpha', 'Zulu']);
    await act(async () => host.querySelector('button[aria-label="Sort by Name"]').click());
    expect(names()).toEqual(['Zulu', 'Alpha']);
});

it('restores legacy presentation when switching away from DS2', async () => {
    const f = await fixture();
    await act(async () => {f.context.signals.input.value = {...f.context.signals.input.peek(), filter: {group: ['A']}};});
    await act(async () => f.render('baseline'));
    expect(host.querySelector('.forge-list-page')).toBeNull();
    expect(host.querySelector('[draggable="true"]')).toBeNull();
    expect(host.querySelector('.forge-list-page__filter-chip')).toBeNull();
    expect(host.querySelector('th[data-column-id="starred"] svg')).toBeNull();
});

it.each(['light', 'dark'])('excludes theme-hidden columns from layout and Customize without losing other-theme preferences (%s)', async mode => {
    const f = await fixture(mode, 'design-system-2', {
        columns: [{id: 'details', name: 'Details', width: 80, hiddenInThemes: ['design-system-2']}],
        fillRemainingWidth: true,
        toolbarItems: [{id: 'settings', label: 'Customize', on: [{event: 'onClick', handler: 'table.openSetting'}]}],
        preferences: {version: 1, columns: [{id: 'details', visible: true, width: 96}], frozenColumnIds: ['details']},
    });
    const columnCount = () => host.querySelectorAll('colgroup col').length;
    expect(f.order()).not.toContain('details');
    expect(host.querySelector('td[data-col="details"]')).toBeNull();
    expect(columnCount()).toBe(f.order().length);
    await act(async () => host.querySelector('[data-testid="toolbar-btn-settings"]').click());
    const dialog = document.querySelector('.forge-table-settings');
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).not.toContain('Details');
    const allColumns = [...dialog.querySelectorAll('[role="option"]')].find(node => node.textContent === 'All Columns');
    await act(async () => allColumns.querySelector('a').click());
    expect(dialog.textContent).not.toContain('Details');
    const apply = [...dialog.querySelectorAll('button')].find(button => button.textContent === 'Apply');
    expect(apply.disabled).toBe(false);
    await act(async () => apply.click());
    expect(f.order()).not.toContain('details');
    expect(f.saved.mock.calls.at(-1)[1].columns.find(column => column.id === 'details')).toMatchObject({visible: true, width: 96});
    expect(f.saved.mock.calls.at(-1)[1].frozenColumnIds).toContain('details');
    await act(async () => f.render('baseline'));
    expect(f.order()).toContain('details');
    expect(host.querySelector('td[data-col="details"]')).not.toBeNull();
    expect(host.querySelector('th[data-column-id="details"]').style.width).toBe('96px');
    await act(async () => f.render('design-system-2'));
    expect(f.order()).not.toContain('details');
    expect(columnCount()).toBe(f.order().length);
});
