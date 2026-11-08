import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReportDesigner from './ReportDesigner.jsx';
import { calculatedCatalogConfig as config, calculatedCatalogBlocks as blocks, calculatedCatalogState as state } from './reportBuilderCalculatedCatalog.fixture.js';
const report = {
    kind: 'reportDocument', version: 1, id: 'calculatedCatalog', title: 'Calculated units',
    blocks: [...blocks, { id: 'primaryBuilder', kind: 'reportBuilderBlock', title: 'Units', source: { dataSourceRef: 'records' }, config, state }],
};
const render = candidate => renderToStaticMarkup(React.createElement(ReportDesigner, { report: candidate, onChange() {}, onSave: async () => ({ status: 'result' }) }));
const validHtml = render(report);
assert.ok(validHtml.includes('Report designer'));
assert.ok(!validHtml.includes('Report setup needs attention'));
assert.ok(!validHtml.includes('references unavailable'));
const invalidBlocks = [...blocks, { id: 'missing', kind: 'kpiBlock', datasetRef: 'observed', title: 'Missing', valueField: 'absent' }];
const invalidHtml = render({ ...report, id: 'invalidCatalog', blocks: [...invalidBlocks, { ...report.blocks.at(-1), state: { ...state, reportDocumentBlocks: invalidBlocks } }] });
assert.ok(invalidHtml.includes('Report setup needs attention'));
assert.ok(invalidHtml.includes('absent'));
console.log('PASS rendered shared editor accepts scoped outputs and displays missing-field validation');
