import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import Toolbar from './Toolbar.jsx';

const signal = (value) => ({value, peek() { return this.value; }});
const context = {
    signals: {control: signal({inactive: false}), formStatus: signal({dirty: false}), selection: signal({}), windowForm: signal({}), form: signal({})},
    handlers: {dataSource: {}},
    Context() { return this; },
};
const item = {id: 'export', type: 'tableExport', label: 'Export', properties: {formats: ['csv', 'xlsx'], filename: 'records'}};

const enabled = renderToStaticMarkup(<Toolbar context={context} toolbarItems={[item]} exportRows={[{id: 1}]} exportPageRows={[{id: 1}]} exportColumns={[{id: 'id', name: 'ID'}]}/>);
assert.match(enabled, /aria-label="Export"/);
assert.match(enabled, /class="forge-toolbar-table-export"/);
assert.doesNotMatch(enabled, /disabled=""/);

const emptyRows = renderToStaticMarkup(<Toolbar context={context} toolbarItems={[item]} exportRows={[]} exportColumns={[{id: 'id', name: 'ID'}]}/>);
assert.match(emptyRows, /disabled=""/);

const emptyColumns = renderToStaticMarkup(<Toolbar context={context} toolbarItems={[item]} exportRows={[{id: 1}]} exportColumns={[{id: '__select__', multiSelect: true}]}/>);
assert.match(emptyColumns, /disabled=""/);

const toolbarSource = await import('node:fs').then(({readFileSync}) => readFileSync(new URL('./Toolbar.jsx', import.meta.url), 'utf8'));
assert.match(toolbarSource, /busyRef\.current[\s\S]*setBusy\(true\)[\s\S]*timerRef\.current = setTimeout\([\s\S]*downloadTableExport[\s\S]*setError[\s\S]*setBusy\(false\)/);
assert.match(toolbarSource, /clearTimeout\(timerRef\.current\)/);
assert.match(toolbarSource, /role="alert"/);

console.log('table export render passed');
