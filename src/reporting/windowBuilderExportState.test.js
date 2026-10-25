import assert from 'node:assert/strict';
import {snapshotWindowBuilderExportSelection, snapshotWindowBuilderParameters, prepareWindowBuilderExport} from './windowBuilderExportState.js';

const container = {id: 'localBuilder', dataSourceRef: 'approved', title: 'Synthetic export contract'};
const config = {
    dimensions: [{id: 'region', key: 'region', paramPath: 'dimensions.region'}],
    measures: [{id: 'count', key: 'count', default: true, paramPath: 'measures.count'}],
    dataSourceRef: 'approved', result: {defaultMode: 'table'},
    reportOptions: [{name: 'showEmpty', type: 'boolean'}, {name: 'threshold', type: 'number'}],
};
const state = {selectedDimensions: ['region'], selectedMeasures: ['count'], viewMode: 'table',
    reportOptions: {showEmpty: false, threshold: 0},
    reportDocumentBlocks: [{id: 'details', kind: 'tableBlock', datasetRef: 'primary', columns: [{key: 'region'}, {key: 'count'}]}],
    reportDefinition: {fieldCatalog: {columns: ['untrusted']}}, resultRows: [{count: 999}],
};
const selection = snapshotWindowBuilderExportSelection(container, state);
assert.equal('resultRows' in selection.state, false);
assert.equal('reportDefinition' in selection.state, false);
const prepare = (patch = {}) => prepareWindowBuilderExport({container, config, selection, attachedDataSourceIds: ['approved'], ...patch});
const output = prepare();
assert.equal(output.reportSpec.kind, 'reportSpec');
assert.equal(output.state.reportOptions.showEmpty, false);
assert.equal(output.state.reportOptions.threshold, 0);
assert.ok(output.reportSpec.blocks.some(block => block.id === 'details'));
assert.ok(output.reportSpec.datasets.every(dataset => dataset.dataSourceRef === 'approved' && !Object.hasOwn(dataset, 'rows')));
assert.throws(() => prepare({container: {...container, id: 'other'}}), /unavailable/);
assert.throws(() => prepare({config: {...config,hooks:{buildRequest:'metadata.script'}}}), /declarative/);
assert.throws(() => prepare({selection: {...selection, version: 2}}), /Invalid/);
assert.throws(() => prepare({selection: {...selection, state: {...selection.state, backend: {method: 'forged'}}}}), /Invalid/);
assert.throws(() => prepare({selection: {...selection, state: {...selection.state, selectedMeasures: ['secret']}}}), /unknown field/);
assert.throws(() => prepare({selection: {...selection, state: {...selection.state, selectedMeasures: [null]}}}), /field names/);
assert.throws(() => prepare({selection: {...selection, state: {...selection.state, scopeParams: {advertiserId: 999}}}}), /undeclared/);
assert.throws(() => prepare({selection: {...selection, state: {...selection.state, reportOptions: {showEmpty:'false'}}}}), /invalid type/);
assert.throws(() => prepare({attachedDataSourceIds: ['other']}), /not attached/);
assert.throws(() => snapshotWindowBuilderExportSelection(container, {reportStaticDatasets: [{rows: [{fake: 1}]}]}), /does not support/);
assert.throws(() => snapshotWindowBuilderExportSelection(container, {...state, reportDocumentBlocks: [{id: 'bad', kind: 'tableBlock', rows: [{fake: 1}]}]}), /replace rows/);
assert.throws(() => prepare({selection: {...selection, state: {...selection.state, reportDocumentBlocks: [{id: 'bad', kind: 'tableBlock', datasetRef: 'foreign', columns: [{key: 'count'}]}]}}}), /unknown logical dataset/);
assert.throws(() => prepare({selection: {...selection, state: {...selection.state, reportDocumentBlocks: [{id: 'details', kind: 'tableBlock'}, {id: 'details', kind: 'tableBlock'}]}}}), /duplicate/);
assert.throws(() => prepare({config: {...config, runtimeFieldCatalog: {enabled: true}}}), /catalog is unavailable/);
const dynamic = prepare({config: {...config, dimensions: [], measures: [], runtimeFieldCatalog: {enabled: true}}, definition: {fieldCatalog: {options: config.reportOptions, columns: [{name: 'region', role: 'dimension'}, {name: 'count', role: 'measure'}]}}});
assert.deepEqual(dynamic.config.measures.map(field => field.id), ['count']);
assert.equal(config.measures[0].id, 'count');
const parameters=snapshotWindowBuilderParameters({parameters:[{name:'AdvertiserId',bindTo:'AdvertiserId'},{name:'Trial',default:false},{name:'Zero'}]}, {AdvertiserId:[42],Zero:0,reportDefinition:{rows:['not sent']},rows:['not sent']});
assert.deepEqual(parameters,{AdvertiserId:[42],Trial:false,Zero:0});
assert.deepEqual(snapshotWindowBuilderParameters({}, {rows:['not sent']}),{});
assert.throws(()=>snapshotWindowBuilderParameters({parameters:[{name:'source'}]}, {source:'not a context override'}), /declaration/);
console.log('Window builder export state contracts passed; server admission and renderer/browser acceptance remain separate.');
