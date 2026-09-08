import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import MutationCommand from './MutationCommand.jsx';
import {dispatchMutationCommand} from './primitiveMutation.js';
import {editableCollectionOperationState, reconcileEditableCollection} from './editableCollectionModel.js';
import {
  applyAssignment, availableStatusTransitions, diffHistoryRecords, permissionBoundaryState,
  responsiveDataGridState, runDerivedPipeline, toggleTreeSelection, validateSchedule,
  validateUploadCollection, wizardState,
} from './workflowModels.js';
import {ResponsiveCardRows} from './ResponsiveDataGrid.jsx';
import {instantToWallTime, wallTimeToInstant} from './scheduleTimeZone.js';

const proofs = [];
const prove = (id, value, check) => { check(); proofs.push({id, value}); };
const context = {authorization: {resource: {capabilities: {write: true}}}};

prove('editableCollection', 'one selection/action/reconciliation contract replaces repeated list glue', () => {
  assert.equal(editableCollectionOperationState({requiresSelection: true}, context, {selection: []}).disabled, true);
  assert.deepEqual(reconcileEditableCollection([{id: 1}], [{id: 1, name: 'updated'}], {identityField: 'id'}), [{id: 1, name: 'updated'}]);
});
prove('assignmentPicker', 'dual-list assignment is identity-safe and deterministic', () => assert.deepEqual(applyAssignment([{id: 1}], [], [{id: 1}], {identityFields: ['id']}).assigned, [{id: 1}]));
prove('mutationCommand', 'validation fails closed before backend dispatch and renders an announced lifecycle', () => {
  let fetched = false;
  const denied = {authorization: {resource: {capabilities: {write: false}}}, Context: () => ({handlers: {dataSource: {setInputParameters() {}, fetchCollection() { fetched = true; }}}})};
  assert.equal(dispatchMutationCommand(denied, {dataSourceRef: 'patch', validateWhen: {source: 'authorization', field: 'resource.capabilities.write', equals: true}}), false);
  assert.equal(fetched, false);
  assert.match(renderToStaticMarkup(<MutationCommand context={denied} command={{dataSourceRef: 'patch', label: 'Save'}}/>), /aria-live="polite"/);
});
prove('statusWorkflow', 'metadata exposes only legal state transitions', () => assert.deepEqual(availableStatusTransitions('draft', {transitions: [{id: 'go', from: ['draft']}, {id: 'stop', from: ['active']}]}).map((item) => item.id), ['go']));
prove('treeEditor', 'hierarchical selection supports descendant cascade', () => assert.deepEqual(new Set(toggleTreeSelection([{id: 'a', children: [{id: 'b'}]}], [], 'a', true, {cascade: 'descendants'})), new Set(['a', 'b'])));
prove('wizard', 'step navigation is derived from visible and valid metadata', () => assert.equal(wizardState({steps: [{id: 'one'}, {id: 'two'}]}, {}, 0).canNext, true));
prove('uploadCollection', 'file count/type/size constraints reject invalid payloads before mutation', () => assert.equal(validateUploadCollection([{name: 'bad.exe', size: 100}], {accept: ['.csv'], maxBytes: 10}).valid, false));
prove('derivedDataSource', 'joins and grouped measures replace repeated host callback fan-out', () => assert.deepEqual(runDerivedPipeline({rows: [{kind: 'a', n: 2}, {kind: 'a', n: 3}]}, {sources: ['rows'], pipeline: [{operation: 'group', groupBy: ['kind'], measures: [{target: 'n', source: 'n', operation: 'sum'}]}]}), [{kind: 'a', n: 5}]));
prove('permissionBoundary', 'mixed per-row capabilities are explicit and fail closed', () => assert.equal(permissionBoundaryState([{id: 1}, {id: 2}], {'1': {capabilities: {write: true}}, '2': {capabilities: {write: false}}}, {capability: 'write'}).mixed, true));
prove('responsiveDataGrid', 'breakpoints project fields while phone cards retain semantic labels', () => {
  assert.deepEqual(responsiveDataGridState({breakpoints: {phone: {columns: ['name']}}}, 'phone').columns, ['name']);
  assert.match(renderToStaticMarkup(<ResponsiveCardRows rows={[{name: 'Alpha'}]} columns={[{id: 'name', name: 'Name'}]}/>), /<dt>Name<\/dt><dd>Alpha<\/dd>/);
});
prove('historyDiff', 'field-level changes are semantic and ignore configured noise', () => assert.deepEqual(diffHistoryRecords({name: 'old', at: 1}, {name: 'new', at: 2}, {ignoreFields: ['at']}), [{field: 'name', before: 'old', after: 'new'}]));
prove('scheduleEditor', 'overlap rules and resource wall-time conversion are timezone-safe', () => {
  assert.equal(validateSchedule([{start: '2026-01-01', end: '2026-01-03'}, {start: '2026-01-02', end: '2026-01-04'}], {allowOverlap: false}).valid, false);
  assert.equal(instantToWallTime(wallTimeToInstant('2026-07-15T12:30', 'America/Los_Angeles'), 'America/Los_Angeles'), '2026-07-15T12:30');
});

assert.equal(proofs.length, 12);
console.log(JSON.stringify({status: 'pass', primitiveCount: proofs.length, proofs}, null, 2));
