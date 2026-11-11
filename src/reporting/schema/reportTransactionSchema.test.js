// Synthetic authoring fixtures: no application or production content.
import assert from 'node:assert/strict';
import { reportTransactionSchema, reportDataSchema } from './reportTransactionSchema.js';
import { reportSpecSchema } from './reportSpecSchema.js';
import { validateReportSchema } from './reportSchemaValidator.js';
import { compileInlineReport } from '../inlineReportCompiler.js';
const chart = { id: 'trend', kind: 'chartBlock', datasetRef: 'readings', chartSpec: { type: 'line', xField: 'day', yFields: ['count'] } };
const start = { version: 1, scope: 'message', id: 'example', sequence: 1, mode: 'start', grammar: 'report-document-v1', blocks: [chart] };
const check = (schema, value) => validateReportSchema(schema, value);
assert.equal(check(reportTransactionSchema, start).valid, true, JSON.stringify(check(reportTransactionSchema, start).errors));
const compiled = compileInlineReport({ reportId: 'example', grammar: start.grammar, source: { title: 'Example', blocks: [chart] }, dataSources: { readings: { rows: [{ day: 'Monday', count: 4 }] } } });
assert.ok(compiled.reportSpec.blocks[0].chartModel, 'native lowering generates the derived chart model');
assert.equal(check(reportSpecSchema, compiled.reportSpec).valid, true);
assert.ok(reportSpecSchema.$defs.chartBlock.required.includes('chartModel'), 'compiled contract remains strict');
for (const invalid of [{ ...start, version: 2 }, { ...start, mode: 'bogus' }, { ...start, surprise: true }, { ...start, blocks: [{ ...chart, chartSpec: { ...chart.chartSpec, type: 42 } }] }, { ...start, blocks: [{ ...chart, unsupported: true }] }]) {
  assert.equal(check(reportTransactionSchema, invalid).valid, false, 'invalid envelope/field/enum must fail');
}
assert.equal(check(reportTransactionSchema, { version: 1, scope: 'message', id: 'example', sequence: 2, mode: 'patch', blocks: [{ id: 'trend', chartSpec: { type: 'bar' } }] }).valid, true);
const data = { version: 2, scope: 'message', id: 'readings', reportRef: 'example', sequence: 2, mode: 'replace', format: 'json', data: [{ day: 'Monday', count: 4 }] };
assert.equal(check(reportDataSchema, data).valid, true);
for (const invalid of [{ ...data, version: 1 }, { ...data, format: 'xml' }, { ...data, mode: 'delete' }, { ...data, surprise: 1 }, { ...data, format: 'csv' }]) assert.equal(check(reportDataSchema, invalid).valid, false);
console.log('Progressive authoring schemas preserve canonical fields and native chart lowering.');
