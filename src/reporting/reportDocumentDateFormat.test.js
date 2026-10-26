import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildReportBuilderReportDocument, lowerReportDocumentToReportSpec} from './reportDocumentModel.js';

const bundled = {};
vm.runInNewContext(fs.readFileSync(new URL('../../backend/reporting/materializer/lowerer.bundle.js', import.meta.url), 'utf8'), bundled);

for (const [valueMode, expectedMode] of [['civil', 'civil'], ['instant', 'instant'], ['invalid', undefined], [undefined, undefined]]) {
  const config = {
    dimensions: [{id: 'eventDate', key: 'eventDate', label: 'Event date', format: 'date', tickFormat: 'MMM d', ...(valueMode ? {valueMode} : {})}],
    measures: [{id: 'count', key: 'count', label: 'Count'}],
  };
  const state = {
    selectedDimensions: ['eventDate'], selectedMeasures: ['count'],
    reportDocumentBlocks: [{id: 'trend', kind: 'chartBlock', datasetRef: 'primary', chartSpec: {type: 'line', xField: 'eventDate', yFields: ['count']}}],
  };
  const original = JSON.stringify({config, state});
  const document = buildReportBuilderReportDocument({container: {id: 'date-report', dataSourceRef: 'rows'}, config, state});
  // Rehydration uses the published primary column contract, rather than the
  // original in-memory builder config. This is where date metadata was lost.
  const roundTrip = JSON.parse(JSON.stringify(document));
  const primary = roundTrip.datasets.find(dataset => dataset.id === 'primary');
  const column = primary.columnOptions.find(option => option.key === 'eventDate');
  assert.equal(column.tickFormat, 'MMM d');
  assert.equal(column.valueMode, expectedMode);
  const spec = lowerReportDocumentToReportSpec(roundTrip);
  const axis = spec.blocks.find(block => block.id === 'trend').chartModel.xAxis;
  assert.equal(axis.dataKey, 'eventDate');
  assert.equal(axis.tickFormat, 'MMM d');
  assert.equal(axis.valueMode, expectedMode);
  const bundledSpec = JSON.parse(bundled.ForgeAuthoredLowerer.lower(JSON.stringify({
    schemaVersion: 1, format: 'forge.authoredReport', reportDocument: roundTrip,
    builderDefinition: {dataSourceRef: 'rows', reportBuilder: config}, state,
  })));
  const bundledAxis = bundledSpec.blocks.find(block => block.id === 'trend').chartModel.xAxis;
  assert.equal(bundledAxis.tickFormat, 'MMM d', 'Official generated bundle must preserve the same metadata');
  assert.equal(bundledAxis.valueMode, expectedMode);
  assert.equal(JSON.stringify({config, state}), original, 'Authored builder inputs must remain unchanged');
}
console.log('PASS report document date-axis metadata round trip (civil, instant, invalid, absent modes)');
