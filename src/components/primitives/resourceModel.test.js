import assert from 'node:assert/strict';
import {
  marshalResource,
  prepareResourcePayload,
  resourceModelRefForDataSource,
  unmarshalResource,
  unmarshalResourceCollection,
  validateResource,
} from './resourceModel.js';

const hooks = [];
const collections = {
  record_read: [{id: 7, name: 'Original', cap: 2, enabled: true, children: [{id: 11, value: 25, label: 'one'}, {id: 12, value: 30, label: 'two'}]}],
};
const metadata = {
  schemas: {
    record: {
      type: 'object', identity: ['id'], required: ['id', 'name'], additionalProperties: true,
      properties: {
        id: {type: 'integer'}, name: {type: 'string', minLength: 1}, cap: {type: 'integer', nullable: true, minimum: 1},
        enabled: {type: 'boolean'}, secret: {type: 'string', readOnly: true}, children: {type: 'array', items: {$ref: 'child'}},
      },
    },
    child: {type: 'object', identity: ['id'], required: ['id'], properties: {id: {type: 'integer'}, value: {type: 'number'}, label: {type: 'string'}}},
  },
  resourceModels: {
    record: {
      schemaRef: 'record',
      read: {dataSourceRef: 'record_read'},
      write: {dataSourceRef: 'record_patch', inputPath: 'Records', mode: 'overlayBaseline', collection: true},
      hooks: {beforeUnmarshal: 'Models.beforeRead', afterUnmarshal: 'Models.afterRead', beforeMarshal: 'Models.beforeWrite', afterMarshal: 'Models.afterWrite'},
      fields: {
        id: {read: 'recordId', write: 'Id', codec: 'integer'},
        name: {read: 'displayName', write: 'Name', codec: 'string'},
        cap: {read: 'threshold', write: 'Threshold', codec: 'integer', empty: 'null'},
        enabled: {read: 'active', write: 'Enabled', codec: 'boolean'},
        secret: {read: 'secret'},
        children: {read: 'childRows', write: 'Children', collection: {modelRef: 'child', identity: ['id'], mode: 'merge', preserveOrder: true}},
      },
    },
    child: {schemaRef: 'child', fields: {id: {read: 'childId', write: 'Id'}, value: {read: 'amount', write: 'Value'}, label: {read: 'label', write: 'Label'}}},
  },
};
const context = {
  metadata,
  lookupHandler(name) {
    const callbacks = {
      'Models.beforeRead': ({value}) => { hooks.push(['beforeRead', Object.isFrozen(value)]); return value; },
      'Models.afterRead': ({value}) => { hooks.push(['afterRead', Object.isFrozen(value)]); return {...value, name: value.name.trim()}; },
      'Models.beforeWrite': ({value}) => { hooks.push(['beforeWrite', Object.isFrozen(value)]); return value; },
      'Models.afterWrite': ({value}) => { hooks.push(['afterWrite', Object.isFrozen(value)]); return {...value, Source: 'forge'}; },
    };
    return callbacks[name];
  },
  Context(ref) {
    return {
      signals: {collection: {peek: () => collections[ref]}},
      handlers: {dataSource: {getFormData: () => ({id: '7', name: 'Changed', cap: '', enabled: 'false', children: [{id: 11, value: '40'}]})}},
    };
  },
};

assert.equal(resourceModelRefForDataSource({...context, identity: {dataSourceRef: 'record_read'}}), 'record');
assert.equal(resourceModelRefForDataSource({...context, identity: {dataSourceRef: 'record_read'}}, 'explicit'), 'explicit');
const ambiguousContext = {metadata: {resourceModels: {...metadata.resourceModels, duplicate: {...metadata.resourceModels.record}}}, identity: {dataSourceRef: 'record_read'}};
assert.throws(() => resourceModelRefForDataSource(ambiguousContext), /multiple resource models/);

