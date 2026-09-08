import assert from 'node:assert/strict';
import {dispatchMutationCommand, executeCommand, getCommandState, mergeCommandParameters, resolveCommandConfirmation, resolveIndeterminateCommand} from './commandExecutor.js';

const mutableSignal = (initial) => {
  let value = initial;
  const listeners = new Set();
  return {
    peek: () => value,
    get value() { return value; },
    set value(next) { value = next; listeners.forEach((listener) => listener(next)); },
    subscribe(listener) { listeners.add(listener); listener(value); return () => listeners.delete(listener); },
  };
};

let writerCalls = 0;
let parameters;
let refreshCalls = 0;
const patchControl = mutableSignal({loading: false, error: null});
const rowsSignal = mutableSignal([{id: 1, name: 'old'}]);
const patch = {
  signals: {control: patchControl, collection: mutableSignal([{id: 1, name: 'new'}])},
  handlers: {dataSource: {
    setInputParameters(value) { parameters = value; },
    fetchCollection() { writerCalls += 1; patchControl.value = {loading: true, error: null}; queueMicrotask(() => { patchControl.value = {loading: false, error: null}; }); },
  }},
};
let clearSelectionCalls = 0;
const rows = {signals: {collection: rowsSignal}, handlers: {dataSource: {resetSelection() { clearSelectionCalls += 1; }, fetchCollection() { refreshCalls += 1; return Promise.reject(new Error('summary unavailable')); }}}};
const context = {authorization: {resource: {capabilities: {write: true}}}, Context: (ref) => ({patch, rows}[ref])};

const order = [];
assert.equal(resolveCommandConfirmation({confirmSelection: {action: 'Remove', singularLabel: 'Creative', pluralLabel: 'Creatives', labelField: 'name', identityField: 'id', maxItems: 2, suffix: 'Inventory is retained.'}}, {selectedRows: [{id: 7, name: 'Alpha'}]}), 'Remove 1 Creative: Alpha (7)? Inventory is retained.');
assert.equal(resolveCommandConfirmation({confirmSelection: {action: 'Remove', singularLabel: 'Creative', pluralLabel: 'Creatives', labelField: 'name', identityField: 'id', maxItems: 2}}, {selectedRows: [{id: 7, name: 'Alpha'}, {id: 8, name: 'Beta'}, {id: 9, name: 'Gamma'}]}), 'Remove 3 Creatives: Alpha (7), Beta (8), +1 more?');
const command = {
  dataSourceRef: 'patch',
  validateWhen: {source: 'authorization', field: 'resource.capabilities.write', equals: true},
  confirm: 'Continue?',
  reconcile: {mode: 'merge', dataSourceRef: 'rows', identityField: 'id'},
  refresh: [{dataSourceRef: 'rows', bypassCache: true, clearSelection: true}],
};
const first = executeCommand(context, command, {id: 1}, {confirm: async () => { order.push('confirm'); return true; }});
const duplicate = await executeCommand(context, command, {id: 1});
assert.equal(duplicate.status, 'suppressed');
const outcome = await first;
assert.equal(outcome.status, 'succeeded');
assert.equal(writerCalls, 1);
assert.equal(clearSelectionCalls, 1);
assert.deepEqual(parameters, {id: 1});
assert.deepEqual(rowsSignal.value, [{id: 1, name: 'new'}]);
assert.equal(refreshCalls, 1);
assert.equal(getCommandState(context, command).writerStatus, 'succeeded');
assert.equal(getCommandState(context, command).syncStatus, 'partial_failure');
assert.match(getCommandState(context, command).message, /Some related data/);
assert.deepEqual(order, ['confirm']);

let cancelledWriterCalls = 0;
const cancelContext = {Context: () => ({handlers: {dataSource: {setInputParameters() {}, fetchCollection() { cancelledWriterCalls += 1; }}}})};
assert.equal((await executeCommand(cancelContext, {dataSourceRef: 'cancel', confirm: 'Continue?'}, {}, {confirm: async () => false})).status, 'cancelled');
assert.equal(cancelledWriterCalls, 0);

