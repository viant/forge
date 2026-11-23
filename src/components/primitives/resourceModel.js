import {validateResource} from '../../validation/index.js';
import {resolveSelector, setSelector} from '../../utils/selector.js';
import {isPersistedCollectionIdentity} from '../../utils/collectionIdentity.js';

const OMIT = Symbol('forge-resource-model-omit');

function clone(value) {
  if (value === undefined || value === null || typeof value !== 'object') return value;
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function same(left, right) {
  try { return JSON.stringify(left) === JSON.stringify(right); } catch (_) { return left === right; }
}

function normalizedType(schema = {}, binding = {}) {
  return String(binding.codec || schema.type || '').trim().toLowerCase();
}

function coerceScalar(value, schema = {}, binding = {}, path = 'value') {
  if (value == null) return value;
  const type = normalizedType(schema, binding);
  switch (type) {
    case 'int':
    case 'integer': {
      if (typeof value === 'string' && value.trim() === '') throw new Error(`${path} must be an integer.`);
      const next = typeof value === 'string' ? Number(value.trim()) : Number(value);
      if (!Number.isInteger(next)) throw new Error(`${path} must be an integer.`);
      return next;
    }
    case 'float':
    case 'number': {
      if (typeof value === 'string' && value.trim() === '') throw new Error(`${path} must be a number.`);
      const next = typeof value === 'string' ? Number(value.trim()) : Number(value);
      if (!Number.isFinite(next)) throw new Error(`${path} must be a number.`);
      return next;
    }
    case 'bool':
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (value === 1 || String(value).trim().toLowerCase() === 'true' || String(value).trim() === '1') return true;
      if (value === 0 || String(value).trim().toLowerCase() === 'false' || String(value).trim() === '0') return false;
      throw new Error(`${path} must be a boolean.`);
    case 'string':
      return String(value);
    default:
      return clone(value);
  }
}

function emptyValue(value, binding = {}) {
  // Missing and explicitly cleared are different sparse-write states.
  // An empty:null policy applies to an authored empty value, never to an
  // omitted field that the producer must leave unchanged.
  if (value === undefined) return undefined;
  const empty = value === '' || value === null;
  if (!empty) return value;
  const declaredPolicy = Object.prototype.hasOwnProperty.call(binding, 'empty') && binding.empty === null ? 'null' : binding.empty;
  switch (String(declaredPolicy || 'preserve').toLowerCase()) {
    case 'null': return null;
    case 'omit': return OMIT;
    default: return value;
  }
}

function schemaProperties(schema = {}) {
  return schema?.properties && typeof schema.properties === 'object' ? schema.properties : {};
}

export function resolveResourceContract(context, modelRef) {
  const ref = String(modelRef || '').trim();
  const models = context?.metadata?.resourceModels || {};
  const schemas = context?.metadata?.schemas || {};
  const model = models[ref];
  if (!model) throw new Error(`Resource model not found: ${ref}`);
  const schema = schemas[model.schemaRef];
  if (!schema) throw new Error(`Resource schema not found: ${model.schemaRef || ref}`);
  return {modelRef: ref, model, schema, models, schemas};
}

export function resourceModelRefForDataSource(context, explicitRef = '') {
  const declared = String(explicitRef || '').trim();
  if (declared) return declared;
  const dataSourceRef = String(context?.identity?.dataSourceRef || '').trim();
  if (!dataSourceRef) return '';
  const matches = Object.entries(context?.metadata?.resourceModels || {})
    .filter(([, model]) => String(model?.read?.dataSourceRef || '').trim() === dataSourceRef)
    .map(([name]) => name);
  if (matches.length > 1) {
    const models = context.metadata.resourceModels;
    const stable = value => JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
    const readContract = name => {
      const model = models[name];
      return stable({schemaRef:model.schemaRef,read:model.read,fields:model.fields,hooks:{beforeUnmarshal:model.hooks?.beforeUnmarshal,afterUnmarshal:model.hooks?.afterUnmarshal}});
    };
    if (!matches.every(name => readContract(name) === readContract(matches[0]))) throw new Error(`Datasource ${dataSourceRef} has multiple resource models: ${matches.join(', ')}`);
  }
  return matches[0] || '';
}

function schemaForField(fieldSchema = {}, schemas = {}) {
  const ref = String(fieldSchema?.$ref || fieldSchema?.ref || '').trim();
  if (!ref) return fieldSchema;
  const resolved = {...(schemas[ref] || {}), ...fieldSchema};
  delete resolved.$ref;
  delete resolved.ref;
  return resolved;
}

function invokeModelHook(context, hookName, phase, value, contract, extras = {}) {
  const name = String(hookName || '').trim();
  if (!name) return value;
  const handler = context?.lookupHandler?.(name);
  if (typeof handler !== 'function') throw new Error(`Resource model hook not found: ${name}`);
  const snapshot = freeze(clone(value));
  const result = handler({context, phase, value: snapshot, modelRef: contract.modelRef, model: contract.model, schema: contract.schema, ...extras});
  if (result?.then) throw new Error(`Resource model hooks must be synchronous: ${name}`);
  return result === undefined ? value : clone(result);
}

function unmarshalObject(value, contract, context) {
  if (value == null) return value;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error(`${contract.modelRef} read value must be an object.`);
  const result = contract.model.read?.preserveUnbound === true ? clone(value) : {};
  for (const [field, fieldSchema] of Object.entries(schemaProperties(contract.schema))) {
    const binding = contract.model.fields?.[field] || {};
    if (binding.associationDelta?.mode === 'explicit') delete result[field];
    if (fieldSchema?.writeOnly || binding.read === '-' || binding.associationDelta?.mode === 'explicit') continue;
    const sourcePath = binding.read || field;
    let next = resolveSelector(value, sourcePath);
    if (next === undefined && Object.prototype.hasOwnProperty.call(binding, 'default')) next = binding.default;
    if (next === undefined && Object.prototype.hasOwnProperty.call(fieldSchema || {}, 'default')) next = fieldSchema.default;
    if (next === undefined) continue;
    if (binding.trim === true && typeof next === 'string') next = next.trim();
    if (binding.collection?.modelRef) {
      if (!Array.isArray(next)) throw new Error(`${field} must be an array.`);
      next = next.map((entry) => unmarshalResource(entry, context, binding.collection.modelRef));
    } else if (binding.modelRef) {
      next = unmarshalResource(next, context, binding.modelRef);
    } else {
      next = coerceScalar(next, schemaForField(fieldSchema, contract.schemas), binding, field);
    }
    result[field] = next;
  }
  return result;
}

export function unmarshalResource(value, context, modelRef) {
  const contract = resolveResourceContract(context, modelRef);
  const before = invokeModelHook(context, contract.model.hooks?.beforeUnmarshal, 'beforeUnmarshal', value, contract);
  const unmarshalled = unmarshalObject(before, contract, context);
  const after = invokeModelHook(context, contract.model.hooks?.afterUnmarshal, 'afterUnmarshal', unmarshalled, contract);
  const errors = validateResource(after, contract.schema, contract.schemas);
  if (errors.length) throw new Error(`Invalid ${contract.modelRef} read model: ${errors.join('; ')}`);
  return after;
}

export function unmarshalResourceCollection(records, context, modelRef) {
  if (!modelRef) return records;
  if (!Array.isArray(records)) throw new Error(`Resource model collection must be an array: ${modelRef}`);
  return records.map((record) => unmarshalResource(record, context, modelRef));
}

function collectionIdentity(binding = {}, context) {
  if (!binding.collection?.modelRef) return [];
  const nested = resolveResourceContract(context, binding.collection.modelRef);
  return binding.collection.identity?.length ? binding.collection.identity : (nested.schema.identity || []);
}

function identityKey(row, identities, path, clientKey = '', allowUnkeyed = false) {
  if (!identities.length) return '';
  const values = identities.map((field) => row?.[field]);
  const newIdentity = values.every((value) => value === undefined || value === null || value === '' || value === 0 || value === '0');
  if (newIdentity && clientKey) {
    const clientValue = row?.[clientKey];
    if (clientValue === undefined || clientValue === null || clientValue === '') throw new Error(`${path} is missing collection clientKey: ${clientKey}`);
    return `client:${String(clientValue)}`;
  }
  if (newIdentity && allowUnkeyed) return null;
  if (values.some((value) => value === undefined || value === null || value === '')) {
    throw new Error(`${path} is missing collection identity field(s): ${identities.join(', ')}`);
  }
  return values.map(String).join('\u001f');
}

function indexCollection(rows, identities, path, clientKey = '', allowUnkeyed = false) {
  const result = new Map();
  if (!identities.length) return result;
  (rows || []).forEach((row, index) => {
    const key = identityKey(row, identities, `${path}.${index}`, clientKey, allowUnkeyed);
    if (key === null) return;
    if (result.has(key)) throw new Error(`${path} contains duplicate collection identity: ${key}`);
    result.set(key, row);
  });
  return result;
}

function collectionBaselineRows(rows, marker) {
  if (!Array.isArray(rows)) return [];
  return !marker ? rows : rows.map(row => {
    if (!row || !Object.hasOwn(row, marker)) return row;
    const {[marker]: ignored, ...original} = row;
    return original;
  });
}

function overlayCanonical(draft, baseline, context, modelRef, path = '$') {
  const contract = resolveResourceContract(context, modelRef);
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return clone(draft);
  const result = {...(baseline || {}), ...draft};
  for (const [field, binding] of Object.entries(contract.model.fields || {})) {
    if (!Object.prototype.hasOwnProperty.call(draft, field)) {
      if (binding.associationDelta) delete result[field];
      continue;
    }
    const next = draft[field];
    const previous = baseline?.[field];
    if (binding.modelRef && next && typeof next === 'object' && !Array.isArray(next)) {
      result[field] = overlayCanonical(next, previous, context, binding.modelRef, `${path}.${field}`);
      continue;
    }
    if (!binding.collection?.modelRef || !Array.isArray(next)) continue;
    const identities = collectionIdentity(binding, context);
    const clientKey = String(binding.collection.clientKey || '').trim();
    const allowUnkeyed = Boolean(binding.collection.deleteMarker);
    const baselineRows = collectionBaselineRows(previous, binding.collection.deleteMarker);
    const baselineByID = indexCollection(baselineRows, identities, `${path}.${field}.baseline`, clientKey, allowUnkeyed);
    const draftByID = indexCollection(next, identities, `${path}.${field}.draft`, clientKey, allowUnkeyed);
    const overlaidDraft = next.map((row, index) => {
      const key = identityKey(row, identities, `${path}.${field}.${index}`, clientKey, allowUnkeyed);
      return overlayCanonical(row, baselineByID.get(key), context, binding.collection.modelRef, `${path}.${field}.${index}`);
    });
    if (String(binding.collection.mode || 'replace').toLowerCase() !== 'merge') {
      result[field] = overlaidDraft;
      continue;
    }
    const pairedFields = Object.entries(resolveResourceContract(context, binding.collection.modelRef).model.fields || {})
      .filter(([, nested]) => nested.associationDelta).map(([name]) => name);
    const retainOmittedRow = row => {
      const retained = clone(row);
      for (const name of pairedFields) delete retained[name];
      return retained;
    };
    if (binding.collection.preserveOrder !== false) {
      const omitted = baselineRows.filter((row, index) => {
        const key = identityKey(row, identities, `${path}.${field}.baseline.${index}`, clientKey, allowUnkeyed);
        return key !== null && !draftByID.has(key);
      }).map(retainOmittedRow);
      result[field] = [...overlaidDraft, ...omitted];
      continue;
    }
    const overlaidByID = indexCollection(overlaidDraft, identities, `${path}.${field}.overlaid`, clientKey, allowUnkeyed);
    const baselineKeys = new Set();
    const merged = baselineRows.map((row, index) => {
      const key = identityKey(row, identities, `${path}.${field}.baseline.${index}`, clientKey, allowUnkeyed);
      baselineKeys.add(key);
      return overlaidByID.has(key) ? clone(overlaidByID.get(key)) : retainOmittedRow(row);
    });
    const appended = overlaidDraft.filter((row, index) => !baselineKeys.has(identityKey(row, identities, `${path}.${field}.overlaid.${index}`, clientKey, allowUnkeyed)));
    result[field] = [...merged, ...appended];
  }
  return result;
}

function associationIDs(value, type, path) {
  if (!Array.isArray(value)) throw new Error(`${path} must be an ID array.`);
  for (const id of value) {
    const valid = type === 'string' ? typeof id === 'string' : Number.isSafeInteger(id);
    if (!valid) throw new Error(`${path} must contain only ${type === 'string' ? 'string' : 'safe integer'} IDs.`);
  }
  return new Set(value);
}

function projectAssociationDelta(value, baseline, completenessSource, field, schema, binding, result, path) {
  let added, deleted;
  if (binding.mode === 'diff') {
    if (resolveSelector(completenessSource, binding.baselineComplete) !== true) {
      throw new Error(`${path} requires a complete association baseline.`);
    }
    const type = schema.items.type;
    const before = associationIDs(baseline[field], type, `${path}.baseline`);
    const after = associationIDs(value, type, path);
    added = [...after].filter(id => !before.has(id));
    deleted = [...before].filter(id => !after.has(id));
  } else if (binding.mode === 'explicit') {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => key !== 'added' && key !== 'deleted')) {
      throw new Error(`${path} must contain explicit added or deleted ID lists.`);
    }
    const type = schema.properties.added.items.type;
    const additions = associationIDs(value.added === undefined ? [] : value.added, type, `${path}.added`);
    const deletions = associationIDs(value.deleted === undefined ? [] : value.deleted, type, `${path}.deleted`);
    for (const id of additions) {
      if (deletions.has(id)) throw new Error(`${path} cannot add and delete the same ID.`);
    }
    added = [...additions];
    deleted = [...deletions];
  } else {
    throw new Error(`Unknown association delta mode: ${binding.mode}`);
  }
  if (added.length) Object.assign(result, setSelector(result, binding.added, added));
  if (deleted.length) Object.assign(result, setSelector(result, binding.deleted, deleted));
}

