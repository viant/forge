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
    assert.equal(dataset.valueFieldOptions.filter(field => [field.value, ...(field.aliases || [])].includes(`${dataset.value}Adjusted`)).length, 1);
    assert.equal(dataset.columnOptions.filter(field => field.key === 'adjusted').length, 1);
    assert.equal(dataset.chartFieldOptions.filter(field => field.key === 'adjusted').length, 1);
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

// Independently authored metadata: explicit columns are the dataset's typed
// chart contract, and KPI comparisons may belong to another logical dataset.
const declaredConfig = {
    dataSourceRef: 'records', dimensions: [{ id: 'period', key: 'period' }], measures: [{ id: 'units', key: 'units' }],
    calculatedFields: [{ id: 'scaled', key: 'scaled', datasetRef: 'ranked', kind: 'rowCalc', expr: 'amount * 2' }],
    dataSources: [
        { id: 'ranked', dataSourceRef: 'records', measures: [{ id: 'amountId', key: 'amount' }], columnOptions: [
            { key: 'category', kind: 'dimension' }, { key: 'amount', kind: 'measure' },
            { key: 'detail', kind: 'object' }, { key: 'scaled', kind: 'calculated' },
            { key: 'opaque', kind: 'calculated' },
        ], calculatedFields: [{ id: 'scaled', key: 'scaled', kind: 'rowCalc', expr: 'amount * 2' }] },
        { id: 'comparison', dataSourceRef: 'records', measures: [{ key: 'change', label: 'Change' }] },
        { id: 'other', dataSourceRef: 'records', columnOptions: [{ key: 'foreign', kind: 'measure' }], measures: [{ key: 'differentChange', label: 'Change' }] },
    ],
};
const declaredBlocks = [
    { id: 'rankedChart', kind: 'chartBlock', datasetRef: 'ranked', chartSpec: {
        type: 'bar', xField: 'category', yFields: ['scaled'], tooltip: { fields: [{ field: 'amount', label: 'Amount' }] },
    } },
    { id: 'comparisonKpi', kind: 'kpiBlock', valueField: 'units', secondaryDatasetRef: 'comparison', secondaryField: 'change' },
    { id: 'columnKpi', kind: 'kpiBlock', datasetRef: 'ranked', valueField: 'amount', secondaryField: 'category' },
    { id: 'dateKpi', kind: 'kpiBlock', valueField: 'period', valueFormat: 'date' },
    { id: 'bodyKpi', kind: 'kpiBlock', datasetRef: 'ranked', valueField: 'category', presentationMode: 'body', bodyTemplate: '${row.category}' },
];
const declaredState = { selectedDimensions: ['period'], selectedMeasures: ['units'], reportDocumentBlocks: declaredBlocks };
assert.deepEqual(buildReportBuilderDocumentCompileDiagnostics({ config: declaredConfig, state: declaredState }), []);
assert.equal(buildReportBuilderDocumentBlockFieldOptions({ config: declaredConfig, state: declaredState })
    .datasetOptions.find(dataset => dataset.value === 'ranked').valueFieldOptions.filter(field => field.value === 'amount').length, 1);
const rejectedBlocks = [
    { ...declaredBlocks[0], id: 'missingColumn', chartSpec: { type: 'bar', xField: 'category', yFields: ['absent'] } },
    { ...declaredBlocks[0], id: 'foreignColumn', chartSpec: { type: 'bar', xField: 'category', yFields: ['foreign'] } },
    { ...declaredBlocks[0], id: 'objectColumn', chartSpec: { type: 'bar', xField: 'category', yFields: ['detail'] } },
    { ...declaredBlocks[0], id: 'untypedCalculation', chartSpec: { type: 'bar', xField: 'category', yFields: ['opaque'] } },
    { ...declaredBlocks[0], id: 'wrongAxisRole', chartSpec: { type: 'bar', xField: 'amount', yFields: ['scaled'] } },
    { ...declaredBlocks[1], id: 'missingSecondaryDataset', secondaryDatasetRef: 'absent' },
    { ...declaredBlocks[1], id: 'foreignSecondaryField', secondaryDatasetRef: 'ranked' },
    { ...declaredBlocks[1], id: 'sameLabelSecondaryField', secondaryDatasetRef: 'other' },
    { ...declaredBlocks[1], id: 'missingSecondaryField', secondaryField: 'absent' },
    { ...declaredBlocks[1], id: 'foreignPrimaryField', valueField: 'change' },
    { ...declaredBlocks[2], id: 'objectKpi', valueField: 'detail' },
];
const rejected = buildReportBuilderDocumentCompileDiagnostics({ config: declaredConfig, state: { ...declaredState, reportDocumentBlocks: rejectedBlocks } });
assert.deepEqual(rejected.map(issue => issue.blockId), rejectedBlocks.map(block => block.id));
assert.equal(rejected.find(issue => issue.blockId === 'missingSecondaryDataset').path, 'reportDocument.blocks.missingSecondaryDataset.secondaryDatasetRef');
const aliasedBlocks = ['valueField', 'secondaryField'].map((property, index) => ({
    id: `aliased${index}`, kind: 'kpiBlock', datasetRef: 'planned', valueField: 'units', [property]: 'plannedAdjusted',
}));
assert.deepEqual(buildReportBuilderDocumentCompileDiagnostics({ config, state: { ...state, reportDocumentBlocks: aliasedBlocks } }), []);
assert.deepEqual(buildReportBuilderDocumentCompileDiagnostics({ config, state: { ...state, reportDocumentBlocks: [
    { id: 'aliasedChart', kind: 'chartBlock', datasetRef: 'planned', chartSpec: { type: 'line', xField: 'period', yFields: ['plannedAdjusted'] } },
    { id: 'aliasedTable', kind: 'tableBlock', datasetRef: 'planned', columns: [{ key: 'plannedAdjusted' }] },
] } }), []);
// A separately declared chart catalog remains authoritative over table columns.
const restrictedConfig = { ...declaredConfig, dataSources: declaredConfig.dataSources.map(source => source.id === 'ranked'
    ? { ...source, chartFieldOptions: [{ key: 'amount', kind: 'measure' }] } : source) };
assert.ok(buildReportBuilderDocumentCompileDiagnostics({ config: restrictedConfig, state: declaredState }).some(issue => issue.blockId === 'rankedChart'));
console.log('PASS scoped calculated editor catalogs, save and export validation');
