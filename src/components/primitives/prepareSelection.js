import {batch} from '@preact/signals-react';
import {loadedParentRows} from '../../runtime/parentPreparation.js';
import {findDialogSignal, findMetadataSignal, protectedWindowEpoch} from '../../core/store/signals.js';
import {resolveParameters} from '../../hooks/parameters.js';
import {resolveSelector} from '../../utils/selector.js';
import {formatDataSourceError} from '../../utils/dataSourceError.js';
import {extractData} from '../dataSourceExtract.js';
import {snapshotResourceValue} from './resourceModel.js';
import {pendingValidationContext} from './commandExecutor.js';
import {applyPrimitiveState, editableCollectionRows, mutationCommandTargetParameters} from './editableCollectionModel.js';

// An operation owns the destination only while its read and draft setup run.
// The window's form signal is shared by all its table renderers.
const openingDialogs = new WeakMap();

// Effective metadata is immutable for a window revision. Only windows using
// prepared selections build this index; replacing the metadata invalidates it.
const draftSources = new WeakMap();
export function prepareDialogSources(metadata) {
  let sources = draftSources.get(metadata);
  if (!sources) {
    sources = new Map((metadata.dialogs || []).map(dialog => [dialog.id, dialog.dataSourceRef]));
    draftSources.set(metadata, sources);
  }
  return sources;
}

function identity(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (typeof value === 'string' && value.trim()) {
    return /^-?\d+$/.test(value) ? BigInt(value).toString() : value;
  }
  throw new Error('A selected record has an invalid identity or scope value.');
}

function orderedRows(records, keys, field, scope) {
  if (records.length !== keys.length) throw new Error('The reader did not return exactly the selected records.');
  const positions = new Map(keys.map((key, index) => [key, index]));
  const result = new Array(keys.length);
  for (const record of records) {
    const index = positions.get(identity(resolveSelector(record, field)));
    if (index === undefined || result[index] !== undefined) throw new Error('The reader returned an extra or duplicate record.');
    for (const [selector, expected] of scope) {
      if (identity(resolveSelector(record, selector)) !== expected) throw new Error('The reader returned a record outside the requested scope.');
    }
    result[index] = record;
  }
  return result;
}

function projectCases(context, name, rows) {
  if (!name) return {mapping: null, descriptors: [], rowCases: []};
  const descriptors = [], indices = new Map();
  const rowCases = rows.map(row => {
    const selected = context.resolveMappedResource(name, row);
    if (!indices.has(selected)) {
      indices.set(selected, descriptors.length);
      const {modelRef, model, schema, values} = selected;
      descriptors.push({modelRef, model, schema, values: values || {}});
    }
    return indices.get(selected);
  });
  const {fieldOrder = [], uploads = {}} = context.metadata.resourceMappings[name];
  return {mapping: {fieldOrder, uploads}, descriptors, rowCases};
}

const peek = signal => signal?.peek?.() ?? signal?.value;

// The prepare hook consumes snapshots. Its helpers may call other registered
// actions in the same window, without acquiring live datasource or dialog setters.
function draftHookContext(context) {
  const signals = {};
  for (const key of ['authorization', 'windowForm', 'selection', 'form', 'input']) {
    const signal = context.signals[key];
    if (!signal) continue;
    let captured = false, value;
    const read = () => {
      if (!captured) {
        value = snapshotResourceValue(peek(signal));
        captured = true;
      }
      return value;
    };
    signals[key] = {peek: read, get value() {return read();},
      set value(_) {throw new Error('Selection preparation cannot change a live signal.');}};
  }
  return {
    identity: {...context.identity}, metadata: {windowKey: context.metadata.windowKey},
    authorization: signals.authorization ? signals.authorization.peek() : snapshotResourceValue(context.authorization),
    signals, lookupHandler: name => context.lookupHandler(name),
  };
}

function resolvePreparedArguments(context, operation, destination, bindsDraft) {
  const resolved = resolveParameters(operation.parameters || [], context);
  const reader = operation.prepareSelection.dataSourceRef;
  if (!bindsDraft) return {parameters: mutationCommandTargetParameters(resolved, reader)};
  const envelope = resolved.inbound || resolved;
  const {[destination]: draft, [reader]: scopedReader, ...unscoped} = envelope;
  const {parameters: compact = {}, ...legacy} = scopedReader || {};
  const parameters = {...unscoped, ...legacy, ...compact};
  if (Object.keys(parameters).length !== Object.keys(unscoped).length + Object.keys(legacy).length + Object.keys(compact).length) {
    throw new Error('A prepared reader parameter is bound more than once.');
  }
  return {parameters, draftParameters: draft?.parameters || {}};
}