function normalizeCanonical(value, contract, context, path = '$', baseline = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return clone(value);
  const result = clone(value);
  for (const [field, fieldSchema] of Object.entries(schemaProperties(contract.schema))) {
    const binding = contract.model.fields?.[field] || {};
    let next = value[field];
    if (binding.associationDelta) {
      if (next === undefined || (baseline && binding.associationDelta.mode === 'explicit')) delete result[field];
      continue;
    }
    if ((next === undefined || next === null) && Object.prototype.hasOwnProperty.call(binding, 'default')) next = clone(binding.default);
    if ((next === undefined || next === null) && Object.prototype.hasOwnProperty.call(fieldSchema || {}, 'default')) next = clone(fieldSchema.default);
    if (binding.trim === true && typeof next === 'string') next = next.trim();
    next = emptyValue(next, binding);
    if (next === OMIT || next === undefined) {
      delete result[field];
      continue;
    }
    if (binding.collection?.modelRef && next !== null) {
      if (!Array.isArray(next)) throw new Error(`${path}.${field} must be an array.`);
      const nested = resolveResourceContract(context, binding.collection.modelRef);
      const marker = binding.collection.deleteMarker;
      if (marker && !baseline) {
        const markerSchema = schemaProperties(nested.schema)[marker];
        if (markerSchema?.type !== 'boolean' || Object.hasOwn(markerSchema, 'default') ||
          Object.hasOwn(nested.model.fields?.[marker] ?? {}, 'default')) {
          throw new Error(`${path}.${field} requires a boolean collection deleteMarker without a default.`);
        }
        if (next.some(row => row && Object.hasOwn(row, marker) && typeof row[marker] !== 'boolean')) {
          throw new Error(`${path}.${field} requires an explicit boolean collection deleteMarker.`);
        }
      }
      if (baseline) next = collectionBaselineRows(next, marker);
      next = next.map((entry, index) => normalizeCanonical(entry, nested, context, `${path}.${field}.${index}`, baseline));
    } else if (binding.modelRef && next !== null) {
      const nested = resolveResourceContract(context, binding.modelRef);
      next = normalizeCanonical(next, nested, context, `${path}.${field}`, baseline);
    } else if (String(fieldSchema?.type || '').toLowerCase() === 'array' && Array.isArray(next)) {
      const itemSchema = schemaForField(fieldSchema.items || {}, contract.schemas);
      next = next.map((entry, index) => coerceScalar(entry, itemSchema, {}, `${path}.${field}.${index}`));
    } else {
      next = coerceScalar(next, schemaForField(fieldSchema, contract.schemas), binding, `${path}.${field}`);
    }
    result[field] = next;
  }
  if (baseline) {
    for (const binding of Object.values(contract.model.fields || {})) {
      const marker = binding.associationDelta?.baselineComplete;
      if (marker && resolveSelector(result, marker) === true && resolveSelector(value, marker) !== true) {
        Object.assign(result, setSelector(result, marker, false));
      }
    }
  }
  return result;
}

