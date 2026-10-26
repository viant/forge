import React from 'react';
import assert from 'node:assert/strict';
import {act, create} from 'react-test-renderer';
import {DashboardEditableTable} from './DashboardBlocks.jsx';

let rows = [
    {Channel: 'CTV', Allocation_PCT: 30},
    {Channel: 'Video', Allocation_PCT: 25},
];
const selection = {value: {selection: [rows[0]]}};
const collection = {value: rows, peek: () => rows};
const replacements = [];
const dataSource = {
    peekFullCollection: () => rows,
    replaceCollection: ({rows: nextRows, selectAll}) => {
        replacements.push({rows: nextRows, selectAll});
        rows = nextRows;
        if (selectAll) selection.value = {selection: nextRows};
    },
};
const context = {Context: () => ({signals: {collection, selection}, handlers: {dataSource}})};
const container = {
    dataSourceRef: 'channels',
    allowAdd: false,
    allowRemove: false,
    quickFilter: false,
    columns: [
        {key: 'Channel', label: 'Media', editor: false},
        {key: 'Allocation_PCT', label: 'Mix %', editor: {type: 'number'}},
    ],
};

let view;
act(() => { view = create(<DashboardEditableTable container={container} context={context} embedded/>); });
act(() => {
    view.root.findByProps({'aria-label': 'Mix % row 1'}).props.onInput({target: {value: '35'}});
});
assert.equal(replacements.length, 1);
assert.equal(replacements[0].selectAll, false, 'cell edits must not select every row');
assert.equal(replacements[0].rows[0].Allocation_PCT, 35);
assert.deepEqual(selection.value.selection.map((row) => row.Channel), ['CTV'], 'the previously excluded row stays excluded');
act(() => view.update(<DashboardEditableTable container={{
    ...container,
    quickFilter: true,
    mobileCards: {enabled: true, titleField: 'Channel', fields: ['Allocation_PCT']},
}} context={context} embedded/>));
act(() => view.root.findByProps({className: 'forge-editable-collection__filter'}).props.onChange({target: {value: 'missing'}}));
const mobileCards = view.root.findByProps({className: 'forge-editable-collection__cards'});
assert.deepEqual(mobileCards.findByProps({className: 'forge-editable-collection__empty'}).children, ['No matching rows.']);
act(() => view.unmount());

console.log('dashboard editable table selection after edit ✓');
