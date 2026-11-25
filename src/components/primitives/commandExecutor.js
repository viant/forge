import {withoutAuthorizationValidationHints} from '../../runtime/canonicalDelivery.js';
import {resolveParameters} from '../../hooks/parameters.js';
import {evaluateCondition} from '../../utils/evaluateCondition.js';
import {resolveSelector, resolveSelectorParts} from '../../utils/selector.js';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import {applyPrimitiveState, mutationCommandTargetParameters, reconcileEditableCollection} from './editableCollectionModel.js';
import {prepareResourcePayload} from './resourceModel.js';
import {formatDataSourceError} from '../../utils/dataSourceError.js';
import {findDialogSignal, protectedWindowEpoch} from '../../core/store/signals.js';

const commandStates = new WeakMap();
const transportStates = new WeakMap();

const commandErrorMessage = (error) => formatDataSourceError(error) || 'The request could not be completed.';

function stableContextOwner(context) {
  return context?.signals?.control || context?.signals?.input || context;
}

function acquireTransport(target, commandKey) {
  const owner = stableContextOwner(target);
  const current = transportStates.get(owner);
  if (current?.guarded) return false;
  transportStates.set(owner, {guarded: true, commandKey});
  return true;
}

function releaseTransport(target, commandKey) {
  const owner = stableContextOwner(target);
  const current = transportStates.get(owner);
  if (!current?.guarded || current.commandKey !== commandKey) return false;
  transportStates.delete(owner);
  return true;
}

export function commandGuardKey(command = {}) {
  return String(command.commandId || command.dataSourceRef || '').trim();
}

function stateEntry(context, key) {
  if (!context || !key) return null;
  const owner = stableContextOwner(context);
  if (!commandStates.has(owner)) commandStates.set(owner, new Map());
  const states = commandStates.get(owner);
  if (!states.has(key)) states.set(key, {value: {phase: 'idle', guarded: false, pending: false, retryAllowed: true, error: null, message: '', invocationId: '', writerStatus: 'idle', syncStatus: 'not_started'}, listeners: new Set()});
  return states.get(key);
}

// Optional command groups share the same context ownership as lifecycle state.
// Leases belong to one invocation, so another row cannot release its guard.
function acquireSerialization(context, command, key) {
  const name = String(command.serializationGroup || '').trim();
  if (!name) return true;
  const entry = stateEntry(context, key);
  if (!entry) return false;
  const owner = context?.signals?.windowForm || stableContextOwner(context);
  if (!commandStates.has(owner)) commandStates.set(owner, new Map());
  const states = commandStates.get(owner);
  states.serializationGroups ||= new Map();
  const groupKey = JSON.stringify([context?.identity?.windowId || '', name]);
  const groups = states.serializationGroups;
  if (groups.has(groupKey)) return false;
  const lease = {groups, groupKey};
  groups.set(groupKey, lease);
  entry.serializationLease = lease;
  return true;
}

function releaseSerialization(context, key) {
  const entry = stateEntry(context, key);
  const lease = entry?.serializationLease;
  if (!lease) return;
  if (lease.groups.get(lease.groupKey) === lease) lease.groups.delete(lease.groupKey);
  delete entry.serializationLease;
}

function publish(context, key, patch) {
  const entry = stateEntry(context, key);
  if (!entry) return;
  entry.value = {...entry.value, ...patch};
  entry.listeners.forEach((listener) => { try { listener(entry.value); } catch (_) {} });
}

export function getCommandState(context, command = {}) {
  return stateEntry(context, commandGuardKey(command))?.value || {phase: 'idle', guarded: false, pending: false, retryAllowed: true, error: null, message: '', writerStatus: 'idle', syncStatus: 'not_started'};
}

export function subscribeCommand(context, command = {}, listener) {
  const entry = stateEntry(context, commandGuardKey(command));
  if (!entry) return () => {};
  entry.listeners.add(listener);
  listener(entry.value);
  return () => entry.listeners.delete(listener);
}

export function resetCommandState(context, command = {}) {
  const key = commandGuardKey(command);
  const current = getCommandState(context, command);
  if (!key || current.guarded || !['succeeded', 'failed'].includes(current.phase)) return false;
  publish(context, key, {phase: 'idle', guarded: false, pending: false, retryAllowed: true, error: null, message: '', invocationId: '', writerStatus: 'idle', syncStatus: 'not_started', warnings: []});
  return true;
}

