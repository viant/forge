import assert from 'node:assert/strict';
import {
  compilePermittedView,
  normalizeAuthorizationSnapshot,
  reduceAuthorizationCondition,
} from './permittedView.js';

const response = {
  authorizationVersion: 'v1',
  principal: {features: ['ENABLE_EXPORTS']},
  resources: {'42': {id: 42, capabilities: {read: true, write: false, viewHistory: true}}},
};
const authorization = normalizeAuthorizationSnapshot(response, 'document', 42);

const metadata = {
  dataSource: {identity: {}, edit: {}, history: {}},
  view: {content: {id: 'root', containers: [
    {id: 'overview', dataSourceRef: 'identity'},
    {id: 'edit', dataSourceRef: 'edit', visibleWhen: {source: 'authorization', field: 'resource.capabilities.write', equals: true}},
    {id: 'history', dataSourceRef: 'history', visibleWhen: {source: 'authorization', field: 'resource.capabilities.viewHistory', equals: true}},
    {id: 'export', items: [{id: 'download', type: 'button', visibleWhen: {source: 'authorization', field: 'principal.features', contains: 'ENABLE_EXPORTS'}}]},
  ]}},
};

const compiled = compilePermittedView(metadata, authorization, {requireRead: true});
assert.equal(compiled.denied, false);
assert.deepEqual(compiled.metadata.view.content.containers.map((entry) => entry.id), ['overview', 'history', 'export']);
assert.deepEqual([...compiled.dataSourceRefs].sort(), ['history', 'identity']);
assert.deepEqual(Object.keys(compiled.metadata.dataSource).sort(), ['history', 'identity']);

const mixed = reduceAuthorizationCondition({all: [
  {source: 'authorization', field: 'resource.capabilities.read', equals: true},
  {source: 'windowForm', field: 'state', equals: 'normal'},
]}, authorization);
assert.equal(mixed.kind, 'dynamic');
assert.equal(mixed.condition.source, 'windowForm');

const denied = compilePermittedView(metadata, normalizeAuthorizationSnapshot(response, 'document', 999), {requireRead: true});
assert.equal(denied.denied, true);
assert.equal(denied.metadata, null);

const missingAuth = compilePermittedView({view: {content: {id: 'root', containers: [
  {id: 'protected', visibleWhen: {source: 'authorization', field: 'resource.capabilities.write', equals: true}},
]}}}, null);
assert.deepEqual(missingAuth.metadata.view.content.containers, []);

console.log('permitted view compiler ✓');
