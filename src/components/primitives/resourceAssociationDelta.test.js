import assert from 'node:assert/strict';
import test from 'node:test';
import {marshalResource, prepareResourcePayload, unmarshalResource} from './resourceModel.js';

const ids = {type: 'array', items: {type: 'integer'}};
const schema = (field, value) => ({
  type: 'object',
  identity: ['id'],
  properties: {id: {type: 'integer'}, complete: {type: 'boolean', readOnly: true}, [field]: value},
});
const context = {metadata: {
  schemas: {
    membership: schema('members', ids),
    operation: schema('edit', {type: 'object', properties: {added: ids, deleted: ids}, additionalProperties: false}),
  },
  resourceModels: {
    membership: {
      schemaRef: 'membership',
      write: {mode: 'changed', inputPath: 'records', collection: true},
      fields: {
        members: {associationDelta: {mode: 'diff', baselineComplete: 'complete', added: 'associations.include', deleted: 'associations.exclude'}},
      },
    },
    operation: {
      schemaRef: 'operation',
      write: {mode: 'changed', inputPath: 'records', collection: true},
      fields: {
        edit: {associationDelta: {mode: 'explicit', added: 'requested.addedIDs', deleted: 'requested.removedIDs'}},
      },
    },
  },
}};

const baseline = {id: 3, complete: true, members: [9, 2, 6, 9]};

test('available complete membership projects both sparse lists in stable order', () => {
  const draft = {id: 3, members: [6, 4, 8, 4]};
  const input = {old: baseline, current: draft};
  assert.deepEqual(prepareResourcePayload(context, {
    modelRef: 'membership',
    source: {scope: 'extras', selector: 'current'},
    baseline: {scope: 'extras', selector: 'old'},
  }, input), {records: [{id: 3, associations: {include: [4, 8], exclude: [9, 2]}}]});
  assert.deepEqual(baseline.members, [9, 2, 6, 9]);
  assert.deepEqual(draft.members, [6, 4, 8, 4]);
});

test('omission, semantic equality and reverted drafts omit both wire lists', () => {
  const wire = draft => marshalResource(draft, context, 'membership', baseline);
  assert.deepEqual(wire({id: 3}), {id: 3});
  assert.deepEqual(wire({id: 3, members: [6, 2, 9]}), {id: 3});
  assert.deepEqual(wire({id: 3, members: []}), {id: 3, associations: {exclude: [9, 2, 6]}});
  assert.deepEqual(marshalResource({id: 3, members: []}, context, 'membership', {id: 3, complete: true, members: []}), {id: 3});
});

test('diff fails before dispatch without complete membership and exact ID types', () => {
  for (const prior of [undefined, {id: 3, members: [9]}, {id: 3, complete: false, members: [9]}, {id: 3, complete: 'true', members: [9]}]) {
    assert.throws(() => marshalResource({id: 3, members: []}, context, 'membership', prior), /complete association baseline/);
  }
  assert.throws(() => marshalResource({id: 3, members: []}, context, 'membership', {id: 3, complete: true}), /baseline must be an ID array/);
  assert.deepEqual(marshalResource({id: 3}, context, 'membership', {id: 3, complete: false, members: [9]}), {id: 3});
  for (const invalid of [true, '9', null, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => marshalResource({id: 3, members: [invalid]}, context, 'membership', baseline), /safe integer|must be (an )?integer|null/);
  }
});

test('explicit intent works without a baseline and cannot infer removals from a prior page', () => {
  const write = (edit, prior = null) => marshalResource({id: 3, edit}, context, 'operation', prior);
  assert.deepEqual(write({added: [1, 1, 2], deleted: [9, 8, 9]}), {
    id: 3, requested: {addedIDs: [1, 2], removedIDs: [9, 8]},
  });
  assert.deepEqual(write({added: [1]}, {id: 3, complete: false, edit: {deleted: [9]}}), {
    id: 3, requested: {addedIDs: [1]},
  });
  assert.deepEqual(write({deleted: [9]}, {id: 3, edit: {deleted: [9]}}), {id: 3, requested: {removedIDs: [9]}});
  assert.deepEqual(write({added: [], deleted: []}), {id: 3});
  assert.deepEqual(write(undefined, {id: 3, edit: {deleted: [9]}}), {id: 3});
  assert.deepEqual(unmarshalResource({id: 3, edit: {deleted: [9]}}, context, 'operation'), {id: 3});
  assert.throws(() => write({added: [1, 2], deleted: [2]}), /same ID/);
  assert.throws(() => write({deleted: null}), /ID array|null/);
});

test('reordered nested parents use their own persisted association IDs', () => {
  const nested = structuredClone(context);
  const {schemas, resourceModels} = nested.metadata;
  schemas.group = schema('rows', {type: 'array', items: {$ref: 'membership'}});
  resourceModels.group = {
    schemaRef: 'group',
    write: {mode: 'changed'},
    fields: {rows: {write: 'Rows', collection: {modelRef: 'membership', mode: 'merge'}}},
  };
  const prior = {id: 1, rows: [
    {id: 3, complete: true, members: [4, 9]},
    {id: 6, complete: true, members: [8, 15]},
    {id: 10, complete: false, members: [7]},
  ]};
  const draft = {id: 1, rows: [
    {id: 6, members: [15, 16]},
    {id: 3, members: [9, 12]},
  ]};
  assert.deepEqual(marshalResource(draft, nested, 'group', prior), {id: 1, Rows: [
    {id: 6, associations: {include: [16], exclude: [8]}},
    {id: 3, associations: {include: [12], exclude: [4]}},
    {id: 10},
  ]});
  prior.rows[0].complete = 'true';
  assert.throws(() => marshalResource(draft, nested, 'group', prior), /complete association baseline/);
});