const read = unmarshalResource({recordId: '7', displayName: ' Alpha ', threshold: '3', active: 1, secret: 'read only', childRows: [{childId: '11', amount: '25.5', label: 'one'}, {childId: '12', amount: 30, label: 'two'}]}, context, 'record');
assert.deepEqual(read, {id: 7, name: 'Alpha', cap: 3, enabled: true, secret: 'read only', children: [{id: 11, value: 25.5, label: 'one'}, {id: 12, value: 30, label: 'two'}]});
assert.deepEqual(unmarshalResourceCollection([{recordId: 8, displayName: 'Beta', threshold: null, active: false, childRows: []}], context, 'record')[0].id, 8);

const wire = marshalResource({id: 7, name: 'Changed', cap: '', enabled: false, children: [{id: 11, value: 40}]}, context, 'record', read);
assert.deepEqual(wire, {Id: 7, Name: 'Changed', Threshold: null, Enabled: false, Children: [{Id: 11, Value: 40, Label: 'one'}, {Id: 12, Value: 30, Label: 'two'}], Source: 'forge'});

const payload = prepareResourcePayload(context, {
  modelRef: 'record', source: {scope: 'form', dataSourceRef: 'record_read'}, baseline: {scope: 'collection', dataSourceRef: 'record_read', selector: '0'},
}, {});
assert.deepEqual(payload, {Records: [{Id: 7, Name: 'Changed', Threshold: null, Enabled: false, Children: [{Id: 11, Value: 40, Label: 'one'}, {Id: 12, Value: 30, Label: 'two'}], Source: 'forge'}]});
assert.deepEqual(hooks.map(([name]) => name), ['beforeRead', 'afterRead', 'beforeRead', 'afterRead', 'beforeWrite', 'afterWrite', 'beforeWrite', 'afterWrite']);
assert.ok(hooks.every(([, immutable]) => immutable), 'hooks receive immutable value snapshots');

const changed = marshalResource({children: [{id: 11, value: 50}]}, context, 'record', read, 'changed');
assert.deepEqual(changed, {Id: 7, Children: [{Id: 11, Value: 50, Label: 'one'}, {Id: 12, Value: 30, Label: 'two'}], Source: 'forge'});
const sparseContext = {...context, metadata: structuredClone(metadata)};
sparseContext.metadata.resourceModels.record.fields.id.alwaysWrite = true;
const sparse = marshalResource({id: 7, name: 'Sparse'}, sparseContext, 'record', read, 'changed');
assert.deepEqual(sparse, {Id: 7, Name: 'Sparse', Source: 'forge'});
const baselineOrderContext = { ...context, metadata: structuredClone(metadata) };
baselineOrderContext.metadata.resourceModels.record.fields.children.collection.preserveOrder = false;
const reordered = marshalResource({children: [{id: 12, value: 31}, {id: 11, value: 26}]}, baselineOrderContext, 'record', read);
assert.deepEqual(reordered.Children.map((row) => row.Id), [11, 12], 'preserveOrder=false retains baseline order');
assert.throws(() => marshalResource({children: [{id: 11}, {id: 11}]}, context, 'record', read), /duplicate collection identity/);
assert.throws(() => marshalResource({children: [{value: 1}]}, context, 'record', read), /missing collection identity/);

assert.deepEqual(validateResource({id: 1, name: ''}, metadata.schemas.record, metadata.schemas), ['$.name is required', '$.name is too short']);
assert.throws(() => marshalResource({id: 'bad', name: 'X'}, context, 'record'), /must be an integer/);
assert.throws(() => unmarshalResource({}, {...context, lookupHandler: () => async () => ({})}, 'record'), /must be synchronous/);

