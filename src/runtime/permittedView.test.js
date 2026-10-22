import assert from 'node:assert/strict';
import {
  compilePermittedView,
  normalizeAuthorizationSnapshot,
  reduceAuthorizationCondition,
  resolveAuthorizationResourceID,
  authorizationSnapshotLeaseMs,
  evaluateAuthorizationLeaf,
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

for (const guard of ['visibleWhen', 'hiddenWhen', 'disabledWhen', 'readOnlyWhen']) {
  const malformed = {view: {content: {id: 'root', containers: [{id: 'item', [guard]: {source: 'authorization', field: 'principal.roles', greaterThan: 1}}]}}};
  assert.throws(() => compilePermittedView(malformed, authorization), /unknown authorization operator/);
}
const dynamic = {view: {content: {id: 'root', containers: [{id: 'item', hiddenWhen: {source: 'windowForm', field: 'status', equals: 'hidden'}}]}}};
assert.deepEqual(compilePermittedView(dynamic, authorization).metadata.view.content.containers[0].hiddenWhen, dynamic.view.content.containers[0].hiddenWhen);

const largeID = '9007199254740993';
assert.deepEqual(resolveAuthorizationResourceID(2, largeID, {schemaVersion: 2}), {valid: true, id: largeID});
assert.equal(resolveAuthorizationResourceID(2, Number(largeID), {schemaVersion: 2}).valid, false);
assert.equal(resolveAuthorizationResourceID(2, largeID, {}).valid, false);
assert.deepEqual(resolveAuthorizationResourceID(1, 42, {}), {valid: true, id: 42});
assert.equal(resolveAuthorizationResourceID(1, Number(largeID), {}).valid, false);
assert.equal(authorizationSnapshotLeaseMs({expiresAt: '2026-01-01T00:00:10Z'}, Date.parse('2026-01-01T00:00:00Z')), 10000);
assert.equal(authorizationSnapshotLeaseMs({expiresAt: '2026-01-01T00:00:00Z'}, Date.parse('2026-01-01T00:00:10Z')), 0);
assert.equal(authorizationSnapshotLeaseMs({}), 0);

const factsResponse = {principal: {roles: ['reader'], features: Array.from({length: 211}, (_, i) => `feature-${i}`)}};
const facts = normalizeAuthorizationSnapshot(factsResponse);
const roleGuard = {field: 'principal.roles', contains: 'reader'};
const featureGuard = {field: 'principal.features', contains: 'feature-210'};
// Repeated guards must neither scan the owned arrays nor construct new sets.
const originalIncludes = Array.prototype.includes;
const OriginalSet = globalThis.Set;
try {
  Array.prototype.includes = function () { throw new Error('membership scanned an array'); };
  globalThis.Set = class { constructor() { throw new Error('membership rebuilt a set'); } };
  for (let i = 0; i < 1000; i++) {
    assert.equal(evaluateAuthorizationLeaf(roleGuard, facts), true);
    assert.equal(evaluateAuthorizationLeaf(featureGuard, facts), true);
    assert.equal(evaluateAuthorizationLeaf({...featureGuard, contains: 'absent'}, facts), false);
  }
} finally {
  Array.prototype.includes = originalIncludes;
  globalThis.Set = OriginalSet;
}
assert.equal(Object.isFrozen(facts.principal.features), true);
assert.deepEqual(JSON.parse(JSON.stringify(facts.principal)), factsResponse.principal);
factsResponse.principal.roles.splice(0, 1, 'editor');
assert.equal(evaluateAuthorizationLeaf(roleGuard, facts), true);
assert.equal(evaluateAuthorizationLeaf(roleGuard, normalizeAuthorizationSnapshot(factsResponse)), false);
assert.equal(evaluateAuthorizationLeaf({field: 'principal.roles', contains: 'editor'}, normalizeAuthorizationSnapshot(factsResponse)), true);
// Unowned mutable callers retain live semantics; they are never cached by identity.
assert.equal(evaluateAuthorizationLeaf(roleGuard, factsResponse), false);
factsResponse.principal.roles.push('reader');
assert.equal(evaluateAuthorizationLeaf(roleGuard, factsResponse), true);

console.log('permitted view compiler ✓');
