import assert from 'node:assert/strict';
import { buildReportPrintFromReportFill } from '../../reporting/reportPrintModel.js';
import { buildReportFillFromReportSpec } from '../../reporting/reportFillModel.js';
import { validateReportExportRequest } from '../../reporting/schema/reportSchemas.js';
import { buildReportBuilderDocumentCompileValidation, buildReportBuilderDocumentCompileDiagnostics, buildReportBuilderDocumentBlockFieldOptions } from './reportBuilderDocumentBlocks.js';
import { buildReportBuilderSavedReportPayloadFromBuilderState, buildReportBuilderSavedReportExportRequestFromBuilderState } from './reportBuilderSavedReportPayload.js';
import { calculatedCatalogConfig as config, calculatedCatalogBlocks as blocks, calculatedCatalogState as state } from './reportBuilderCalculatedCatalog.fixture.js';

assert.deepEqual(buildReportBuilderDocumentCompileDiagnostics({ config, state }), []);
// Shared IDs, as well as shared output keys, are valid across logical datasets.
const duplicateIds = { ...config, calculatedFields: config.calculatedFields.map(field => field.key === 'adjusted' ? { ...field, id: 'sharedAdjusted' } : field) };
assert.deepEqual(buildReportBuilderDocumentCompileDiagnostics({ config: duplicateIds, state }), []);
const options = buildReportBuilderDocumentBlockFieldOptions({ config, state });
for (const dataset of options.datasetOptions) {
    assert.ok(dataset.columnOptions.some(field => field.key === 'adjusted'));
    assert.ok(dataset.valueFieldOptions.some(field => field.value === `${dataset.value}Adjusted`));
    assert.ok(dataset.chartFieldOptions.some(field => field.key === 'adjusted'));
    assert.equal(dataset.columnOptions.some(field => field.key === 'plannedOnly'), dataset.value === 'planned');
}
const invalidState = { ...state, reportDocumentBlocks: [
    ...blocks,
    { id: 'missing', kind: 'kpiBlock', datasetRef: 'observed', valueField: 'absent' },
    { id: 'foreign', kind: 'kpiBlock', datasetRef: 'observed', valueField: 'plannedOnly' },
    { id: 'badChart', kind: 'chartBlock', datasetRef: 'observed', chartSpec: { type: 'line', xField: 'absent', yFields: ['adjusted'] } },
] };
assert.deepEqual(buildReportBuilderDocumentCompileDiagnostics({ config, state: invalidState }).map(d => d.blockId), ['missing', 'foreign', 'badChart']);
const seed = { version: 1, kind: 'reportBuilder.savedReportPayload', payloadId: 'catalog', title: 'Units', reportDocument: { version: 1, kind: 'reportDocument', id: 'catalog', title: 'Units' }, reportSpec: { version: 1, kind: 'reportSpec', blocks: [{ id: 'primaryTable' }], datasets: [{ id: 'primary' }] } };
const args = { container: { id: 'catalog', dataSourceRef: 'records' }, config, state };
const saved = buildReportBuilderSavedReportPayloadFromBuilderState(seed, args);
assert.equal(saved.compileState.status, 'clean');
const reportFill = buildReportFillFromReportSpec(saved.reportSpec, Object.fromEntries(['primary', 'planned', 'observed'].map(id => [id, { rows: [{ period: 'One', units: 4 }] }])));
const exported = buildReportBuilderSavedReportExportRequestFromBuilderState(saved, { ...args, documentVersion: 1, runtimeArtifact: { reportFill, reportPrint: buildReportPrintFromReportFill({ reportSpec: saved.reportSpec, reportFill }) } });
assert.equal(validateReportExportRequest(exported).valid, true);
assert.equal(exported.reportFill.datasets.find(dataset => dataset.id === 'observed').rows[0].adjusted, 8);
const invalid = buildReportBuilderSavedReportPayloadFromBuilderState(seed, { ...args, state: invalidState });
assert.equal(invalid.compileState.status, 'invalid');
assert.equal(buildReportBuilderDocumentCompileValidation(invalid.compileState.diagnostics).valid, false);
console.log('PASS scoped calculated editor catalogs, save and export validation');
