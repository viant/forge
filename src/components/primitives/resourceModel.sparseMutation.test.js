import assert from 'node:assert/strict';
import {prepareResourcePayload, resourceModelRefForDataSource} from './resourceModel.js';

// A write-only contract may share its source form with a richer read model.
const schema = {type: 'object', identity: ['id'], required: ['id', 'parentId', 'type'], additionalProperties: true, properties: {id: {type: 'integer'}, parentId: {type: 'integer'}, type: {type: 'string'}, target: {type: 'string', nullable: true}, exclusion: {type: 'string', nullable: true}}};
const mutation = {schemaRef: 'patch', write: {dataSourceRef: 'record_patch', inputPath: 'Records', mode: 'overlayBaseline', collection: true}, fields: {id: {write: 'Id', codec: 'integer', alwaysWrite: true}, parentId: {write: 'ParentId', codec: 'integer', alwaysWrite: true}, type: {write: '@type', codec: 'string', alwaysWrite: true}, target: {write: 'Target', codec: 'string'}, exclusion: {write: 'Exclusion', codec: 'string'}}};
const baseline = {id: 41, parentId: 70, type: 'std', name: 'Unchanged', status: 1, weight: 9, price: 1.5, cap: null, target: 'existing', exclusion: ''};
const frozenBaseline = structuredClone(baseline);
const context = {identity: {dataSourceRef: 'record_read'}, signals: {collection: {peek: () => [baseline]}}, metadata: {schemas: {patch: schema}, resourceModels: {read: {schemaRef: 'patch', read: {dataSourceRef: 'record_read'}}, patch: mutation}}, Context: () => ({signals: {collection: {peek: () => [baseline]}}})};
const preparation = {modelRef: 'patch', source: {scope: 'extras', selector: 'data'}, baseline: {scope: 'collection', dataSourceRef: 'record_read', selector: '0'}};
assert.equal(resourceModelRefForDataSource(context), 'read', 'write-only model must not create ambiguous read contracts');
const payload = prepareResourcePayload(context, preparation, {data: {...baseline, target: 'existing AND selected', name: 'Stray edit'}});
assert.deepEqual(payload, {Records: [{Id: 41, ParentId: 70, '@type': 'std', Target: 'existing AND selected', Exclusion: ''}]});
assert.equal(Object.keys(payload.Records[0]).length, 5, 'rich form and baseline fields must not leak into the sparse writer');
assert.deepEqual(baseline, frozenBaseline, 'baseline remains immutable during preparation');
assert.throws(() => prepareResourcePayload(context, preparation, {data: {...baseline, id: 42}}), /immutable/, 'changed draft identity must be rejected against the baseline');
const cleared = prepareResourcePayload(context, preparation, {data: {...baseline, target: ''}});
assert.equal(cleared.Records[0].Target, '', 'explicit empty expression must remain present for clear operations');
const expressionPreparation = {...preparation, fields: {id: {scope: 'extras', selector: 'data.id'}, parentId: {scope: 'extras', selector: 'data.parentId'}, type: {scope: 'constant', value: 'exp'}, target: {scope: 'extras', selector: 'data.target'}, exclusion: {scope: 'extras', selector: 'data.exclusion'}}};
assert.deepEqual(prepareResourcePayload(context, expressionPreparation, {data: {...baseline, target: 'existing AND selected'}}), {Records: [{Id: 41, ParentId: 70, '@type': 'exp', Target: 'existing AND selected', Exclusion: ''}]}, 'payload field constants must select the writer representation without changing the baseline');
assert.deepEqual(baseline, frozenBaseline);
console.log('write-only sparse resource mutation tests passed');