const normalizedContext = {
  metadata: {
    schemas: {
      child: {type: 'object', properties: {id: {type: 'integer'}}},
      root: {type: 'object', required: ['id'], properties: {id: {type: 'integer'}, count: {type: 'integer'}, note: {type: 'string', nullable: true}, child: {$ref: 'child', nullable: true}}},
    },
    resourceModels: {
      child: {schemaRef: 'child', fields: {id: {write: 'Id'}}},
      root: {schemaRef: 'root', write: {inputPath: 'Root'}, fields: {id: {write: 'Id'}, count: {write: 'Count', codec: 'integer', default: 5}, note: {write: 'Note', codec: 'string', trim: true, empty: 'null'}, child: {write: 'Child', modelRef: 'child'}}},
    },
  },
};
assert.deepEqual(marshalResource({id: '4', count: null, note: '   ', child: null}, normalizedContext, 'root'), {Id: 4, Count: 5, Note: null, Child: null});
assert.deepEqual(validateResource({id: 1, child: null}, normalizedContext.metadata.schemas.root, normalizedContext.metadata.schemas), []);
const invalidEmptyContext = structuredClone(normalizedContext);
delete invalidEmptyContext.metadata.resourceModels.root.fields.count.default;
assert.throws(() => marshalResource({id: 4, count: ''}, invalidEmptyContext, 'root'), /must be an integer/);

const sparseRoutingContext = {
  metadata: {
    schemas: {record: {type: 'object', identity: ['id'], properties: {id: {type: 'integer', readOnly: true}, route: {type: 'string'}, name: {type: 'string'}}}},
    resourceModels: {record: {schemaRef: 'record', write: {inputPath: 'Records'}, fields: {id: {}, route: {write: 'Route', alwaysWrite: true}, name: {write: 'Name'}}}},
  },
};
assert.deepEqual(marshalResource({id: 5, route: 'owner', name: 'Changed'}, sparseRoutingContext, 'record', {id: 5, route: 'owner', name: 'Before'}), {id: 5, Route: 'owner', Name: 'Changed'});
assert.throws(() => marshalResource({route: 'owner', name: 'Changed'}, sparseRoutingContext, 'record', {name: 'Before'}), /record.id is required/);
assert.throws(() => marshalResource({id: 5, name: 'Changed'}, sparseRoutingContext, 'record', {id: 5, name: 'Before'}), /record.route is required/);
assert.deepEqual(marshalResource({name: 'Create'}, sparseRoutingContext, 'record', null, 'full'), {Name: 'Create'}, 'full create mode does not require sparse routing keys');
const identityOmissionContext = structuredClone(sparseRoutingContext);
identityOmissionContext.metadata.resourceModels.record.write.mode = 'full';
identityOmissionContext.metadata.resourceModels.record.fields.id.write = '-';
assert.throws(() => marshalResource({id: 5, route: 'owner', name: 'Changed'}, identityOmissionContext, 'record', {id: 5, route: 'owner', name: 'Before'}, 'changed'), /identity cannot be omitted/);

const canonicalDiffContext = {
  metadata: {
    schemas: {record: {type: 'object', identity: ['id'], properties: {id: {type: 'integer'}, name: {type: 'string'}, derived: {type: 'string'}, note: {type: 'string', nullable: true}}}},
    resourceModels: {record: {schemaRef: 'record', write: {inputPath: 'Records'}, hooks: {beforeMarshal: 'Models.derive'}, fields: {id: {write: 'Id'}, name: {write: 'Name'}, derived: {write: 'Derived'}, note: {write: 'Note', trim: true, empty: 'null'}}}},
  },
  lookupHandler: () => ({value}) => ({...value, derived: String(value.name || '').toUpperCase()}),
};
const canonicalDiff = marshalResource({id: 3, name: 'beta', note: ' value '}, canonicalDiffContext, 'record', {id: 3, name: 'alpha', derived: 'ALPHA', note: 'value'}, 'changed');
assert.deepEqual(canonicalDiff, {Id: 3, Name: 'beta', Derived: 'BETA'}, 'changed mode diffs normalized hook output and suppresses trim-equivalent noise');

assert.throws(() => marshalResource({id: 6, route: 'owner', name: 'Changed'}, sparseRoutingContext, 'record', {id: 5, route: 'owner', name: 'Before'}, 'overlayBaseline'), /record\.id is immutable/);