const denied = {authorization: {resource: {capabilities: {write: false}}}, Context: () => patch};
assert.equal((await executeCommand(denied, {dataSourceRef: 'patch', validateWhen: {source: 'authorization', field: 'resource.capabilities.write', equals: true}})).status, 'invalid');
assert.equal(writerCalls, 1);

const hanging = {signals: {control: mutableSignal({loading: false})}, handlers: {dataSource: {setInputParameters() {}, fetchCollection() {}}}};
const timeoutContext = {Context: () => hanging};
const timed = await executeCommand(timeoutContext, {dataSourceRef: 'hang', timeoutMs: 1, indeterminateState: {outcome: 'unknown'}});
assert.equal(timed.status, 'indeterminate');
assert.equal(getCommandState(timeoutContext, {dataSourceRef: 'hang'}).writerStatus, 'indeterminate');
assert.equal(getCommandState(timeoutContext, {dataSourceRef: 'hang'}).retryAllowed, false);
assert.equal((await executeCommand(timeoutContext, {dataSourceRef: 'hang', timeoutMs: 1})).status, 'suppressed');
assert.equal((await executeCommand(timeoutContext, {commandId: 'other', dataSourceRef: 'hang'})).status, 'transport_busy');
const timeoutCallerB = {Context: () => hanging};
assert.equal((await executeCommand(timeoutCallerB, {commandId: 'caller-b', dataSourceRef: 'hang'})).status, 'transport_busy');
assert.equal(resolveIndeterminateCommand(timeoutContext, {dataSourceRef: 'hang'}, 'Authoritative recovery completed.'), true);
assert.equal(getCommandState(timeoutContext, {dataSourceRef: 'hang'}).phase, 'idle');

const indeterminateTarget = {signals: {control: mutableSignal({loading: false})}, handlers: {dataSource: {setInputParameters() {}, fetchCollection() {}}}};
const throwingIndeterminateForm = {peek: () => ({}), set value(_) { throw new Error('indeterminate state boom'); }};
const indeterminateCallerA = {signals: {windowForm: throwingIndeterminateForm}, Context: () => indeterminateTarget};
const indeterminateCallerB = {Context: () => indeterminateTarget};
const unknown = await executeCommand(indeterminateCallerA, {dataSourceRef: 'unknown', timeoutMs: 1, indeterminateState: {outcome: 'unknown'}});
assert.equal(unknown.status, 'indeterminate');
assert.equal(getCommandState(indeterminateCallerA, {dataSourceRef: 'unknown'}).writerStatus, 'indeterminate');
assert.equal(getCommandState(indeterminateCallerA, {dataSourceRef: 'unknown'}).retryAllowed, false);
assert.equal((await executeCommand(indeterminateCallerB, {commandId: 'other', dataSourceRef: 'unknown'})).status, 'transport_busy');
assert.equal(resolveIndeterminateCommand(indeterminateCallerA, {dataSourceRef: 'unknown'}), true);

let unconfirmedCalls = 0;
const unconfirmedContext = {Context: () => ({handlers: {dataSource: {setInputParameters() {}, fetchCollection() { unconfirmedCalls += 1; return Promise.resolve(); }}}})};
assert.equal((await executeCommand(unconfirmedContext, {dataSourceRef: 'destructive', confirm: 'Confirm?'})).status, 'confirmation_unavailable');
assert.equal(dispatchMutationCommand(unconfirmedContext, {dataSourceRef: 'destructive', confirm: 'Confirm?'}), false);
await Promise.resolve();
assert.equal(unconfirmedCalls, 0);