// The caller supplies the same live operation + permission boundary evaluation
// as its visible toolbar. Only the operation's own pending flag is masked.
export async function openPreparedSelection(context, operation, eligible) {
  const spec = operation.prepareSelection;
  const owner = context?.signals?.windowForm;
  if (!owner) return {accepted: false, status: 'failed', error: new Error('The originating window is unavailable.')};
  const dialogId = operation.dialogId;
  let leases = openingDialogs.get(owner);
  if (!leases) openingDialogs.set(owner, leases = new Set());
  if (leases.has(dialogId)) return {accepted: false, status: 'suppressed'};
  const dialogState = () => findDialogSignal(context.identity.windowId + 'Dialog' + dialogId)?.peek();
  if (dialogState()?.open || !eligible(context)) return {accepted: false, status: 'invalid'};
  leases.add(dialogId);
  const selection = () => editableCollectionRows(peek(context.signals.selection)).map(row => resolveSelector(row, spec.identityField));
  const destination = prepareDialogSources(context.metadata).get(dialogId);
  const bindsDraft = spec.parentParameter && operation.parameters?.some(binding => binding.to === destination + ':parameters');
  const readArguments = () => resolvePreparedArguments(context, operation, destination, bindsDraft);
  const actor = () => JSON.stringify(context.signals.authorization ? peek(context.signals.authorization) : context.authorization);
  const epoch = protectedWindowEpoch(context.identity.windowId);
  const metadataSignal = findMetadataSignal(context.identity.windowId);
  const metadataRevision = peek(metadataSignal);
  const originalDialog = dialogState()?.props;
  const originalWindowForm = peek(owner) || {};
  const pending = spec.pendingField ? {[spec.pendingField]: true} : {};
  let active = () => true;
  let attempted = false;
  let pendingPublished = false;
  try {
    const bound = snapshotResourceValue(readArguments());
    const parameters = bound.parameters;
    const parent = spec.parentParameter;
    const value = parent ? parameters[parent] : null;
    const ids = parent ? (Array.isArray(value) ? value : [value]) : selection();
    if (parent && (spec.idsParameter || ids.length !== 1)) throw new Error('Parent preparation requires exactly one bound identity.');
    const keys = ids.map(identity);
    if (!keys.length || new Set(keys).size !== keys.length) throw new Error('Select one or more distinct records.');
    if (!parent && Object.hasOwn(parameters, spec.idsParameter)) throw new Error('The selected ID parameter is already bound.');
    const scope = Object.entries(spec.scopeFields || {}).map(([field, parameter]) => {
      const value = parameters[parameter];
      return [field, identity(Array.isArray(value) && value.length === 1 ? value[0] : value)];
    });
    const originalActor = actor(), originalArguments = JSON.stringify(bound);
    const eligibilityContext = pendingValidationContext(context, pending, originalWindowForm);
    active = () => {
      try {
        if (protectedWindowEpoch(context.identity.windowId) !== epoch || peek(metadataSignal) !== metadataRevision || actor() !== originalActor ||
            dialogState()?.open || dialogState()?.props !== originalDialog || !eligible(eligibilityContext)) return false;
        if (parent) return JSON.stringify(readArguments()) === originalArguments;
        const current = selection();
        return current.length === keys.length && current.every((id, index) => identity(id) === keys[index]) &&
          JSON.stringify(readArguments()) === originalArguments;
      } catch {
        // A replacement selection or scope may no longer have valid input.
        return false;
      }
    };
    const reader = context.Context(spec.dataSourceRef);
    const draft = destination && context.Context(destination);
    const prepare = context.lookupHandler?.(spec.prepare);
    if (!reader?.handlers?.dataSource?.fetchRecords || !draft?.handlers?.dataSource?.setEditedFormData ||
        typeof prepare !== 'function' || typeof context.handlers?.window?.openDialog !== 'function') {
      throw new Error('The selected-record reader, draft or preparation handler is unavailable.');
    }
    const input = parent ? parameters : {...parameters, [spec.idsParameter]: ids};
    applyPrimitiveState(context, {...pending, ...(spec.errorField ? {[spec.errorField]: ''} : {})});
    pendingPublished = Boolean(spec.pendingField);
    attempted = true;
    const invocationId = globalThis.crypto?.randomUUID?.() || 'selection-' + Date.now() + '-' + Math.random();
    let rows;
    const loaded = parent && loadedParentRows(reader, input);
    if (loaded) {
      try { rows = orderedRows(loaded, keys, spec.identityField, scope); }
      catch { /* A different stored parent requires the declared reader. */ }
    }
    if (!rows) {
      const response = await reader.handlers.dataSource.fetchRecords({parameters: input, cache: {bypassCache: true}, invocationId});
      if (!active()) return {accepted: true, status: 'superseded'};
      const source = context.metadata.dataSource[spec.dataSourceRef];
      const {records} = extractData(source.selectors, undefined, response, true);
      rows = orderedRows(records, keys, spec.identityField, scope);
    }
    const modelRef = context.metadata.dataSource[destination].resourceModelRef;
    const projected = {
      ...bound, rows, parameters: input, invocationId, ...projectCases(context, spec.mappingRef, rows),
      draftModel: modelRef ? context.metadata.resourceModels?.[modelRef] : null,
    };
    const values = prepare({context: draftHookContext(context), ...snapshotResourceValue(projected)});
    if (!values || typeof values !== 'object' || Array.isArray(values) || typeof values.then === 'function') {
      throw new Error('Selection preparation must synchronously return a draft record.');
    }
    if (!active()) return {accepted: true, status: 'superseded'};
    const form = () => draft.handlers.dataSource.getFormData?.() ?? peek(draft.signals?.form);
    return batch(() => {
      const previous = form();
      let opened = false;
      try {
        draft.handlers.dataSource.setEditedFormData({values});
        const result = context.handlers.window.openDialog({context, execution: {args: [dialogId, {awaitResult: false}]}});
        opened = result !== false && result?.status !== 'busy';
        return {accepted: true, status: opened ? 'opened' : 'suppressed'};
      } finally {
        // A refused open must not leave a new seed in the closed form. A
        // replacement draft, if another owner has already set it, takes priority.
        if (!opened && form() === values) draft.handlers.dataSource.setEditedFormData({values: previous || {}});
      }
    });
  } catch (error) {
    if (spec.errorField && active()) applyPrimitiveState(context, {[spec.errorField]: formatDataSourceError(error) || 'The selected records could not be opened.'});
    return {accepted: attempted, status: 'failed', error};
  } finally {
    try {
      if (pendingPublished && peek(owner)?.[spec.pendingField] === true) applyPrimitiveState(context, {[spec.pendingField]: false});
    } finally { leases.delete(dialogId); }
  }
}
