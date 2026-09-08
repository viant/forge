import assert from 'node:assert/strict';
import {
  applyPrimitiveState,
  editableCollectionOperationState,
  editableCollectionRows,
  mutationCommandTargetParameters,
  reconcileEditableCollection,
} from './editableCollectionModel.js';
import {dispatchMutationCommand} from './primitiveMutation.js';

const context = {authorization: {resource: {capabilities: {write: true}}}};
const operation = {
  requiresSelection: true,
  selection: {max: 2},
  visibleWhen: {source: 'authorization', field: 'resource.capabilities.write', equals: true},
};
assert.equal(editableCollectionOperationState(operation, context, {selection: []}).disabled, true);
assert.equal(editableCollectionOperationState(operation, context, {selection: [{id: 1}]}).disabled, false);
assert.equal(editableCollectionOperationState({...operation, selection: {disabledWhen: {source: 'authorization', field: 'resource.capabilities.write', equals: true}}}, context, {selection: [{id: 1}]}).disabled, true);
assert.equal(editableCollectionOperationState(operation, context, {selection: [{id: 1}, {id: 2}, {id: 3}]}).disabled, true);
assert.equal(editableCollectionOperationState({...operation, selection: {min: 1, max: 1}}, context, {selection: [{id: 1}, {id: 2}]}).disabled, true);
assert.equal(editableCollectionOperationState({...operation, selection: {min: 1, every: {source: 'row', field: 'editable', equals: true}}}, context, {selection: [{id: 1, editable: true}, {id: 2, editable: true}]}).disabled, false);
assert.equal(editableCollectionOperationState({...operation, selection: {min: 1, every: {source: 'row', field: 'editable', equals: true}}}, context, {selection: [{id: 1, editable: true}, {id: 2, editable: false}]}).disabled, true);
assert.equal(editableCollectionOperationState({...operation, selection: {min: 1, any: {source: 'row', field: 'state', equals: 'ready'}}}, context, {selection: [{state: 'draft'}, {state: 'ready'}]}).disabled, false);
assert.equal(editableCollectionOperationState({...operation, selection: {min: 1, none: {source: 'row', field: 'locked', equals: true}}}, context, {selection: [{locked: false}, {locked: true}]}).disabled, true);
assert.deepEqual(editableCollectionRows({selected: {id: 4}}), [{id: 4}]);

const rows = [{id: 1, name: 'one'}, {id: 2, name: 'two'}];
assert.deepEqual(
  reconcileEditableCollection(rows, [{id: 2, name: 'updated'}], {mode: 'merge', identityField: 'id'}),
  [{id: 1, name: 'one'}, {id: 2, name: 'updated'}],
);
assert.deepEqual(reconcileEditableCollection(rows, [{id: 1}], {mode: 'remove', identityField: 'id'}), [{id: 2, name: 'two'}]);
assert.deepEqual(reconcileEditableCollection(rows, [{id: 3}], {mode: 'replace', identityField: 'id'}), [{id: 3}]);
assert.deepEqual(reconcileEditableCollection([{kind: 'a', id: 1, name: 'old'}], [{kind: 'a', id: 1, name: 'new'}], {mode: 'merge', identityFields: ['kind', 'id']}), [{kind: 'a', id: 1, name: 'new'}]);
assert.throws(() => reconcileEditableCollection([{id: 1}], [{name: 'missing'}], {mode: 'merge', identityField: 'id'}), /missing identity/);
assert.throws(() => reconcileEditableCollection([], [], {mode: 'unknown'}), /Unsupported reconciliation mode/);

assert.deepEqual(
  mutationCommandTargetParameters({patch: {input: {parameters: {Rows: [{id: 1}]}}}}, 'patch'),
  {Rows: [{id: 1}]},
);
let value = {pending: false};
const signal = {peek: () => value};
Object.defineProperty(signal, 'value', {get: () => value, set: (next) => { value = next; }});
assert.equal(applyPrimitiveState({signals: {windowForm: signal}}, {pending: true}), true);
assert.deepEqual(value, {pending: true});

let mutationParameters = null;
let mutationFetch = null;
const mutationContext = {
  identity: {dataSourceRef: 'records'},
  signals: {windowForm: signal},
  Context: (ref) => ref === 'records_patch' ? {handlers: {dataSource: {
    setInputParameters: (parameters) => { mutationParameters = parameters; },
    fetchCollection: (options) => { mutationFetch = options; },
  }}} : mutationContext,
};
assert.equal(dispatchMutationCommand(mutationContext, {dataSourceRef: 'records_patch', pendingState: {pending: true}}, {selectedRows: [{id: 1}]}), true);
assert.deepEqual(mutationParameters, {selectedRows: [{id: 1}]});
assert.equal(mutationFetch.cache.bypassCache, true);

let controlSubscriber;
let sourceRows = [{id: 1, name: 'old'}];
let refreshOptions;
const lifecycleContext = {
  signals: {windowForm: signal},
  Context: (ref) => ({
    records_patch: {signals: {control: {subscribe: (fn) => { controlSubscriber = fn; return () => {}; }}, collection: {peek: () => [{id: 1, name: 'new'}]}}, handlers: {dataSource: {setInputParameters() {}, fetchCollection() {}}}},
    records: {signals: {collection: {peek: () => sourceRows, set value(next) { sourceRows = next; }}}, handlers: {dataSource: {fetchCollection: (options) => { refreshOptions = options; }}}},
  }[ref]),
};
let settled = false;
assert.equal(dispatchMutationCommand(lifecycleContext, {
  dataSourceRef: 'records_patch',
  successState: {saved: true},
  reconcile: {mode: 'merge', dataSourceRef: 'records', identityField: 'id'},
  refresh: [{dataSourceRef: 'records', bypassCache: true}],
}, {}, {onSettled: () => { settled = true; }}), true);
controlSubscriber({loading: true});
controlSubscriber({loading: false, error: null});
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(sourceRows, [{id: 1, name: 'new'}]);
assert.equal(refreshOptions.cache.bypassCache, true);
assert.equal(settled, true);
assert.equal(value.saved, true);

let invalidFetch = false;
const invalidContext = {
  authorization: {resource: {capabilities: {write: false}}},
  Context: () => ({handlers: {dataSource: {setInputParameters() {}, fetchCollection() { invalidFetch = true; }}}}),
};
assert.equal(dispatchMutationCommand(invalidContext, {dataSourceRef: 'patch', validateWhen: {source: 'authorization', field: 'resource.capabilities.write', equals: true}}), false);
assert.equal(invalidFetch, false);

console.log('editableCollection model contract passed');