function marshalCollectionRemoval(row, binding, identities, context, path) {
  const marker = binding.deleteMarker;
  if (!identities.length || !identities.every(field => isPersistedCollectionIdentity(row?.[field]))) {
    throw new Error(`${path} requires a persisted collection identity for removal.`);
  }
  const nested = resolveResourceContract(context, binding.modelRef);
  const markerSchema = schemaProperties(nested.schema)[marker];
  if (markerSchema?.type !== 'boolean' || markerSchema.readOnly) {
    throw new Error(`${path} requires a writable boolean collection deleteMarker.`);
  }
  const removal = {};
  for (const field of [...identities, marker]) {
    const target = nested.model.fields?.[field]?.write || field;
    if (target === '-') throw new Error(`${path} cannot omit remove field ${field}.`);
    Object.assign(removal, setSelector(removal, target, field === marker ? true : row[field]));
  }
  return removal;
}

function marshalObject(draft, baseline, completenessSource, contract, context, mode, changedFields = null) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) throw new Error(`${contract.modelRef} draft must be an object.`);
  const source = draft;
  const result = {};
  for (const [field, fieldSchema] of Object.entries(schemaProperties(contract.schema))) {
    const binding = contract.model.fields?.[field] || {};
    if (binding.associationDelta) {
      const value = source[field];
      if (value !== undefined) {
        projectAssociationDelta(value, baseline, completenessSource, field, fieldSchema, binding.associationDelta, result, `${contract.modelRef}.${field}`);
      }
      continue;
    }
    const identityField = Array.isArray(contract.schema.identity) && contract.schema.identity.includes(field);
    if (binding.write === '-') {
      if (mode === 'changed' && identityField) throw new Error(`${contract.modelRef}.${field} identity cannot be omitted by a changed writer.`);
      continue;
    }
    if (fieldSchema?.readOnly && !binding.write && !(mode === 'changed' && identityField)) continue;
    let next = source[field];
    if (binding.omitIfUnchanged && !identityField && binding.alwaysWrite !== true && same(next, baseline?.[field])) continue;
    if (mode === 'changed' && binding.alwaysWrite !== true && !identityField && !changedFields?.has(field)) continue;
    if (mode === 'changed' && (identityField || binding.alwaysWrite === true) && (next === undefined || next === null || next === '')) {
      throw new Error(`${contract.modelRef}.${field} is required for changed writer routing.`);
    }
    if (next === undefined) continue;
    if (binding.collection?.modelRef) {
      if (!Array.isArray(next)) throw new Error(`${field} must be an array.`);
      const deleteMarker = binding.collection.deleteMarker;
      const baselineRows = collectionBaselineRows(baseline?.[field], deleteMarker);
      const identities = collectionIdentity(binding, context);
      const clientKey = String(binding.collection.clientKey || '').trim();
      const allowUnkeyed = Boolean(deleteMarker);
      const baselineByIdentity = indexCollection(baselineRows, identities, `${field}.baseline`, clientKey, allowUnkeyed);
      indexCollection(next, identities, `${field}.draft`, clientKey, allowUnkeyed);
      next = next.flatMap((entry, index) => {
        if (deleteMarker && entry?.[deleteMarker] === true) {
          return [marshalCollectionRemoval(entry, binding.collection, identities, context, `${field}.${index}`)];
        }
        const key = identityKey(entry, identities, `${field}.${index}`, clientKey, allowUnkeyed);
        const prior = baselineByIdentity.get(key);
        if (deleteMarker && mode === 'changed' && prior) {
          const fields = resolveResourceContract(context, binding.collection.modelRef).model.fields || {};
          const comparison = Object.fromEntries(Object.entries(prior).filter(([name]) =>
            !fields[name]?.associationDelta || Object.hasOwn(entry, name)));
          if (same(entry, comparison)) return [];
        }
        const nestedMode = mode === 'changed' ? 'overlayBaseline' : mode;
        return [marshalResource(entry, context, binding.collection.modelRef, prior, nestedMode)];
      });
      if (deleteMarker && mode === 'changed' && next.length === 0) continue;
    } else if (binding.modelRef && next !== null) {
      next = marshalResource(next, context, binding.modelRef, baseline?.[field], mode === 'changed' ? 'overlayBaseline' : mode);
    } else {
      next = clone(next);
    }
    const targetPath = binding.write || field;
    Object.assign(result, setSelector(result, targetPath, next));
  }
  return result;
}