const throwingContext = {Context: () => { throw new Error('context boom'); }};
assert.equal((await executeCommand(throwingContext, {dataSourceRef: 'throw'})).status, 'failed');
assert.equal(getCommandState(throwingContext, {dataSourceRef: 'throw'}).guarded, false);
const setInputContext = {Context: () => ({handlers: {dataSource: {setInputParameters() { throw new Error('input boom'); }, fetchCollection() { throw new Error('must not run'); }}}})};
assert.equal((await executeCommand(setInputContext, {dataSourceRef: 'input'})).status, 'failed');
assert.equal(getCommandState(setInputContext, {dataSourceRef: 'input'}).pending, false);
const preflightControl = mutableSignal({loading: false, error: null});
const preflightError = new Error('datasource preflight failed');
const preflightContext = {Context: () => ({signals: {control: preflightControl}, handlers: {dataSource: {setInputParameters() {}, fetchCollection() { preflightControl.value = {loading: false, error: preflightError}; }}}})};
const preflight = await executeCommand(preflightContext, {dataSourceRef: 'preflight', timeoutMs: 30000});
assert.equal(preflight.status, 'failed', 'a datasource error before loading must settle immediately');
assert.equal(preflight.error, preflightError);
assert.equal(getCommandState(preflightContext, {dataSourceRef: 'preflight'}).guarded, false);
let replayedErrorWriterCalls = 0;
const replayedError = new Error('previous writer error');
const replayedErrorControl = mutableSignal({loading: false, error: replayedError});
const replayedErrorContext = {Context: () => ({signals: {control: replayedErrorControl}, handlers: {dataSource: {setInputParameters() {}, fetchCollection() { replayedErrorWriterCalls += 1; replayedErrorControl.value = {loading: true, error: null}; queueMicrotask(() => { replayedErrorControl.value = {loading: false, error: null}; }); }}}})};
const replayedErrorOutcome = await executeCommand(replayedErrorContext, {dataSourceRef: 'replayed-error', timeoutMs: 30000});
assert.equal(replayedErrorOutcome.status, 'succeeded', 'a synchronously replayed prior error must not block a new writer invocation');
assert.equal(replayedErrorWriterCalls, 1, 'retry must invoke the writer exactly once after ignoring the replayed error');
const resolvedBeforeControl = mutableSignal({loading: false, error: null});
const delayedControlError = new Error('writer control rejected resolved transport');
const resolvedBeforeControlContext = {Context: () => ({signals: {control: resolvedBeforeControl}, handlers: {dataSource: {setInputParameters() {}, fetchCollection() { queueMicrotask(() => { resolvedBeforeControl.value = {loading: false, error: delayedControlError}; }); return Promise.resolve(); }}}})};
const resolvedBeforeControlOutcome = await executeCommand(resolvedBeforeControlContext, {dataSourceRef: 'resolved-before-control', timeoutMs: 30000});
assert.equal(resolvedBeforeControlOutcome.status, 'failed', 'observable writer success must come from control state, not early Promise resolution');
assert.equal(resolvedBeforeControlOutcome.error, delayedControlError);
const resolvedWithoutPulseControl = mutableSignal({loading: false, error: null});
const resolvedWithoutPulseContext = {Context: () => ({signals: {control: resolvedWithoutPulseControl}, handlers: {dataSource: {setInputParameters() {}, fetchCollection() { return Promise.resolve(); }}}})};
const resolvedWithoutPulseOutcome = await executeCommand(resolvedWithoutPulseContext, {dataSourceRef: 'resolved-without-pulse', timeoutMs: 30000});
assert.equal(resolvedWithoutPulseOutcome.status, 'succeeded', 'a resolved writer must not remain pending when an observable control stays idle');
assert.equal(getCommandState(resolvedWithoutPulseContext, {dataSourceRef: 'resolved-without-pulse'}).guarded, false);
const peekOnlyControlError = new Error('peek-only writer failed');
const peekOnlyControl = {value: {loading: false, error: null}, peek() { return this.value; }};
const peekOnlyContext = {Context: () => ({signals: {control: peekOnlyControl}, handlers: {dataSource: {setInputParameters() {}, fetchCollection() { peekOnlyControl.value = {loading: false, error: peekOnlyControlError}; return Promise.resolve(); }}}})};
const peekOnlyOutcome = await executeCommand(peekOnlyContext, {dataSourceRef: 'peek-only', timeoutMs: 30000});
assert.equal(peekOnlyOutcome.status, 'failed', 'resolved transport must inspect non-subscribable control errors before success');
assert.equal(peekOnlyOutcome.error, peekOnlyControlError);
const parameterContext = {identity: {dataSourceRef: 'source'}, dataSources: {source: {}}, Context: () => { throw new Error('parameter boom'); }};
assert.equal((await executeCommand(parameterContext, {dataSourceRef: 'patch', parameters: [{name: 'Id', in: 'selection', location: 'source.id'}]})).status, 'failed');
assert.equal(getCommandState(parameterContext, {dataSourceRef: 'patch'}).guarded, false);
assert.equal((await executeCommand(cancelContext, {dataSourceRef: 'confirm-reject', confirm: 'Confirm?'}, {}, {confirm: async () => { throw new Error('confirm boom'); }})).status, 'failed');

