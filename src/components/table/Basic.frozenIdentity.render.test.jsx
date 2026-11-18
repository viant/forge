// @vitest-environment jsdom
// Independently authored records; verifies the native table's width/theme path.
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it} from 'vitest';
import {signal} from '@preact/signals-react';
import Basic from './Basic.jsx';
import {SettingProvider} from '../../core/context/Setting.jsx';
import {ForgeThemeProvider, ForgeThemeBoundary} from '../ThemeBoundary.jsx';

it.each(['light', 'dark'])('keeps a List Page identity group frozen below the legacy half-width limit (%s)', async colorMode => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const signals = {collection: signal([{id: 1, name: 'Example record', contact: 'example@example.com'}]), input: signal({fetch: false, page: 1}), control: signal({loaded: true}), selection: signal({selection: []}), message: signal([]), form: signal({}), formStatus: signal({}), windowForm: signal({}), metrics: signal({})};
    const context = {identity: {windowId: `frozen-identity-${colorMode}`, dataSourceRef: 'rows'}, dataSource: {autoFetch: false, selectionMode: 'none'}, signals, handlers: {dataSource: {fetchCollection() {}, getCollection: () => signals.collection.value, peekCollection: () => signals.collection.peek(), getCollectionInfo: () => ({}), isInactive: () => false, getSelection: () => signals.selection.peek(), isSelected: () => false, getPage: () => 1, getFilterSets: () => [], getFilterSet: () => [], peekFilter: () => ({}), getUniqueKeyValue: row => row.id}}, tableSettingKey: () => `frozen-identity-${colorMode}`};
    const columns = [{id: 'id', name: 'ID', width: 120, sticky: 'left'}, {id: 'name', name: 'Name', width: 260, sticky: 'left'}, {id: 'contact', name: 'Contact', width: 620}];
    const render = themeId => root.render(<SettingProvider endpoints={{}} connectorConfig={{}} services={{tablePreferences: {get: async () => null}}}><ForgeThemeProvider themeId={themeId} mode={colorMode}><ForgeThemeBoundary><Basic context={context} container={{id: 'records', fetchData: false, table: {presentation: 'list-page', toolbar: {items: []}}}} columns={columns}/></ForgeThemeBoundary></ForgeThemeProvider></SettingProvider>);
    try {
        await act(async () => render('design-system-2'));
        const table = host.querySelector('.basic-table-wrapper');
        Object.defineProperty(table, 'clientWidth', {value: 600, configurable: true});
        await act(async () => window.dispatchEvent(new Event('resize')));
        const nameCell = () => host.querySelector('td[data-col="name"]');
        expect(nameCell().classList.contains('is-sticky-left')).toBe(true);
        expect(nameCell().style.left).toBe('120px');
        expect([...host.querySelectorAll('th')].find(cell=>cell.textContent==='Name').style.left).toBe('120px');
        await act(async () => render('baseline'));
        expect(nameCell().classList.contains('is-sticky-left')).toBe(false);
        expect(host.querySelector('td[data-col="id"]').classList.contains('is-sticky-left')).toBe(true);
    } finally {
        await act(async () => root.unmount());
        host.remove();
    }
});