export function marshalResource(draft, context, modelRef, baseline = null, modeOverride = '') {
  const contract = resolveResourceContract(context, modelRef);
  const mode = String(modeOverride || contract.model.write?.mode || 'changed').replace(/[_-]/g, '').toLowerCase();
  if (!['full', 'overlaybaseline', 'changed'].includes(mode)) throw new Error(`Unsupported resource marshal mode: ${modeOverride || contract.model.write?.mode}`);
  let normalizedBaseline = baseline == null ? baseline : normalizeCanonical(baseline, contract, context, '$', true);
  if (mode === 'changed' && normalizedBaseline != null && contract.model.hooks?.beforeMarshal) {
    const preparedBaseline = invokeModelHook(context, contract.model.hooks.beforeMarshal, 'beforeMarshalBaseline', normalizedBaseline, contract, {baseline: freeze(clone(normalizedBaseline))});
    normalizedBaseline = normalizeCanonical(preparedBaseline, contract, context, '$', true);
  }
  const candidate = mode === 'full' ? clone(draft) : overlayCanonical(draft, normalizedBaseline, context, modelRef);
  const before = invokeModelHook(context, contract.model.hooks?.beforeMarshal, 'beforeMarshal', candidate, contract, {baseline: freeze(clone(normalizedBaseline))});
  const normalized = normalizeCanonical(before, contract, context);
  if (normalizedBaseline != null) {
    for (const identity of contract.schema.identity || []) {
      if (!same(normalized?.[identity], normalizedBaseline?.[identity])) {
        throw new Error(`${contract.modelRef}.${identity} is immutable and must match the baseline.`);
      }
    }
  }
  const changedFields = mode === 'changed'
    ? new Set(Object.keys(schemaProperties(contract.schema)).filter((field) => !same(normalized?.[field], normalizedBaseline?.[field])))
    : null;
  const errors = validateResource(normalized, contract.schema, contract.schemas);
  if (errors.length) throw new Error(`Invalid ${contract.modelRef} write model: ${errors.join('; ')}`);
  const marshalled = marshalObject(normalized, normalizedBaseline, baseline, contract, context, mode, changedFields);
  return invokeModelHook(context, contract.model.hooks?.afterMarshal, 'afterMarshal', marshalled, contract, {baseline: freeze(clone(normalizedBaseline))});
}

