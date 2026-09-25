import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReportDesigner from './ReportDesigner.jsx';
const report = { kind: 'reportDocument', id: 'controlled', title: 'Controlled report', layout: { type: 'stack', items: [{ blockId: 'note' }] }, blocks: [
    { id: 'note', kind: 'markdownBlock', title: 'Note', markdown: 'Reader text' },
    { id: 'primaryBuilder', kind: 'reportBuilderBlock', title: 'Controlled report', source: { dataSourceRef: 'sales' }, config: { dimensions: [{ id: 'region', key: 'region', label: 'Region' }], measures: [{ id: 'revenue', key: 'revenue', label: 'Revenue' }] }, state: { selectedDimensions: ['region'], selectedMeasures: ['revenue'], primaryMeasure: 'revenue' } },
] };
const html = renderToStaticMarkup(React.createElement(ReportDesigner, { report, onChange() {}, onSave: async () => ({ status: 'result' }), onPreview: async () => ({ status: 'result' }) }));
assert.ok(html.includes('Report designer'));
assert.ok(html.includes('Report blocks'));
assert.ok(html.includes('Data Sources'));
assert.ok(html.includes('Reader text'));
assert.ok(html.includes('Show sources'));
assert.ok(!html.includes('forge-report-builder__topline'));
assert.ok(html.includes('data-report-builder-embedded="true"'));
const withoutBuilder = renderToStaticMarkup(React.createElement(ReportDesigner, { report: { id: 'plain', blocks: [{ id: 'unknown', kind: 'futureBlock', title: 'Future', payload: { keep: true } }] } }));
assert.ok(withoutBuilder.includes('Future'));
assert.ok(withoutBuilder.includes('Unsupported block'));
assert.ok(withoutBuilder.includes('read only'));
console.log('ReportDesigner.render ✓ shared design surface, controlled toolbar, unsupported node fallback');