const composedContext = {
  metadata: {
    schemas: {mutation: {type: 'object', required: ['operation', 'recordId'], properties: {
      operation: {type: 'string'}, recordId: {type: 'integer'}, tenantId: {type: 'integer'}, revision: {type: 'integer'}, primaryRelatedIds: {type: 'array', items: {type: 'integer'}}, secondaryRelatedIds: {type: 'array', items: {type: 'integer'}},
    }}},
    resourceModels: {mutation: {schemaRef: 'mutation', write: {inputPath: 'Mutation', mode: 'full'}, fields: {
      operation: {}, recordId: {}, tenantId: {}, revision: {}, primaryRelatedIds: {}, secondaryRelatedIds: {},
    }}},
  },
  signals: {windowForm: {peek: () => ({RecordId: [101]})}, input: {peek: () => ({parameters: {Revision: 9}})}},
  Context: (ref) => ref === 'record_read' ? {signals: {metrics: {peek: () => ({tenantId: 202})}}} : null,
};
const composed = prepareResourcePayload(composedContext, {
  modelRef: 'mutation',
  fields: {
    operation: {scope: 'constant', value: 'unassign'},
    recordId: {scope: 'windowForm', selector: 'RecordId.0', codec: 'integer'},
    tenantId: {scope: 'metrics', dataSourceRef: 'record_read', selector: 'tenantId', codec: 'integer'},
    revision: {scope: 'input', selector: 'parameters.Revision', codec: 'integer'},
    primaryRelatedIds: {scope: 'extras', selector: 'selectedRows', where: {field: 'relationKind', equals: 'primary'}, mapSelector: 'id', codec: 'integer'},
    secondaryRelatedIds: {scope: 'extras', selector: 'selectedRows', where: {field: 'relationKind', equals: 'secondary'}, mapSelector: 'id', codec: 'integer'},
  },
}, {selectedRows: [{id: '11', relationKind: 'primary'}, {id: 22, relationKind: 'secondary'}, {id: '12', relationKind: 'primary'}]});
assert.deepEqual(composed, {Mutation: {operation: 'unassign', recordId: 101, tenantId: 202, revision: 9, primaryRelatedIds: [11, 12], secondaryRelatedIds: [22]}});
const rootPayloadContext = {...composedContext, metadata: structuredClone(composedContext.metadata)};
rootPayloadContext.metadata.resourceModels.mutation.write.inputPath = '$';
assert.deepEqual(prepareResourcePayload(rootPayloadContext, {modelRef: 'mutation', source: {scope: 'extras', selector: 'data'}, mode: 'full'}, {data: {
  operation: 'assign', recordId: 101, primaryRelatedIds: [], secondaryRelatedIds: [],
}}), {operation: 'assign', recordId: 101, primaryRelatedIds: [], secondaryRelatedIds: []});

const clientKeyContext = {
  metadata: {
    schemas: {
      row: {type: 'object', identity: ['id'], required: ['id', 'clientKey'], properties: {id: {type: 'integer'}, clientKey: {type: 'string'}, name: {type: 'string'}}},
      root: {type: 'object', properties: {rows: {type: 'array', items: {$ref: 'row'}}}},
    },
    resourceModels: {
      row: {schemaRef: 'row', fields: {id: {write: 'Id'}, clientKey: {write: '-'}, name: {write: 'Name'}}},
      root: {schemaRef: 'root', write: {inputPath: 'Root', mode: 'overlayBaseline'}, fields: {rows: {write: 'Rows', collection: {modelRef: 'row', identity: ['id'], clientKey: 'clientKey', mode: 'replace'}}}},
    },
  },
};
const newRows = marshalResource({rows: [{id: 0, clientKey: 'new-a', name: 'A'}, {id: 0, clientKey: 'new-b', name: 'B'}]}, clientKeyContext, 'root', {rows: []}, 'overlayBaseline');
assert.deepEqual(newRows, {Rows: [{Id: 0, Name: 'A'}, {Id: 0, Name: 'B'}]});
assert.throws(() => marshalResource({rows: [{id: 0, clientKey: 'same', name: 'A'}, {id: 0, clientKey: 'same', name: 'B'}]}, clientKeyContext, 'root', {rows: []}, 'overlayBaseline'), /duplicate collection identity/);

console.log('resourceModel ✓ typed read/write marshalling, hooks, validation, baseline overlay, and nesting');