let correlatedParameters;
const correlatedContext = {Context: () => ({handlers: {dataSource: {setInputParameters(value) { correlatedParameters = value; }, fetchCollection() { return Promise.resolve(); }}}})};
const correlated = await executeCommand(correlatedContext, {dataSourceRef: 'correlated', invocationParameter: 'RequestId'}, {}, {onSettled() { throw new Error('observer failure'); }});
assert.equal(correlated.status, 'succeeded');
assert.equal(correlatedParameters.RequestId, correlated.invocationId);

let independentCalls = 0;
let finishShared;
const sharedTarget = {handlers: {dataSource: {setInputParameters() {}, fetchCollection() { independentCalls += 1; return new Promise((resolve) => { finishShared = resolve; }); }}}};
const independentContext = {Context: () => sharedTarget};
const sharedFirst = executeCommand(independentContext, {commandId: 'edit', dataSourceRef: 'shared'});
const sharedSecond = await executeCommand(independentContext, {commandId: 'archive', dataSourceRef: 'shared'});
assert.equal(sharedSecond.status, 'transport_busy');
assert.equal(independentCalls, 1);
finishShared();
await sharedFirst;

let distinctCalls = 0;
const distinctContext = {Context: () => ({handlers: {dataSource: {setInputParameters() {}, fetchCollection() { distinctCalls += 1; return Promise.resolve(); }}}})};
await Promise.all([executeCommand(distinctContext, {commandId: 'edit', dataSourceRef: 'left'}), executeCommand(distinctContext, {commandId: 'archive', dataSourceRef: 'right'})]);
assert.equal(distinctCalls, 2);

let unstableFinish;
let unstableCalls = 0;
const unstableCallerSignal = mutableSignal({loading: false});
const unstableTargetControl = mutableSignal({loading: false});
const unstableTarget = () => ({
  signals: {control: unstableTargetControl},
  handlers: {dataSource: {
    setInputParameters() {},
    fetchCollection() { unstableCalls += 1; return new Promise((resolve) => { unstableFinish = resolve; }); },
  }},
});
const unstableCallerA = {signals: {control: unstableCallerSignal}, Context: unstableTarget};
const unstableCallerB = {signals: {control: unstableCallerSignal}, Context: unstableTarget};
const unstableCommand = {commandId: 'unstable-wrapper-save', dataSourceRef: 'unstable-target'};
const unstableFirst = executeCommand(unstableCallerA, unstableCommand);
assert.equal(getCommandState(unstableCallerB, unstableCommand).phase, 'pending', 'replacement context wrappers must observe the active command');
assert.equal((await executeCommand(unstableCallerB, unstableCommand)).status, 'suppressed');
assert.equal((await executeCommand(unstableCallerB, {commandId: 'other-wrapper-command', dataSourceRef: 'unstable-target'})).status, 'transport_busy');
assert.equal(unstableCalls, 1);
unstableFinish();
await unstableFirst;
assert.equal(getCommandState(unstableCallerB, unstableCommand).phase, 'succeeded', 'replacement context wrappers must observe terminal command state');

let sharedCrossFinish;
let sharedCrossCalls = 0;
const sharedCrossTarget = {handlers: {dataSource: {setInputParameters() {}, fetchCollection() { sharedCrossCalls += 1; return new Promise((resolve) => { sharedCrossFinish = resolve; }); }}}};
const callerA = {Context: () => sharedCrossTarget};
const callerB = {Context: () => sharedCrossTarget};
const crossFirst = executeCommand(callerA, {commandId: 'a', dataSourceRef: 'shared-cross'});
assert.equal((await executeCommand(callerB, {commandId: 'b', dataSourceRef: 'shared-cross'})).status, 'transport_busy');
assert.equal(sharedCrossCalls, 1);
sharedCrossFinish();
await crossFirst;

