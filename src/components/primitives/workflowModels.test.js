import assert from 'node:assert/strict';
import {
  applyAssignment,
  availableStatusTransitions,
  diffHistoryRecords,
  permissionBoundaryState,
  responsiveDataGridState,
  runDerivedPipeline,
  toggleTreeSelection,
  validateSchedule,
  validateUploadCollection,
  wizardState,
} from './workflowModels.js';

const assignment = applyAssignment([{id: 1}, {id: 2}], [{id: 2}], [{id: 1}], {identityFields: ['id']}, 'assign');
assert.deepEqual(assignment.assigned.map((row) => row.id), [2, 1]);
assert.deepEqual(assignment.available, []);
assert.deepEqual(applyAssignment([{id: 1}], [{id: 1}, {id: 2}], [{id: 2}], {identityFields: ['id']}, 'unassign').assigned, [{id: 1}]);

assert.deepEqual(
  availableStatusTransitions('inactive', {transitions: [{id: 'go', from: ['inactive'], to: 'active'}, {id: 'stop', from: ['active'], to: 'paused'}]}).map((row) => row.id),
  ['go'],
);

const tree = [{id: 'a', children: [{id: 'b'}, {id: 'c'}]}];
assert.deepEqual(new Set(toggleTreeSelection(tree, [], 'a', true, {identityField: 'id', childrenField: 'children', cascade: 'descendants'})), new Set(['a', 'b', 'c']));
assert.deepEqual(toggleTreeSelection(tree, ['a', 'b', 'c'], 'b', false, {identityField: 'id', childrenField: 'children'}).sort(), ['a', 'c']);

const signal = (value) => ({value, peek: () => value});
const wizardContext = {handlers: {dataSource: {peekFormData: () => ({name: 'ready'})}}};
const wizard = wizardState({steps: [{id: 'one', validWhen: {source: 'form', field: 'name', equals: 'ready'}}, {id: 'two'}]}, wizardContext, 0);
assert.equal(wizard.canNext, true);
assert.equal(wizardState({steps: [{id: 'one'}, {id: 'two'}]}, {}, 'two').current.id, 'two');

assert.equal(validateUploadCollection([{name: 'a.csv', type: 'text/csv', size: 10}], {accept: ['text/csv'], maxFiles: 1, maxBytes: 20}).valid, true);
assert.equal(validateUploadCollection([{name: 'a.exe', type: 'application/octet-stream', size: 30}], {accept: ['text/csv'], maxBytes: 20}).valid, false);

const derived = runDerivedPipeline({left: [{id: 2, name: 'b'}, {id: 1, name: 'a'}], right: [{id: 1, total: 5}]}, {
  sources: ['left', 'right'],
  pipeline: [
    {operation: 'join', source: 'right', on: ['id'], fields: {total: 'total'}},
    {operation: 'filter', when: {field: 'name', notEmpty: true}},
    {operation: 'sort', orderBy: [{columnId: 'id', direction: 'asc'}]},
  ],
});
assert.deepEqual(derived, [{id: 1, name: 'a', total: 5}, {id: 2, name: 'b', total: undefined}]);
assert.throws(() => runDerivedPipeline({rows: []}, {sources: ['rows'], pipeline: [{operation: 'script'}]}), /Unsupported derived operation/);
assert.throws(() => runDerivedPipeline({rows: [{id: 1}], right: [{id: 1}, {id: 1}]}, {sources: ['rows', 'right'], pipeline: [{operation: 'join', source: 'right', on: ['id'], joinCardinality: 'one'}]}), /expected one right row/);
assert.throws(() => runDerivedPipeline({rows: [{id: 1}, {id: 2}]}, {sources: ['rows'], maxRows: 1}), /maxRows/);
assert.throws(() => runDerivedPipeline({rows: [{id: 1}], right: [{id: 1}, {id: 2}]}, {sources: ['rows', 'right'], maxRows: 1, pipeline: [{operation: 'join', source: 'right'}]}), /source right exceeds maxRows/);
assert.throws(() => runDerivedPipeline({rows: [{id: 1}], right: [{id: 1}, {id: 1}]}, {sources: ['rows', 'right'], maxRows: 1, pipeline: [{operation: 'join', source: 'right', joinCardinality: 'many'}]}), /source right exceeds maxRows|output exceeds maxRows/);
assert.throws(() => runDerivedPipeline({rows: [{id: 1}, {id: 1}], right: [{id: 1}, {id: 1}]}, {sources: ['rows', 'right'], maxRows: 2, pipeline: [{operation: 'join', source: 'right', joinCardinality: 'many'}]}), /output exceeds maxRows/);
assert.throws(() => runDerivedPipeline({rows: [{id: 1}], right: [{id: 1}]}, {sources: ['rows'], pipeline: [{operation: 'join', source: 'right'}]}), /must be declared in sources/);
assert.deepEqual(runDerivedPipeline({rows: [{kind: 'a', cost: 2}, {kind: 'a', cost: 3}, {kind: 'b', cost: 4}]}, {
  sources: ['rows'],
  pipeline: [{operation: 'group', groupBy: ['kind'], measures: [{target: 'count', operation: 'count'}, {target: 'cost', source: 'cost', operation: 'sum'}]}],
}), [{kind: 'a', count: 2, cost: 5}, {kind: 'b', count: 1, cost: 4}]);

const boundary = permissionBoundaryState([{id: 1}, {id: 2}], {'1': {capabilities: {write: true}}, '2': {capabilities: {write: false}}}, {identityField: 'id', capability: 'write'});
assert.equal(boundary.mixed, true);
assert.deepEqual(boundary.allowed, [{id: 1}]);

assert.deepEqual(responsiveDataGridState({breakpoints: {desktop: {columns: ['id']}, phone: {columns: ['name']}}}, 'phone'), {columns: ['name']});
assert.deepEqual(diffHistoryRecords({name: 'before', updated: 1}, {name: 'after', updated: 2}, {ignoreFields: ['updated']}), [{field: 'name', before: 'before', after: 'after'}]);
assert.deepEqual(diffHistoryRecords({profile: {token: 'a', name: 'old'}}, {profile: {token: 'b', name: 'new'}}, {redactFields: ['profile.token']}), [{field: 'profile.token', before: '••••', after: '••••'}, {field: 'profile.name', before: 'old', after: 'new'}]);
assert.deepEqual(diffHistoryRecords({tags: ['b', 'a']}, {tags: ['a', 'b']}, {arrayStrategy: 'set'}), []);

assert.equal(validateSchedule([{start: '2026-01-01', end: '2026-01-02'}, {start: '2026-01-01T12:00:00Z', end: '2026-01-03'}], {allowOverlap: false}).valid, false);
assert.equal(validateSchedule([{start: '2026-01-01', end: '2026-01-02'}, {start: '2026-01-02', end: '2026-01-03'}], {allowOverlap: false}).valid, true);
assert.deepEqual(validateSchedule([{start: '2026-01-01T00:00:00Z', end: '2026-01-01T00:30:00Z'}], {minDuration: '1h'}).errors, [{index: 0, code: 'min_duration'}]);

console.log('workflow primitive models passed');