function resolveValueSource(context, source = {}, extras = {}) {
  const scope = String(source.scope || 'extras').trim().toLowerCase();
  const dataSourceRef = String(source.dataSourceRef || '').trim();
  const dataContext = dataSourceRef
    ? (String(context?.identity?.dataSourceRef || '').trim() === dataSourceRef ? context : context?.Context?.(dataSourceRef))
    : context;
  let value;
  switch (scope) {
    case 'constant': value = source.value; break;
    case 'extras': value = extras; break;
    case 'form': value = dataContext?.handlers?.dataSource?.getFormData?.() || dataContext?.signals?.form?.peek?.() || dataContext?.signals?.form?.value; break;
    case 'metrics': value = dataContext?.signals?.metrics?.peek?.() || dataContext?.signals?.metrics?.value; break;
    case 'collection': value = dataContext?.signals?.collection?.peek?.() || dataContext?.signals?.collection?.value; break;
    case 'selection': value = dataContext?.signals?.selection?.peek?.() || dataContext?.signals?.selection?.value; break;
    case 'input': value = dataContext?.signals?.input?.peek?.() || dataContext?.signals?.input?.value; break;
    case 'windowform': value = context?.signals?.windowForm?.peek?.() || context?.signals?.windowForm?.value; break;
    default: throw new Error(`Unsupported resource value source: ${source.scope}`);
  }
  value = resolveSelector(value, source.selector || '');
  if (source.where) {
    if (!Array.isArray(value)) throw new Error(`Resource value source where requires an array.`);
    const field = String(source.where.field || '').trim();
    value = value.filter((entry) => {
      const actual = resolveSelector(entry, field);
      if (Object.prototype.hasOwnProperty.call(source.where, 'equals')) return same(actual, source.where.equals);
      if (Object.prototype.hasOwnProperty.call(source.where, 'notEquals')) return !same(actual, source.where.notEquals);
      if (Array.isArray(source.where.in)) return source.where.in.some((candidate) => same(actual, candidate));
      return false;
    });
  }
  if (source.mapSelector) {
    if (!Array.isArray(value)) throw new Error(`Resource value source mapSelector requires an array.`);
    value = value.map((entry) => resolveSelector(entry, source.mapSelector));
  }
  if (source.codec) {
    const convert = (entry, index = '') => coerceScalar(entry, {}, {codec: source.codec}, `source${index}`);
    value = Array.isArray(value) ? value.map((entry, index) => convert(entry, `.${index}`)) : convert(value);
  }
  return clone(value);
}

