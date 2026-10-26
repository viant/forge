import React from 'react';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {DashboardEditableTable, DashboardLookupChips} from './DashboardBlocks.jsx';

const rows = [{Channel: 'CTV', Reason: 'AI-generated rationale'}];
const collection = {value: rows, peek: () => rows};
const dataSource = {peekFullCollection: () => rows, peekCollection: () => rows};
const context = {
    Context: () => ({signals: {collection, selection: {value: {selection: rows}}}, handlers: {dataSource}}),
};
const columns = [
    {key: 'Channel', label: 'Media', editor: false},
    {key: 'Reason', label: 'Investment rationale', editor: false},
];
const container = {
    dataSourceRef: 'channels',
    columns,
    allowAdd: false,
    allowRemove: false,
    quickFilter: false,
    mobileCards: {enabled: true, titleField: 'Channel', fields: ['Reason']},
};

for (const [surface, markup] of [
    ['editable table', renderToStaticMarkup(<DashboardEditableTable container={container} context={context}/>)],
    ['lookup-backed editable table', renderToStaticMarkup(<DashboardLookupChips container={{
        ...container,
        editableRows: true,
        lookup: {interactionMode: 'search', selectionPresentation: 'table', options: []},
    }} context={context}/>)],
]) {
    assert.equal((markup.match(/AI-generated rationale/g) || []).length, 2, `${surface} must show read-only rationale in desktop and mobile views`);
    assert.doesNotMatch(markup, /<(?:textarea|input)[^>]*aria-label="Investment rationale row 1"/, `${surface} must not offer an editor for editor:false`);
}

console.log('dashboard editable table read-only render ✓');
