import assert from 'node:assert/strict';
import {
  normalizeReportCalculatedField,
  normalizeReportCalculatedFields,
  parseReportCalculatedFieldExpression,
  validateReportCalculatedFieldDependencies,
} from './calculatedFieldModel.js';

// Independently authored formulas and dataset names; no integration captures.
const definitions = [
  {id: 'net', datasetRef: 'orders', expr: ' amount - cost ', dependencies: ['orderId'], label: 'Order net'},
  {id: 'net', datasetRef: 'returns', expr: 'amount - cost', dependencies: ['returnId'], format: 'currency'},
  {id: 'constant', expr: '42'},
  {id: 'anotherConstant', expr: '42', dependencies: ['sourceId']},
  {id: 'scaled', compute: {type: 'ratio', numerator: 'amount', denominator: 'cost'}},
];
const original = structuredClone(definitions);
const normalized = normalizeReportCalculatedFields(definitions, {datasetRef: 'default'});
assert.deepEqual(normalized, definitions.map(field => normalizeReportCalculatedField(field, {datasetRef: 'default'})));
assert.deepEqual(normalized[0].dependencies, ['orderId', 'amount', 'cost']);
assert.deepEqual(normalized[1].dependencies, ['returnId', 'amount', 'cost']);
assert.deepEqual(normalized[2].dependencies, []);
assert.deepEqual(normalized[3].dependencies, ['sourceId']);
normalized[0].dependencies.push('mutated');
normalized[2].dependencies.push('changedConstant');
assert.deepEqual(normalized[1].dependencies, ['returnId', 'amount', 'cost']);
assert.deepEqual(normalized[3].dependencies, ['sourceId']);
assert.deepEqual(definitions, original);
assert.deepEqual(normalizeReportCalculatedFields(definitions)[0].dependencies, ['orderId', 'amount', 'cost']);
assert.deepEqual(normalizeReportCalculatedField(definitions[0]).dependencies, ['orderId', 'amount', 'cost']);

const parsed = parseReportCalculatedFieldExpression('amount - cost');
parsed.ast.left.name = 'changed';
parsed.dependencies.push('changed');
const fresh = parseReportCalculatedFieldExpression('amount - cost');
assert.equal(fresh.ast.left.name, 'amount');
assert.deepEqual(fresh.dependencies, ['amount', 'cost']);

for (const expression of ['amount +', 'unsupported(amount)']) {
  assert.throws(() => normalizeReportCalculatedFields([
    {id: 'valid', expr: 'amount - cost'},
    {id: 'invalid', expr: expression},
    {id: 'duplicateInvalid', expr: expression},
  ]));
  assert.throws(() => normalizeReportCalculatedField({id: 'invalid', expr: expression}));
}
assert.throws(() => validateReportCalculatedFieldDependencies([
  {id: 'first', expr: 'second + 1'}, {id: 'second', expr: 'first + 1'},
]), /cycle/);
assert.deepEqual(normalizeReportCalculatedFields(null), []);
console.log('calculated-field normalization: repeated formulas retain validation, metadata and independent dependencies');