export function prepareResourcePayload(context, preparation = {}, extras = {}) {
  const contract = resolveResourceContract(context, preparation.modelRef);
  let draft;
  if (preparation.fields && Object.keys(preparation.fields).length) {
    draft = {};
    for (const target of Object.keys(preparation.fields).sort()) {
      Object.assign(draft, setSelector(draft, target, resolveValueSource(context, preparation.fields[target], extras)));
    }
  } else {
    const sourceSpec = preparation.source && Object.keys(preparation.source).length ? preparation.source : {scope: 'extras', selector: 'data'};
    draft = resolveValueSource(context, sourceSpec, extras);
  }
  let baseline = null;
  if (preparation.baseline) baseline = resolveValueSource(context, preparation.baseline, extras);
  else if (['overlaybaseline', 'changed'].includes(String(preparation.mode || contract.model.write?.mode || 'changed').replace(/[_-]/g, '').toLowerCase()) && contract.model.read?.dataSourceRef) {
    baseline = resolveValueSource(context, {scope: 'collection', dataSourceRef: contract.model.read.dataSourceRef, selector: '0'}, extras);
  }
  const value = marshalResource(draft, context, preparation.modelRef, baseline, preparation.mode);
  const target = String(preparation.target || contract.model.write?.inputPath || '').trim();
  const output = contract.model.write?.collection === true ? [value] : value;
  if (target === '$' || target === '.') return output;
  return target ? setSelector({}, target, output) : output;
}

export {validateResource} from '../../validation/index.js';
