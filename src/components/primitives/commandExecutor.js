import {resolveParameters} from '../../hooks/parameters.js';
import {resolveSelector} from '../../utils/selector.js';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';
import {applyPrimitiveState, mutationCommandTargetParameters, reconcileEditableCollection} from './editableCollectionModel.js';
import {prepareResourcePayload} from './resourceModel.js';
import {formatDataSourceError} from '../../utils/dataSourceError.js';

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

const invocationID = () => globalThis.crypto?.randomUUID?.() || `cmd-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function awaitWriter(target, invoke, timeoutMs) {
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
    const observed = typeof control?.subscribe === 'function';
    if (observed) dispose = control.subscribe((value = {}) => {
      if (!invocationStarted) return;
      if (value.loading) { loadingSeen = true; return; }
      if (value.error) { settle({status: 'failed', error: value.error}); return; }
      if (loadingSeen) settle(value.error ? {status: 'failed', error: value.error} : {status: 'succeeded'});
    });
    if (settled) return;
    timer = setTimeout(() => settle({status: 'indeterminate', error: new Error('The writer outcome is unknown because the client stopped waiting.')}), timeoutMs);
    try {
      invocationStarted = true;
      const result = invoke();
      if (result === false) settle({status: 'failed', error: new Error('The datasource rejected the command before invocation.')});
      else if (result?.then) result.then(() => {
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

async function synchronizeUI(context, target, command) {
  const warnings = [];
  if (command.reconcile) {
    const spec = command.reconcile;
    try {
      const destination = context?.Context?.(spec.dataSourceRef) || context;
      if (String(spec.mode || '').toLowerCase() === 'refetch') {
        const result = destination?.handlers?.dataSource?.fetchCollection?.({cache: {bypassCache: true}});
        if (result?.then) await result;
      } else {
        const current = destination?.signals?.collection?.peek?.() || destination?.signals?.collection?.value || [];
        const response = target?.signals?.collection?.peek?.() || target?.signals?.collection?.value || [];
        const path = spec.resultPath || spec.rowsPath;
        const selected = path ? resolveSelector(response, path) : response;
        if (destination?.signals?.collection) destination.signals.collection.value = reconcileEditableCollection(current, selected, spec);
      }
    } catch (error) { warnings.push({stage: 'reconcile', error}); }
  }
  for (const refresh of command.refresh || []) {
    try {
      const dataContext = context?.Context?.(refresh.dataSourceRef);
      if (refresh.clearSelection === true) dataContext?.handlers?.dataSource?.resetSelection?.();
      const result = dataContext?.handlers?.dataSource?.fetchCollection?.(refresh.bypassCache ? {cache: {bypassCache: true}} : {});
      if (result?.then) await result;
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

export function resolveIndeterminateCommand(context, command = {}, message = '') {
  const key = commandGuardKey(command);
  const current = getCommandState(context, command);
  if (current.phase !== 'indeterminate') return false;
  try { releaseTransport(context?.Context?.(String(command.dataSourceRef || '').trim()), key); } catch (_) { return false; }
  publish(context, key, {phase: 'idle', guarded: false, pending: false, retryAllowed: true, message, writerStatus: 'idle', syncStatus: 'not_started'});
  return true;
}

export async function executeCommand(context, command = {}, extras = {}, lifecycle = {}) {
  const targetRef = String(command.dataSourceRef || '').trim();
  const key = commandGuardKey(command);
  if (!targetRef || !key || getCommandState(context, command).guarded) return {accepted: false, status: 'suppressed'};
  publish(context, key, {phase: 'validating', guarded: true, pending: false, retryAllowed: false, error: null, message: 'Validating…', writerStatus: 'not_invoked', syncStatus: 'not_started'});
  let id = '';
  let writerInvoked = false;
  let writerSucceeded = false;
  let transportAcquired = false;
  let target = null;
  try {
    const resolved = resolveParameters(command.parameters || [], context) || {};
    if (command.validateWhen && !evaluatePlainVisibleWhen(command.validateWhen, context)) {
      const error = new Error(command.invalidMessage || 'This action is not currently valid.');
      publish(context, key, {phase: 'failed', guarded: false, pending: false, retryAllowed: true, error, message: error.message, writerStatus: 'not_invoked'});
      notifyLifecycle(lifecycle, 'onRejected', {status: 'invalid', error});
      return {accepted: false, status: 'invalid', error};
    }
    const baseParameters = mutationCommandTargetParameters(resolved, targetRef);
    const preparedParameters = command.payload ? prepareResourcePayload(context, command.payload, extras) : extras;
    const preparedSnapshot = mergeCommandParameters(baseParameters, preparedParameters);
    if (command.confirm) {
      if (typeof lifecycle.confirm !== 'function') {
        const error = new Error('Confirmation is required but no confirmation service is available.');
        publish(context, key, {phase: 'failed', guarded: false, pending: false, retryAllowed: true, error, message: error.message, writerStatus: 'not_invoked'});
        return {accepted: false, status: 'confirmation_unavailable', error};
      }
      publish(context, key, {phase: 'confirming', guarded: true, message: command.confirm});
      if (!await lifecycle.confirm(command.confirm)) {
        publish(context, key, {phase: 'idle', guarded: false, pending: false, retryAllowed: true, error: null, message: '', writerStatus: 'not_invoked', syncStatus: 'not_started'});
        return {accepted: false, status: 'cancelled'};
      }
    }
    target = context?.Context?.(targetRef);
    if (!target?.handlers?.dataSource?.setInputParameters || !target?.handlers?.dataSource?.fetchCollection) throw new Error(`Command datasource is unavailable: ${targetRef}`);
    if (!acquireTransport(target, key)) {
      publish(context, key, {phase: 'idle', guarded: false, pending: false, retryAllowed: true, error: null, message: 'Another command is using this datasource.', writerStatus: 'not_invoked', syncStatus: 'not_started'});
      return {accepted: false, status: 'transport_busy'};
    }
    transportAcquired = true;
    id = invocationID();
    const parameters = {...preparedSnapshot, ...(command.invocationParameter ? {[command.invocationParameter]: id} : {})};
    applyPrimitiveState(context, command.pendingState);
    publish(context, key, {phase: 'pending', guarded: true, pending: true, retryAllowed: false, error: null, message: 'Saving…', invocationId: id, writerStatus: 'pending', syncStatus: 'not_started'});
    target.handlers.dataSource.setInputParameters(parameters);
    const writer = await awaitWriter(target, () => {
      writerInvoked = true;
      return target.handlers.dataSource.fetchCollection({cache: {bypassCache: true}, invocationId: id});
    }, Math.max(1000, Number(command.timeoutMs) || 30000));
    if (writer.status === 'failed') {
      releaseTransport(target, key);
      transportAcquired = false;
      applyPrimitiveState(context, command.errorState);
      publish(context, key, {phase: 'failed', guarded: false, pending: false, retryAllowed: true, error: writer.error, message: commandErrorMessage(writer.error), writerStatus: 'failed', syncStatus: 'not_started'});
      notifyLifecycle(lifecycle, 'onSettled', {status: 'failed', error: writer.error, invocationId: id});
      return {accepted: true, status: 'failed', error: writer.error, invocationId: id};
    }
    if (writer.status === 'indeterminate') {
      const warnings = [];
      publish(context, key, {phase: 'indeterminate', guarded: true, pending: false, retryAllowed: false, error: null, message: writer.error.message, writerStatus: 'indeterminate', syncStatus: 'not_started', warnings});
      try { applyPrimitiveState(context, command.indeterminateState); } catch (error) {
        warnings.push({stage: 'indeterminateState', error});
        publish(context, key, {warnings});
      }
      notifyLifecycle(lifecycle, 'onSettled', {status: 'indeterminate', warnings, invocationId: id});
      return {accepted: true, status: 'indeterminate', warnings, invocationId: id};
    }
    writerSucceeded = true;
    let warnings = [];
    try { warnings = await synchronizeUI(context, target, command); } catch (error) { warnings.push({stage: 'synchronize', error}); }
    try { applyPrimitiveState(context, command.successState); } catch (error) { warnings.push({stage: 'successState', error}); }
    releaseTransport(target, key);
    transportAcquired = false;
    const syncStatus = warnings.length ? 'partial_failure' : 'succeeded';
    const message = warnings.length ? 'Saved. Some related data could not be refreshed.' : 'Completed';
    publish(context, key, {phase: 'succeeded', guarded: false, pending: false, retryAllowed: true, error: null, message, writerStatus: 'succeeded', syncStatus, warnings});
    notifyLifecycle(lifecycle, 'onSettled', {status: 'succeeded', warnings, invocationId: id});
    return {accepted: true, status: 'succeeded', warnings, invocationId: id};
  } catch (error) {
    console.error(`Forge mutation command failed commandId=${key} dataSourceRef=${targetRef} writerInvoked=${writerInvoked}: ${error?.stack || error}`);
    if (transportAcquired && target) releaseTransport(target, key);
    if (writerSucceeded) {
      const warnings = [{stage: 'post_write', error}];
      publish(context, key, {phase: 'succeeded', guarded: false, pending: false, retryAllowed: true, error: null, message: 'Saved. Some related data could not be refreshed.', writerStatus: 'succeeded', syncStatus: 'partial_failure', warnings});
      notifyLifecycle(lifecycle, 'onSettled', {status: 'succeeded', warnings, invocationId: id});
      return {accepted: true, status: 'succeeded', warnings, invocationId: id};
    }
    try { applyPrimitiveState(context, command.errorState); } catch (_) {}
    publish(context, key, {phase: 'failed', guarded: false, pending: false, retryAllowed: true, error, message: commandErrorMessage(error), writerStatus: writerInvoked ? 'failed' : 'not_invoked', syncStatus: 'not_started'});
    notifyLifecycle(lifecycle, 'onSettled', {status: 'failed', error, invocationId: id});
    return {accepted: writerInvoked, status: 'failed', error, invocationId: id};
  }
}

export function dispatchMutationCommand(context, command = {}, extras = {}, lifecycle = {}) {
  if (!command.dataSourceRef || getCommandState(context, command).guarded) return false;
  if (command.confirm && typeof lifecycle.confirm !== 'function') {
    void executeCommand(context, command, extras, lifecycle);
    return false;
  }
  if (command.validateWhen && !evaluatePlainVisibleWhen(command.validateWhen, context)) return false;
  void executeCommand(context, command, extras, lifecycle);
  return true;
}
