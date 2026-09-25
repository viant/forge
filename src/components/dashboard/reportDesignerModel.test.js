import assert from 'node:assert/strict';
import { prepareEmbeddedReport, applyEmbeddedReportChange, addEmbeddedDataset, validateProviderDatasetDeclaration, validateProviderSourceSelection, replaceEmbeddedDataset } from './reportDesignerModel.js';
const report = {
    version: 1, kind: 'reportDocument', id: 'native', title: 'Native report',
    customMetadata: { keep: true }, datasets: [{ id: 'sales', dataSourceRef: 'published.sales', request: { scope: 'active' }, unknown: 'retain' }],
    scope: { params: [{ id: 'time', value: 'current' }], custom: true },
    layout: { type: 'stack', items: [{ blockId: 'primaryBuilder' }, { blockId: 'unknown' }, { blockId: 'note' }], extra: 'keep' },
    blocks: [
        { id: 'primaryBuilder', kind: 'reportBuilderBlock', source: { serviceRef: 'service.v1' }, config: { dimensions: [{ id: 'region', key: 'region' }], measures: [{ id: 'revenue', key: 'revenue' }] }, state: { selectedDimensions: ['region'], selectedMeasures: ['revenue'] }, unknownBuilder: 23 },
        { id: 'unknown', kind: 'futureBlock', title: 'Future', payload: { nested: 12 } },
        { id: 'note', kind: 'markdownBlock', title: 'Note', markdown: 'Before', futureFormatting: { keep: true } },
    ],
};
const prepared = prepareEmbeddedReport(report);
assert.equal(prepared.valid, true);
assert.deepEqual(prepared.state.reportDocumentBlocks.map((block) => block.id), ['unknown', 'note']);
assert.deepEqual(report.blocks[2].futureFormatting, { keep: true });
assert.equal(prepared.state.scopeParams.time, 'current');
const edited = applyEmbeddedReportChange(report, { ...prepared.state, reportDocumentBlocks: [
    prepared.state.reportDocumentBlocks[0], { id: 'note', kind: 'markdownBlock', title: 'Note', markdown: 'After' },
] }, prepared.config);
assert.equal(edited.blocks[0].id, 'primaryBuilder');
assert.deepEqual(edited.blocks[1], report.blocks[1]);
assert.deepEqual(edited.blocks[2].futureFormatting, { keep: true });
assert.equal(edited.blocks[2].markdown, 'After');
assert.deepEqual(edited.datasets, report.datasets);
assert.deepEqual(edited.scope, report.scope);
const filtered = applyEmbeddedReportChange(report, { ...prepared.state, scopeParams: { time: 'previous' } }, prepared.config);
assert.equal(filtered.scope.params[0].value, 'previous');
assert.equal(report.scope.params[0].value, 'current');
assert.deepEqual(edited.customMetadata, report.customMetadata);
assert.equal(report.blocks[2].markdown, 'Before');
assert.deepEqual(prepareEmbeddedReport({ id: 'inline', blocks: [{ id: 'legacy', kind: 'futureBlock', payload: 3 }] }).state.reportDocumentBlocks, [{ id: 'legacy', kind: 'futureBlock', payload: 3 }]);
assert.match(prepareEmbeddedReport({ sections: [] }).reason, /host source editor/);
const invalid = { id: 'new', dataSourceRef: 'view', source: { id: 'source', version: 'v1' }, columns: [] };
assert.match(validateProviderDatasetDeclaration(invalid), /service and tool/);
const declaration = { ...invalid, source: { ...invalid.source, serviceRef: 'service', toolRef: 'tool' }, resultContract: { fields: [] } };
const added = addEmbeddedDataset(report, declaration);
assert.equal(added.valid, true);
assert.equal(added.report.datasets.length, 2);
assert.equal(report.datasets.length, 1);
const preparedWithNewSource = prepareEmbeddedReport(added.report, { datasets: [{ id: 'existing', dataSourceRef: 'existing' }] });
assert.deepEqual(preparedWithNewSource.config.datasets.map((dataset) => dataset.id), ['existing', 'sales', 'new']);
assert.equal(addEmbeddedDataset(added.report, declaration).valid, false);
const updated = replaceEmbeddedDataset(added.report, { ...declaration, source: { ...declaration.source, version: 'v2' } });
assert.equal(updated.valid, true);
assert.equal(updated.report.datasets[1].source.version, 'v2');
assert.equal(added.report.datasets[1].source.version, 'v1');
assert.match(validateProviderSourceSelection({ id: 'source', version: 'v1' }, { id: 'source', version: 'v2' }, declaration), /version changed/);
assert.equal(validateProviderSourceSelection({ id: 'source', version: 'v1' }, { id: 'source', version: 'v1' }, declaration), '');
assert.match(validateProviderSourceSelection({ id: 'source', version: 'v2' }, { id: 'source', version: 'v2' }, declaration), /differs/);
console.log('reportDesignerModel ✓ native round trip, unknown nodes, provider bindings, no revision mutation');
