// Independently authored engine fixture. No exported application metadata or rows.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const ids = ['records', 'daily', 'regional', 'summary', 'categories', 'comparison'];
const request = () => ({filters: {from: '2026-01-01', to: '2026-01-02'}, measures: {amount: true, count: true}, dimensions: {category: true}, limit: 25, offset: 0});
const dimensions = [{id: 'category', key: 'category', label: 'Category', paramPath: 'dimensions.category', default: true}];
const measures = ['amount', 'count'].map(id => ({id, key: id, label: id === 'amount' ? 'Amount' : 'Count', paramPath: 'measures.' + id, default: true}));
const dataSources = Object.fromEntries(ids.map(id => [id, {id, cardinality: 'collection', backend: {kind: 'mcp_tool', service: 'sample-producer', method: 'read-' + id}}]));
const builderDefinition = {kind: 'forge.reporting.builder', id: 'sampleBuilder', reportBuilder: {
  title: 'Synthetic Summary', dataSourceRef: 'records', dimensions, measures,
  calculatedFields: [{id: 'total', key: 'total', label: 'Total', dataType: 'number', expr: 'amount + count'}],
  predicates: [{id: 'dateRange', kind: 'dateRange', startParamPath: 'filters.from', endParamPath: 'filters.to', prefill: {start: 'from', end: 'to'}}],
  result: {defaultMode: 'table', pageSize: 25},
  dataSources: ids.slice(1).map(id => ({id, dataSourceRef: id, request: request(), scope: {mode: 'inherit'}, dimensions, measures})),
}};
const reportDocument = {version: 1, kind: 'reportDocument', id: 'sampleSummary', title: 'Synthetic Summary', blocks: [
  {id: 'summaryMetric', kind: 'kpiBlock', title: 'Amount', datasetRef: 'primary', valueField: 'amount'},
  {id: 'detailTable', kind: 'tableBlock', title: 'Details', datasetRef: 'daily', columns: [{key: 'category', label: 'Category', kind: 'dimension'}, {key: 'amount', label: 'Amount', kind: 'measure'}]},
  ...ids.slice(2).map(id => ({id: id + 'Metric', kind: 'kpiBlock', title: 'Example metric', datasetRef: id, valueField: 'amount'})),
]};
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const envelope = {schemaVersion: 1, format: 'forge.authoredReport', builderRef: 'sampleBuilder', builderDefinition, reportDocument,
  state: {viewMode: 'table', selectedMeasures: ['amount', 'count', 'total'], selectedDimensions: ['category']}, dataSources,
  dependencies: [{kind: 'builder', id: 'sampleBuilder', contentFingerprint: digest(builderDefinition)},
    {kind: 'report', id: 'report://example/summary', contentFingerprint: digest(reportDocument)},
    ...ids.map(id => ({kind: 'datasource', id, contentFingerprint: digest(dataSources[id])}))],
};
const target = path.resolve('backend/reporting/engine/testdata/authored_report.json');
const output = JSON.stringify(envelope) + '\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== output) throw Error('Synthetic engine fixture differs from its independently authored generator');
} else fs.writeFileSync(target, output);
console.log('Synthetic engine fixture: six sources, eight dependencies; no captured business input.');