const invocationID = () => globalThis.crypto?.randomUUID?.() || `cmd-${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function prepareCommandParameters(context, command, parameters, extras) {
  const prepare = context?.lookupHandler?.(command.prepare);
  if (typeof prepare !== 'function') throw new Error(`Command preparation handler is unavailable: ${command.prepare}`);
  const controller = new AbortController();
  let timer;
  try {
    const prepared = await Promise.race([
      Promise.resolve().then(() => prepare({context, parameters: parameterSnapshot(parameters), extras, signal: controller.signal})),
      new Promise((_, reject) => { timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Command preparation timed out. The writer was not invoked.'));
      }, Math.max(1000, Number(command.timeoutMs) || 30000)); }),
    ]);
    if (!prepared || typeof prepared !== 'object' || Array.isArray(prepared)) throw new Error('Command preparation must return a parameter map.');
    return parameterSnapshot(prepared);
  } finally { clearTimeout(timer); }
}

function awaitWriter(target, invoke, timeoutMs, requireRecords = false) {
  return new Promise((resolve) => {
    let settled = false;
    let loadingSeen = false;
    let invocationStarted = false;
    let timer = null;
    let dispose = () => {};
    const settle = (outcome) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      dispose();
      resolve(outcome);
    };
    const control = target?.signals?.control;
    const previousError = (control?.peek?.() || control?.value || {}).error;
    const observed = !requireRecords && typeof control?.subscribe === 'function';
    if (observed) dispose = control.subscribe((value = {}) => {
      if (!invocationStarted) return;
      if (value.loading) { loadingSeen = true; return; }
      // Parameter/stale publications can carry the prior invocation's error
      // before this retry starts loading. Fresh failures and terminal promise
      // outcomes still settle normally.
      if (value.error && (loadingSeen || value.error !== previousError)) { settle({status: 'failed', error: value.error}); return; }
      if (loadingSeen) settle(value.error ? {status: 'failed', error: value.error} : {status: 'succeeded'});
    });
    if (settled) return;
    timer = setTimeout(() => settle({status: 'indeterminate', error: new Error('The writer outcome is unknown because the client stopped waiting.')}), timeoutMs);
    try {
      invocationStarted = true;
      const result = invoke();
      if (result === false) settle({status: 'failed', error: new Error('The datasource rejected the command before invocation.')});
      else if (requireRecords) {
        // A control notification can belong to a different request. Only the
        // invocation promise can supply its own normalized response rows.
        if (!result?.then) settle({status: 'indeterminate', error: new Error('The writer did not provide an invocation receipt.')});
        else result.then(records => {
          if (Array.isArray(records)) settle({status: 'succeeded', records});
          else settle({status: 'indeterminate', error: new Error('The writer did not return invocation records.')});
        }, error => settle({status: error?.code === 'request_superseded' ? 'indeterminate' : 'failed', error}));
      } else if (result?.then) result.then(() => {
        // Some datasource transports resolve their request promise without ever
        // publishing a loading pulse. Give the control signal one event-loop
        // turn to publish a terminal error, then use the resolved transport as
        // the success acknowledgement when the control is already idle.
        setTimeout(() => {
          const value = control?.peek?.() || control?.value || {};
          if (value.error) settle({status: 'failed', error: value.error});
          else if (value.loading) loadingSeen = true;
          else settle({status: 'succeeded'});
        }, 0);
      }, (error) => settle({status: 'failed', error}));
      else if (!observed) settle({status: 'succeeded'});
    } catch (error) { settle({status: 'failed', error}); }
  });
}

async function synchronizeUI(context, target, command, writerResponse = null, authorizationIsCurrent = () => true, formSynchronization = null) {
  const warnings = [];
  if (!authorizationIsCurrent()) return [{stage: 'authorization', error: new Error('Authorization context changed before UI synchronization.')}];
  const refreshOptions = (destination, bypassCache) => ({
    ...(bypassCache ? {cache: {bypassCache: true}} : {}),
    ...(formSynchronization && context?.identity?.dataSourceId && destination?.identity?.dataSourceId === context.identity.dataSourceId
      ? {formSynchronization, invocationId: invocationID()} : {}),
  });
  if (command.reconcile) {
    const spec = command.reconcile;
    try {
      const destination = context?.Context?.(spec.dataSourceRef) || context;
      if (String(spec.mode || '').toLowerCase() === 'refetch') {
        const result = destination?.handlers?.dataSource?.fetchCollection?.(refreshOptions(destination, true));
        if (result?.then) await result;
        if (!authorizationIsCurrent()) return [...warnings, {stage: 'authorization', error: new Error('Authorization context changed before UI synchronization.')}];
      } else {
        const current = destination?.signals?.collection?.peek?.() || destination?.signals?.collection?.value || [];
        const response = writerResponse ?? target?.signals?.collection?.peek?.() ?? target?.signals?.collection?.value ?? [];
        const path = spec.resultPath || spec.rowsPath;
        const selected = path ? resolveSelector(response, path) : response;
        if (authorizationIsCurrent() && destination?.signals?.collection) destination.signals.collection.value = reconcileEditableCollection(current, selected, spec);
      }
    } catch (error) { warnings.push({stage: 'reconcile', error}); }
  }
  for (const refresh of command.refresh || []) {
    if (!authorizationIsCurrent()) return [...warnings, {stage: 'authorization', error: new Error('Authorization context changed before UI synchronization.')}];
    try {
      const dataContext = context?.Context?.(refresh.dataSourceRef);
      if (refresh.clearSelection === true) dataContext?.handlers?.dataSource?.resetSelection?.();
      const result = dataContext?.handlers?.dataSource?.fetchCollection?.(refreshOptions(dataContext, refresh.bypassCache));
      if (result?.then) await result;
      if (!authorizationIsCurrent()) return [...warnings, {stage: 'authorization', error: new Error('Authorization context changed before UI synchronization.')}];
    } catch (error) { warnings.push({stage: 'refresh', dataSourceRef: refresh.dataSourceRef, error}); }
  }
  return warnings;
}

function notifyLifecycle(lifecycle, name, payload) {
  try { lifecycle?.[name]?.(payload); } catch (_) { /* observers cannot change terminal state */ }
}

function parameterSnapshot(value) {
  if (!value || typeof value !== 'object') return value;
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function mergeCommandParameters(base, prepared) {
  if (!base || typeof base !== 'object' || Array.isArray(base)) return parameterSnapshot(prepared);
  if (!prepared || typeof prepared !== 'object' || Array.isArray(prepared)) return parameterSnapshot(prepared ?? base);
  const result = parameterSnapshot(base);
  for (const [key, value] of Object.entries(prepared)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
      result[key] = mergeCommandParameters(result[key], value);
    } else result[key] = parameterSnapshot(value);
  }
  return result;
}

export function resolveCommandConfirmation(command = {}, extras = {}) {
  const spec = command.confirmSelection;
  if (!spec || typeof spec !== 'object') return String(command.confirm || '');
  const rows = Array.isArray(extras?.selectedRows) ? extras.selectedRows : [];
  if (!rows.length) return String(command.confirm || '');
  const count = rows.length;
  const maxItems = Math.min(20, Math.max(1, Number(spec.maxItems) || 5));
  const labelField = String(spec.labelField || 'name');
  const identityField = String(spec.identityField || 'id');
  const items = rows.slice(0, maxItems).map((row) => {
    const label = resolveSelector(row, labelField);
    const identity = resolveSelector(row, identityField);
    if (label != null && String(label).trim() && identity != null && String(identity).trim()) return `${String(label).trim()} (${String(identity).trim()})`;
    if (label != null && String(label).trim()) return String(label).trim();
    if (identity != null && String(identity).trim()) return String(identity).trim();
    return 'Unnamed item';
  });
  if (count > maxItems) items.push(`+${count - maxItems} more`);
  const action = String(spec.action || 'Confirm').trim();
  const entity = count === 1 ? String(spec.singularLabel || 'item') : String(spec.pluralLabel || `${spec.singularLabel || 'item'}s`);
  const suffix = String(spec.suffix || '').trim();
  return `${action} ${count} ${entity}: ${items.join(', ')}?${suffix ? ` ${suffix}` : ''}`;
}

export function resolveIndeterminateCommand(context, command = {}, message = '') {
  const key = commandGuardKey(command);
  const current = getCommandState(context, command);
  if (current.phase !== 'indeterminate') return false;
  const entry = stateEntry(context, key);
  if (entry.unknownTransport && !releaseTransport(entry.unknownTransport, key)) return false;
  delete entry.unknownTransport;
  publish(context, key, {phase: 'idle', guarded: false, pending: false, retryAllowed: true, message, writerStatus: 'idle', syncStatus: 'not_started'});
  releaseSerialization(context, key);
  return true;
}

function frozenCopy(value) {
  const copy = parameterSnapshot(value);
  function freeze(node) {
    if (!node || typeof node !== 'object' || Object.isFrozen(node)) return;
    Object.freeze(node);
    for (const child of Object.values(node)) freeze(child);
  }
  freeze(copy);
  return copy;
}

// Only the values this invocation actually installed may hide its own guard.
// Other edits and live permission, selection and capacity predicates remain visible.
function pendingValidationContext(context, patch, original) {
  if (!patch || !Object.keys(patch).length || !context.signals?.windowForm) return context;
  const windowForm = context.signals.windowForm;
  const peek = () => {
    const current = windowForm.peek?.() ?? windowForm.value ?? {};
    const values = {...current};
    for (const [key, pending] of Object.entries(patch)) {
      if (!Object.is(current[key], pending)) continue;
      if (Object.hasOwn(original, key)) values[key] = original[key];
      else delete values[key];
    }
    return values;
  };
  const masked = candidate => candidate?.signals?.windowForm === windowForm
    ? {...candidate, signals: {...candidate.signals, windowForm: {peek}}}
    : candidate;
  return {...masked(context), Context: ref => masked(context.Context?.(ref))};
}

function sequenceInputs(extras) {
  const {steps: reserved, ...base} = extras || {};
  return {base: frozenCopy(base), receipts: Object.create(null), cleanups: [], attempted: false};
}

function withStepReceipts(sequence) {
  return {...sequence.base, steps: Object.freeze({...sequence.receipts})};
}

function stepError(status, id, cause) {
  const error = new Error(commandErrorMessage(cause), {cause});
  return Object.assign(error, {stepStatus: status, failedStepId: id, primary: cause});
}

function usesOnlyReceiptRows(rule) {
  if (!rule || typeof rule !== 'object') return false;
  for (const group of ['all', 'any', 'not']) {
    if (!Object.hasOwn(rule, group)) continue;
    if (Object.keys(rule).length !== 1) return false;
    if (group === 'not') return usesOnlyReceiptRows(rule.not);
    return Array.isArray(rule[group]) && rule[group].length > 0 && rule[group].every(usesOnlyReceiptRows);
  }
  const paths = [rule.field, rule.selector, rule.key].filter((path) => typeof path === 'string' && path.length > 0);
  if (rule.source !== 'collection' || rule.dataSourceRef || paths.length !== 1) return false;
  const [index, ...fields] = paths[0].split('.');
  return (
    /^(0|[1-9]\d*)$/.test(index) &&
    fields.every(
      (field) =>
        field &&
        field.trim() === field &&
        !/[/:\[\]]/.test(field) &&
        !['__proto__', 'prototype', 'constructor'].includes(field)
    )
  );
}

function sequenceDefinitionError(command) {
  const ids = new Set([commandGuardKey(command)]);
  for (const entry of command.before) {
    if (entry?.cleanup?.receiptWhen && !usesOnlyReceiptRows(entry.cleanup.receiptWhen))
      return 'Cleanup conditions require invocation collection fields.';
    if (entry?.command?.receiptWhen) return 'Only a cleanup command may declare receiptWhen.';
    if (!entry?.command) return 'A preparation step requires a command.';
    for (const part of [entry.command, entry.cleanup].filter(Boolean)) {
      const id = part.commandId;
      if (
        typeof id !== 'string' ||
        !id.trim() ||
        id.trim() !== id ||
        /[.:/\[\]]/.test(id) ||
        ids.has(id) ||
        ['constructor', 'prototype', '__proto__'].includes(id) ||
        typeof part.dataSourceRef !== 'string' ||
        !part.dataSourceRef.trim()
      ) {
        return 'Preparation and cleanup commands require distinct command IDs and writer references.';
      }
      ids.add(id);
      if (
        part.clearFormFields?.length ||
        part.before?.length ||
        part.confirm ||
        part.confirmSelection ||
        part.serializationGroup ||
        part.reconcile ||
        part.refresh?.length ||
        ['pendingState', 'cleanupState', 'successState', 'errorState', 'indeterminateState', 'resultState'].some(
          (k) => Object.keys(part[k] || {}).length
        )
      ) {
        return 'The root command owns confirmation, sequencing and UI synchronization.';
      }
    }
  }
}

function ambiguousWriterFailure(error) {
  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status);
  return (
    status === 408 ||
    status >= 500 ||
    error?.name === 'AbortError' ||
    error?.name === 'TimeoutError' ||
    error?.name === 'TypeError' ||
    ['request_superseded', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ERR_NETWORK'].includes(error?.code)
  );
}

function preparedInputs(context, command, extras, fallback, base) {
  return mergeCommandParameters(base, command.payload ? prepareResourcePayload(context, command.payload, extras) : fallback);
}

// Every writer uses the same invocation receipt and timeout boundary.
function dispatchCommandWriter(target, command, parameters, id, requireRecords, started, strictReceipt = false) {
  target.handlers.dataSource.setInputParameters({
    ...parameters,
    ...(command.invocationParameter ? {[command.invocationParameter]: id} : {})
  });
  return awaitWriter(
    target,
    () => {
      const options = {
        cache: {bypassCache: true},
        invocationId: id,
        ...(requireRecords ? {result: strictReceipt ? 'orderedRecords' : 'records'} : {})
      };
      let result;
      try {
        result = target.handlers.dataSource.fetchCollection(options);
      } catch (error) {
        started();
        throw error;
      }
      if (!strictReceipt || result !== false) started();
      return result;
    },
    Math.max(1000, Number(command.timeoutMs) || 30000),
    requireRecords
  );
}

async function invokePreparationStep(context, command, key, sequence, current, eligible = () => true) {
  const id = command.commandId;
  let acquired = false,
    invoked = false,
    target;
  try {
    if (!current()) throw stepError('superseded', id, new Error('Command scope changed during preparation.'));
    if (command.prepare && (!eligible() || !commandValidationPasses(context, command)))
      throw stepError('invalid', id, new Error(command.invalidMessage || 'The preparation step is not eligible.'));
    const extras = withStepReceipts(sequence);
    const ref = command.dataSourceRef;
    const resolved = mutationCommandTargetParameters(resolveParameters(command.parameters || [], context) || {}, ref);
    let parameters = preparedInputs(context, command, extras, sequence.base, resolved);
    if (command.prepare) parameters = await prepareCommandParameters(context, command, parameters, extras);
    if (!current()) throw stepError('superseded', id, new Error('Command scope changed before writer invocation.'));
    if (!eligible() || !commandValidationPasses(context, command)) {
      throw stepError(
        'invalid',
        id,
        new Error(command.invalidMessage || 'Preparation eligibility changed before dispatch.')
      );
    }
    target = context.Context?.(ref);
    if (!target?.handlers?.dataSource?.setInputParameters || !target?.handlers?.dataSource?.fetchCollection) {
      throw new Error('Preparation writer is unavailable: ' + ref);
    }
    acquired = acquireTransport(target, key);
    if (!acquired) throw stepError('transport_busy', id, new Error('Another command is using this writer.'));
    const invocationId = invocationID();
    const writer = await dispatchCommandWriter(
      target,
      command,
      parameters,
      invocationId,
      true,
      () => {
        invoked = true;
        sequence.attempted = true;
      },
      true
    );
    if (writer.status !== 'succeeded') {
      const unknown = writer.status === 'indeterminate' || (invoked && ambiguousWriterFailure(writer.error));
      if (unknown) {
        stateEntry(context, key).unknownTransport = target;
        acquired = false;
      }
      throw stepError(unknown ? 'indeterminate' : 'failed', id, writer.error);
    }
    return Object.freeze({invocationId, rows: frozenCopy(writer.records)});
  } catch (cause) {
    if (cause?.stepStatus) throw cause;
    throw stepError('failed', id, cause);
  } finally {
    if (acquired) releaseTransport(target, key);
  }
}

async function unwindPreparation(context, root, sequence, key, current, presentationCurrent, warnings) {
  if (!sequence.cleanups.length || !current()) return false;
  publish(context, key, {phase: 'cleaning_up', guarded: true, pending: false, retryAllowed: false, message: 'Cleaning up…'});
  if (presentationCurrent()) {
    try {
      applyPrimitiveState(context, root.cleanupState);
    } catch (error) {
      warnings.push({stage: 'cleanupState', error});
    }
  }
  for (const command of sequence.cleanups.reverse()) {
    if (!current()) return true;
    try {
      const receipt = await invokePreparationStep(context, command, key, sequence, current);
      if (
        command.receiptWhen &&
        !evaluateCondition(command.receiptWhen, (leaf) => {
          const field = leaf.field || leaf.selector || leaf.key;
          return resolveSelectorParts(receipt.rows, field.split('.'), true);
        })
      ) {
        throw new Error('The cleanup writer did not confirm the requested operation.');
      }
    } catch (error) {
      warnings.push({
        stage: 'cleanup',
        dataSourceRef: command.dataSourceRef,
        commandId: command.commandId,
        error: error.primary ?? error
      });
      if (error.stepStatus === 'indeterminate' || error.stepStatus === 'superseded') return true;
    }
  }
  return !current();
}

function submittedFormFields(context, fields) {
  if (!fields?.length) return null;
  const submitted = new Map();
  const form = context.signals?.form?.peek?.() ?? context.handlers?.dataSource?.peekFormData?.() ?? {};
  for (const field of fields) {
    if (typeof field !== 'string' || !field || field.trim() !== field || /[.:/\[\]]/.test(field) ||
        ['__proto__', 'constructor', 'prototype'].includes(field) || submitted.has(field)) {
      throw new Error('clearFormFields requires distinct top-level form field names.');
    }
    // Published form edits replace values. Retain references to the submitted
    // values so this check never serializes or duplicates file contents.
    submitted.set(field, Object.hasOwn(form, field) ? form[field] : undefined);
  }
  return submitted;
}

function clearSubmittedFields(context, submitted, warnings) {
  if (!submitted) return;
  try {
    const source = context.handlers?.dataSource;
    const form = context.signals?.form?.peek?.() ?? source?.peekFormData?.() ?? {};
    const patch = {};
    for (const [key, original] of submitted) {
      if (original == null || !Object.is(form[key], original)) continue;
      if (Array.isArray(original) && original.length === 0) continue;
      patch[key] = Array.isArray(original) ? [] : null;
    }
    if (!Object.keys(patch).length) return;
    source.setEditedFormData({values: {...form, ...patch}});
  } catch (error) {
    warnings.push({stage: 'clearFormFields', error});
  }
}

export async function executeCommand(context, command = {}, extras = {}, lifecycle = {}) {
  const targetRef = String(command.dataSourceRef || '').trim();
  const key = commandGuardKey(command);
  if (!targetRef || !key || getCommandState(context, command).guarded) return {accepted: false, status: 'suppressed'};
  if (!acquireSerialization(context, command, key)) {
    publish(context, key, {phase: 'idle', guarded: false, pending: false, retryAllowed: true, error: null, message: 'Another command in this group is running.', writerStatus: 'not_invoked', syncStatus: 'not_started'});
    return {accepted: false, status: 'group_busy'};
  }
  const protectedWindow = context?.identity?.protectedWindow === true;
  const windowId = context?.identity?.windowId;
  const authorizationEpoch = protectedWindow ? protectedWindowEpoch(windowId) : null;
  const ordered = Array.isArray(command.before) && command.before.length > 0;
  const clearFields = Array.isArray(command.clearFormFields) && command.clearFormFields.length > 0;
  const needsExactReceipt = ordered || clearFields;
  let submittedFields;
  let sequence = null;
  let originalScope;
  let dialogSignal;
  let dialogProps;
  let validationContext = context;
  const peek = signal => signal?.peek?.() ?? signal?.value;
  const scopeSnapshot = () => JSON.stringify([peek(context?.signals?.authorization) ?? context?.authorization, peek(context?.signals?.selection)]);
  const authorizationIsCurrent = () => (!protectedWindow || protectedWindowEpoch(windowId) === authorizationEpoch) && (originalScope === undefined || scopeSnapshot() === originalScope);
  const presentationCurrent = () => !dialogSignal || (dialogSignal.peek()?.open === true && dialogSignal.peek().props === dialogProps);
  const uiIsCurrent = () => authorizationIsCurrent() && presentationCurrent();
  const rootEligible = () => commandValidationPasses(validationContext, command);
  const superseded = (accepted, invocationId = '') => {
    const error = new Error('Authorization context changed before command completion.');
    error.code = 'request_superseded';
    publish(context, key, {phase: 'failed', guarded: false, pending: false, retryAllowed: true, error, message: 'Authorization context changed. Reopen this window.', writerStatus: accepted ? 'failed' : 'not_invoked', syncStatus: 'not_started'});
    return {accepted, status: 'failed', error, invocationId};
  };
  publish(context, key, {phase: 'validating', guarded: true, pending: false, retryAllowed: false, error: null, message: 'Validating…', writerStatus: 'not_invoked', syncStatus: 'not_started'});
  let id = ordered ? invocationID() : '';
  let writerInvoked = false;
  let writerSucceeded = false;
  let transportAcquired = false;
  let target = null;
  try {
    if (command.clearFormFields != null && !Array.isArray(command.clearFormFields)) throw new Error('Expected an array of clearFormFields.');
    if (command.receiptWhen) throw new Error('Only a cleanup command may declare receiptWhen.');
    if (command.before != null && !Array.isArray(command.before)) throw new Error('Expected an array of preparation steps.');
    if (needsExactReceipt) {
      originalScope = scopeSnapshot();
      if (lifecycle.dialogId) {
        dialogSignal = findDialogSignal(`${windowId}Dialog${lifecycle.dialogId}`);
        dialogProps = dialogSignal?.peek()?.props;
      }
    }
    if (ordered) {
      sequence = sequenceInputs(extras);
      const problem = sequenceDefinitionError(command);
      if (problem) throw new Error(problem);
    }
    const resolved = resolveParameters(command.parameters || [], context) || {};
    if (!commandValidationPasses(context, command)) {
      const error = new Error(command.invalidMessage || 'This action is not currently valid.');
      publish(context, key, {phase: 'failed', guarded: false, pending: false, retryAllowed: true, error, message: error.message, writerStatus: 'not_invoked'});
      notifyLifecycle(lifecycle, 'onRejected', {status: 'invalid', error});
      return {accepted: false, status: 'invalid', error};
    }
    submittedFields = submittedFormFields(context, command.clearFormFields);
    const formSynchronization = command.synchronizeForm === true && context?.signals?.form
      ? {expectedForm: parameterSnapshot(context.signals.form.peek?.() ?? context.signals.form.value)} : null;
    const baseParameters = mutationCommandTargetParameters(resolved, targetRef);
    let preparedSnapshot = sequence ? null : preparedInputs(context, command, extras, extras, baseParameters);
    let preparationExtras = command.prepare && !sequence ? parameterSnapshot(extras) : null;
    const confirmation = resolveCommandConfirmation(command, extras);
    if (confirmation) {
      if (typeof lifecycle.confirm !== 'function') {
        const error = new Error('Confirmation is required but no confirmation service is available.');
        publish(context, key, {phase: 'failed', guarded: false, pending: false, retryAllowed: true, error, message: error.message, writerStatus: 'not_invoked'});
        return {accepted: false, status: 'confirmation_unavailable', error};
      }
      publish(context, key, {phase: 'confirming', guarded: true, message: confirmation});
      if (!await lifecycle.confirm(confirmation)) {
        publish(context, key, {phase: 'idle', guarded: false, pending: false, retryAllowed: true, error: null, message: '', writerStatus: 'not_invoked', syncStatus: 'not_started'});
        return {accepted: false, status: 'cancelled'};
      }
    }
    if (sequence) {
      if (!uiIsCurrent() || (confirmation && !rootEligible())) throw stepError('superseded','',new Error('Command eligibility changed before preparation.'));
      validationContext = pendingValidationContext(context, command.pendingState, peek(context.signals?.windowForm) || {});
      applyPrimitiveState(context, command.pendingState);
      for (const step of command.before) {
        if (!uiIsCurrent()) throw stepError('superseded',step.command.commandId,new Error('Command scope changed.'));
        if (step.when && !evaluatePlainVisibleWhen(step.when,context)) continue;
        publish(context,key,{phase:'preparing',guarded:true,pending:true,retryAllowed:false,invocationId:id,writerStatus:'not_invoked',message:step.command.label || 'Preparing…'});
        const stepEligible = () => rootEligible() && (!step.when || evaluatePlainVisibleWhen(step.when, context));
        const receipt = await invokePreparationStep(context, step.command, key, sequence, uiIsCurrent, stepEligible);
        sequence.receipts[step.command.commandId] = receipt;
        if (step.cleanup) sequence.cleanups.push(step.cleanup);
      }
      if (!uiIsCurrent()) throw stepError('superseded','',new Error('Command scope changed after preparation.'));
      preparationExtras = withStepReceipts(sequence);
      preparedSnapshot = preparedInputs(context,command,preparationExtras,sequence.base,baseParameters);
    }
    if (command.prepare) {
      if (!uiIsCurrent()) {
        if (needsExactReceipt) throw stepError('superseded', '', new Error('Command scope changed before final preparation.'));
        return superseded(false);
      }
      publish(context, key, {phase: 'preparing', guarded: true, pending: false, retryAllowed: false, message: 'Preparing…', writerStatus: 'not_invoked'});
      preparedSnapshot = await prepareCommandParameters(context, command, preparedSnapshot, preparationExtras);
    }
    if (!uiIsCurrent()) {
      if (needsExactReceipt) throw stepError('superseded', '', new Error('Command scope changed before the final write.'));
      return superseded(false);
    }
    if (needsExactReceipt && !rootEligible()) throw stepError('invalid', '', new Error(command.invalidMessage || 'Command eligibility changed before the final write.'));
    target = context?.Context?.(targetRef);
    if (!target?.handlers?.dataSource?.setInputParameters || !target?.handlers?.dataSource?.fetchCollection) throw new Error(`Command datasource is unavailable: ${targetRef}`);
    if (!acquireTransport(target, key)) {
      if (sequence) throw stepError('transport_busy','',new Error('Another command is using this writer.'));
      publish(context, key, {phase: 'idle', guarded: false, pending: false, retryAllowed: true, error: null, message: 'Another command is using this datasource.', writerStatus: 'not_invoked', syncStatus: 'not_started'});
      return {accepted: false, status: 'transport_busy'};
    }
    transportAcquired = true;
    if (!ordered) id = invocationID();
    if (!sequence) applyPrimitiveState(context, command.pendingState);
    publish(context, key, {phase: 'pending', guarded: true, pending: true, retryAllowed: false, error: null, message: 'Saving…', invocationId: id, writerStatus: 'pending', syncStatus: 'not_started'});
    const mapsResult = Object.keys(command.resultState || {}).length > 0;
    const writer = await dispatchCommandWriter(target,command,preparedSnapshot,id,needsExactReceipt || mapsResult,()=>{writerInvoked=true;}, needsExactReceipt);
    if (needsExactReceipt && writer.status === 'failed' && ambiguousWriterFailure(writer.error)) writer.status='indeterminate';
    if (!needsExactReceipt && !authorizationIsCurrent()) {
      releaseTransport(target, key);
      transportAcquired = false;
      return superseded(writerInvoked, id);
    }
    if (writer.status === 'failed') {
      if (needsExactReceipt) throw writer.error ?? new Error('The writer failed to return a receipt.');
      releaseTransport(target, key);
      transportAcquired = false;
      applyPrimitiveState(context, command.errorState);
      publish(context, key, {phase: 'failed', guarded: false, pending: false, retryAllowed: true, error: writer.error, message: commandErrorMessage(writer.error), writerStatus: 'failed', syncStatus: 'not_started'});
      notifyLifecycle(lifecycle, 'onSettled', {status: 'failed', error: writer.error, invocationId: id});
      return {accepted: true, status: 'failed', error: writer.error, invocationId: id};
    }
    if (writer.status === 'indeterminate') {
      stateEntry(context,key).unknownTransport=target;
      const warnings = [];
      publish(context, key, {phase: 'indeterminate', guarded: true, pending: false, retryAllowed: false, error: null, message: writer.error.message, writerStatus: 'indeterminate', syncStatus: 'not_started', warnings});
      try { if (uiIsCurrent()) applyPrimitiveState(context, command.indeterminateState); } catch (error) {
        warnings.push({stage: 'indeterminateState', error});
        publish(context, key, {warnings});
      }
      if (uiIsCurrent()) notifyLifecycle(lifecycle, 'onSettled', {status: 'indeterminate', warnings, invocationId: id});
      return {accepted: true, status: 'indeterminate', warnings, invocationId: id};
    }
    writerSucceeded = true;
    let warnings = [];
    if (uiIsCurrent()) clearSubmittedFields(context, submittedFields, warnings);
    const successState = mapsResult ? Object.assign(Object.create(null), command.successState) : command.successState;
    for (const [field, selectors] of Object.entries(command.resultState || {})) {
      let value;
      for (const selector of selectors) {
        value = resolveSelector(writer.records, selector);
        if (value !== undefined) break;
      }
      if (value === undefined) warnings.push({stage: 'resultState', error: new Error(`Writer receipt omitted the value for ${field}.`)});
      successState[field] = value ?? null;
    }
    try { if (uiIsCurrent()) applyPrimitiveState(context, successState); } catch (error) { warnings.push({stage: 'successState', error}); }
    const writerResponse = writer.records ?? parameterSnapshot(target?.signals?.collection?.peek?.() || target?.signals?.collection?.value || []);
    // The writer transport is no longer in use once its terminal success is
    // acknowledged. Release it before potentially slow UI reconciliation so a
    // different command may use the same datasource. Keep this command's own
    // guard until synchronization settles, and reconcile against the immutable
    // writer response snapshot so a later writer cannot replace its result.
    releaseTransport(target, key);
    transportAcquired = false;
    publish(context, key, {phase: 'synchronizing', guarded: true, pending: false, retryAllowed: false, error: null, message: 'Refreshing…', writerStatus: 'succeeded', syncStatus: 'pending'});
    try { warnings.push(...await synchronizeUI(context, target, command, writerResponse, uiIsCurrent, formSynchronization)); } catch (error) { warnings.push({stage: 'synchronize', error}); }
    if (!needsExactReceipt && !authorizationIsCurrent()) return superseded(writerInvoked, id);
    const syncStatus = warnings.length ? 'partial_failure' : 'succeeded';
    const message = warnings.length ? 'Saved. Some related data could not be refreshed.' : 'Completed';
    publish(context, key, {phase: 'succeeded', guarded: false, pending: false, retryAllowed: true, error: null, message, writerStatus: 'succeeded', syncStatus, warnings});
    if (uiIsCurrent()) notifyLifecycle(lifecycle, 'onSettled', {status: 'succeeded', warnings, invocationId: id});
    return {accepted: true, status: 'succeeded', warnings, invocationId: id};
  } catch (error) {
    if (transportAcquired && target) releaseTransport(target, key);
    if (needsExactReceipt && !writerSucceeded) {
      const primary = error.primary ?? error, warnings = [];
      const accepted = writerInvoked || sequence?.attempted === true;
      const current = authorizationIsCurrent();
      const primaryUnknown = error.stepStatus === 'indeterminate';
      const cleanupUnknown = sequence && !primaryUnknown && current &&
        await unwindPreparation(context, command, sequence, key, authorizationIsCurrent, presentationCurrent, warnings);
      const unknown = primaryUnknown || cleanupUnknown || (!current && accepted);
      const status = primaryUnknown ? 'indeterminate' : error.stepStatus || 'failed';
      if (uiIsCurrent()) {
        if (accepted && !unknown) clearSubmittedFields(context, submittedFields, warnings);
        try { applyPrimitiveState(context, unknown ? command.indeterminateState : command.errorState); }
        catch (secondary) { warnings.push({stage: 'errorState', error: secondary}); }
      }
      const details={error:primary, warnings, invocationId:id, ...(error.failedStepId?{failedStepId:error.failedStepId}:{})};
      const message = [commandErrorMessage(primary)];
      if (warnings.some(warning => warning.stage === 'cleanup')) message.push('Cleanup could not be confirmed.');
      publish(context, key, {...details, phase: unknown ? 'indeterminate' : 'failed', guarded: unknown, pending: false,
        retryAllowed: !unknown, writerStatus: writerInvoked ? 'failed' : 'not_invoked',
        syncStatus: 'not_started', message: message.join(' ')});
      if (uiIsCurrent()) notifyLifecycle(lifecycle,'onSettled',{status,...details});
      return {accepted,status,...details};
    }
    if (!needsExactReceipt && !authorizationIsCurrent()) return superseded(writerInvoked, id);
    console.error(`Forge mutation command failed commandId=${key} dataSourceRef=${targetRef} writerInvoked=${writerInvoked}: ${error?.stack || error}`);
    if (writerSucceeded) {
      const warnings = [{stage: 'post_write', error}];
      publish(context, key, {phase: 'succeeded', guarded: false, pending: false, retryAllowed: true, error: null, message: 'Saved. Some related data could not be refreshed.', writerStatus: 'succeeded', syncStatus: 'partial_failure', warnings});
      if (uiIsCurrent()) notifyLifecycle(lifecycle, 'onSettled', {status: 'succeeded', warnings, invocationId: id});
      return {accepted: true, status: 'succeeded', warnings, invocationId: id};
    }
    try { applyPrimitiveState(context, command.errorState); } catch (_) {}
    publish(context, key, {phase: 'failed', guarded: false, pending: false, retryAllowed: true, error, message: commandErrorMessage(error), writerStatus: writerInvoked ? 'failed' : 'not_invoked', syncStatus: 'not_started'});
    notifyLifecycle(lifecycle, 'onSettled', {status: 'failed', error, invocationId: id});
    return {accepted: writerInvoked, status: 'failed', error, invocationId: id};
  } finally {
    const current = getCommandState(context, command);
    if (!(current.guarded && current.phase === 'indeterminate')) releaseSerialization(context, key);
  }
}

export function commandValidationPasses(context, command = {}) {
  const condition = context?.identity?.canonicalDelivery === true || context?.identity?.windowOpenOnly === true
    ? withoutAuthorizationValidationHints(command.validateWhen) : command.validateWhen;
  return !condition || evaluatePlainVisibleWhen(condition, context);
}

export function dispatchMutationCommand(context, command = {}, extras = {}, lifecycle = {}) {
  if (!command.dataSourceRef || getCommandState(context, command).guarded) return false;
  if ((command.confirm || command.confirmSelection) && typeof lifecycle.confirm !== 'function') {
    void executeCommand(context, command, extras, lifecycle);
    return false;
  }
  if (!commandValidationPasses(context, command)) return false;
  void executeCommand(context, command, extras, lifecycle);
  return true;
}
