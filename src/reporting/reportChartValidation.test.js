import assert from 'node:assert/strict';
import {buildReportBuilderReportDocument, lowerReportDocumentToReportSpec} from './reportDocumentModel.js';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {AuthoredReportChartValidationError, lowerValidatedReportDocument} from './reportChartValidation.js';

const parentConfig = {
  dimensions: [{id: 'region', key: 'region', paramPath: 'dimensions.region', default: true}],
  measures: [{id: 'observations', key: 'observations', paramPath: 'measures.observations', default: true}],
  result: {defaultMode: 'table'},
};
const source = {id: 'detail', dataSourceRef: 'facts', request: {dimensions: {region: true}, measures: {observations: true}}};
function fixture(child = source) {
  return buildReportBuilderReportDocument({
    container: {id: 'validation', dataSourceRef: 'facts'},
    config: {...parentConfig, dataSources: [child]},
    state: {
      viewMode: 'table', selectedDimensions: ['region'], selectedMeasures: ['observations'],
      reportDocumentBlocks: [{id: 'detailChart', kind: 'chartBlock', datasetRef: 'detail', chartSpec: {type: 'bar', xField: 'region', yFields: ['observations']}}],
    },
  });
}

const missing = fixture();
const observations = [];
const tolerant = lowerReportDocumentToReportSpec(missing);
assert.deepEqual(lowerReportDocumentToReportSpec(missing, {onChartValidation: event => observations.push(event)}), tolerant, 'collecting validation must not change tolerant draft artifacts');
const invalid = observations.find(event => event.blockId === 'detailChart');
assert.equal(invalid.datasetRef, 'detail');
assert.deepEqual(invalid.validation, {valid: false, errors: [{field: 'xField', code: 'missingField'}, {field: 'yFields.0', code: 'missingField'}]});
assert.throws(() => lowerValidatedReportDocument(missing), error => {
  assert.ok(error instanceof AuthoredReportChartValidationError);
  assert.deepEqual(error.authoredChartValidation, [
    {blockId: 'detailChart', datasetRef: 'detail', field: 'xField', fieldRef: 'region', validationCode: 'missingField'},
    {blockId: 'detailChart', datasetRef: 'detail', field: 'yFields.0', fieldRef: 'observations', validationCode: 'missingField'},
  ]);
  assert.equal(JSON.stringify(error.authoredChartValidation).includes('rows'), false);
  return true;
});
console.log('PASS child missing catalog emits exact block/dataset/x/y validation before data execution');

for (const child of [
  {...source, capabilities: {inheritRuntimeFieldCatalog: true}},
  {...source, columnOptions: [{key: 'region', kind: 'dimension'}, {key: 'observations', kind: 'measure'}]},
]) {
  const document = fixture(child);
  const spec = lowerValidatedReportDocument(document);
  assert.deepEqual(spec, lowerReportDocumentToReportSpec(document));
  for (const rows of [[], [{region: 'Invented region', observations: 7}]]) {
    const fill = buildReportFillFromReportSpec(spec, {primary: {rows}, detail: {rows}});
    assert.equal(fill.datasets.find(dataset => dataset.id === 'detail').rows.length, rows.length);
  }
}
console.log('PASS explicit child catalog and explicit inheritance both preserve populated and valid empty charts');

const bad = fixture({...source, columnOptions: [{key: 'region', kind: 'dimension'}, {key: 'observations', kind: 'dimension'}]});
assert.throws(() => lowerValidatedReportDocument(bad), error => {
  assert.ok(error instanceof AuthoredReportChartValidationError);
  assert.ok(error.authoredChartValidation.some(entry => entry.field === 'yFields.0' && entry.validationCode === 'wrongKind'));
  return true;
});
console.log('PASS explicit wrong-kind fields remain invalid instead of inheriting or inventing schema');

// Independently invented signed observations exercise the complete authoring path.
for (const options of [{positiveColor: '#123456', negativeColor: '#654321'}, {positiveColor: '#123456'}, {negativeColor: '#654321'}, {}]) {
  const document = buildReportBuilderReportDocument({
    container: {id: 'signed', dataSourceRef: 'synthetic'},
    config: {dimensions: [{id: 'category', key: 'category', paramPath: 'dimensions.category', default: true}], measures: [{id: 'change', key: 'change', paramPath: 'measures.change', default: true}], result: {defaultMode: 'chart'}},
    state: {viewMode: 'chart', selectedDimensions: ['category'], selectedMeasures: ['change'], chartSpec: {type: 'horizontal_bar', xField: 'category', yFields: ['change'], preserveCategoryOrder: true, seriesOptions: {change: {pointColorMode: 'bySign', ...options}}}},
  });
  const spec = lowerValidatedReportDocument(document);
  const chart = spec.blocks.find(block => block.kind === 'chartBlock');
  assert.equal(chart.chartModel.series.values[0].pointColorMode, 'bySign');
  assert.equal(chart.chartModel.series.values[0].positiveColor, options.positiveColor);
  assert.equal(chart.chartModel.series.values[0].negativeColor, options.negativeColor);
  const rows = [{category: 'A', change: 12}, {category: 'B', change: -7}, {category: 'C', change: 0}];
  const fill = buildReportFillFromReportSpec(spec, {primary: {rows}});
  const filledChart = fill.blocks.find(block => block.kind === 'chartBlock');
  assert.equal(filledChart.content.chartModel.series.values[0].positiveColor, options.positiveColor);
  assert.deepEqual(filledChart.content.resolvedChart.rows.map(row => row.change), [12, -7, 0]);
}