const committedTarget = {signals: {collection: mutableSignal([{id: 1}])}, handlers: {dataSource: {setInputParameters() {}, fetchCollection() { return Promise.resolve(); }}}};
const reconcileThrowContext = {Context: (ref) => { if (ref === 'patch') return committedTarget; throw new Error('sync context boom'); }};
const committed = await executeCommand(reconcileThrowContext, {dataSourceRef: 'patch', reconcile: {mode: 'merge', dataSourceRef: 'rows', identityField: 'id'}});
assert.equal(committed.status, 'succeeded');
assert.equal(getCommandState(reconcileThrowContext, {dataSourceRef: 'patch'}).writerStatus, 'succeeded');
assert.equal(getCommandState(reconcileThrowContext, {dataSourceRef: 'patch'}).syncStatus, 'partial_failure');

const throwingWindowForm = {peek: () => ({}), set value(_) { throw new Error('state boom'); }};
const successStateContext = {signals: {windowForm: throwingWindowForm}, Context: () => committedTarget};
const stateWarning = await executeCommand(successStateContext, {dataSourceRef: 'patch', successState: {saved: true}});
assert.equal(stateWarning.status, 'succeeded');
assert.equal(getCommandState(successStateContext, {dataSourceRef: 'patch'}).writerStatus, 'succeeded');
assert.equal(getCommandState(successStateContext, {dataSourceRef: 'patch'}).syncStatus, 'partial_failure');

let resourceParameters;
const resourceRead = {signals: {collection: mutableSignal([{id: 9, name: 'Before', enabled: true}])}};
const resourcePatch = {handlers: {dataSource: {setInputParameters(value) { resourceParameters = value; }, fetchCollection() { return Promise.resolve(); }}}};
const resourceContext = {
  metadata: {
    schemas: {record: {type: 'object', required: ['id', 'name'], properties: {id: {type: 'integer'}, name: {type: 'string'}, enabled: {type: 'boolean'}}}},
    resourceModels: {record: {schemaRef: 'record', read: {dataSourceRef: 'read'}, write: {inputPath: 'Records', mode: 'overlayBaseline', collection: true}, fields: {id: {write: 'Id'}, name: {write: 'Name'}, enabled: {write: 'Enabled'}}}},
  },
  Context: (ref) => ref === 'patch' ? resourcePatch : resourceRead,
};
const resourceOutcome = await executeCommand(resourceContext, {
  dataSourceRef: 'patch',
  payload: {modelRef: 'record', source: {scope: 'extras', selector: 'data'}, baseline: {scope: 'collection', dataSourceRef: 'read', selector: '0'}},
}, {data: {id: '9', name: 'After'}});
assert.equal(resourceOutcome.status, 'succeeded');
assert.deepEqual(resourceParameters, {Records: [{Id: 9, Name: 'After', Enabled: true}]});

const mutableDraft = {id: 9, name: 'Before confirmation'};
const snapshotOutcome = await executeCommand(resourceContext, {
  commandId: 'resource-confirm-snapshot',
  dataSourceRef: 'patch',
  confirm: 'Save?',
  payload: {modelRef: 'record', source: {scope: 'extras', selector: 'data'}, baseline: {scope: 'collection', dataSourceRef: 'read', selector: '0'}},
}, {data: mutableDraft}, {confirm: async () => { mutableDraft.name = 'Changed while confirming'; return true; }});
assert.equal(snapshotOutcome.status, 'succeeded');
assert.equal(resourceParameters.Records[0].Name, 'Before confirmation', 'writer input is an immutable pre-confirmation snapshot');

assert.deepEqual(mergeCommandParameters(
  {Mutation: {recordId: 101, trace: 'base'}, Header: 'keep'},
  {Mutation: {operation: 'assign', relatedItemIds: [11]}},
), {Mutation: {recordId: 101, trace: 'base', operation: 'assign', relatedItemIds: [11]}, Header: 'keep'});

console.log('canonical command executor contract passed');
