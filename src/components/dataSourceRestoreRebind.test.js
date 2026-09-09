import assert from 'node:assert/strict';

import {getControlSignal, getInputSignal} from '../core/store/signals.js';
import {
    reconcileRestoredPendingFetch,
} from './dataSourceFetchState.js';
import {reconcileFetchForMetadataReadiness} from './dataSourceMetadataReadiness.js';

const input = getInputSignal('restoreRebindDSline_history');
const control = getControlSignal('restoreRebindDSline_history');
input.value = {fetch: true, parameters: {AudienceId: 7396187}, __forgeRestoredPendingFetch: true};
control.value = {loading: true, loaded: false};

const suppressed = reconcileRestoredPendingFetch(
    {replayPendingFetchOnRestore: false},
    input.peek(),
    control.peek(),
);
input.value = suppressed.input;
control.value = suppressed.control;

assert.deepEqual(input.peek(), {fetch: false, refresh: false, parameters: {AudienceId: 7396187}});
assert.deepEqual(control.peek(), {loading: false, loaded: false, stale: false});

const reboundParameters = {Id: 7396187};
input.value = {...input.peek(), parameters: reboundParameters, fetch: true};

assert.deepEqual(
    input.peek(),
    {fetch: true, refresh: false, parameters: {Id: 7396187}},
    'required rebinding must schedule exactly one fresh Id request after stale replay is suppressed',
);
assert.equal(input.peek().__forgeRestoredPendingFetch, undefined);

input.value = {fetch: true, parameters: {AudienceId: 7396187}};
control.value = {loading: true, loaded: false, stale: true};
const desktopTarget = {platform: 'web', formFactor: 'desktop', surface: ''};
const staleMetadataSuppression = reconcileFetchForMetadataReadiness(
    {
        identity: {dataSourceRef: 'line_history'},
        metadata: {
            __targetKey: JSON.stringify({platform: 'web', formFactor: 'phone', surface: '', capabilities: []}),
            __provisionalInline: false,
        },
        _globalServices: {__connectorRuntime: {targetContext: desktopTarget}},
    },
    input.peek(),
    control.peek(),
);
input.value = staleMetadataSuppression.input;
control.value = staleMetadataSuppression.control;

assert.deepEqual(
    input.peek(),
    {fetch: false, refresh: false, parameters: {AudienceId: 7396187}},
    'old target metadata must suppress stale launch arguments instead of reaching the connector',
);
assert.deepEqual(
    control.peek(),
    {loading: false, loaded: false, stale: false},
    'metadata-generation suppression must settle orphaned responsive loading state',
);

const authorizationFetch = reconcileFetchForMetadataReadiness(
    {
        identity: {dataSourceRef: 'resource_authorization'},
        metadata: {__provisionalInline: true},
        _globalServices: {__connectorRuntime: {targetContext: desktopTarget}},
    },
    {fetch: true, parameters: {AudienceId: 7396187}},
    {loading: false},
);
assert.equal(authorizationFetch, null, 'authorization must remain mountable while target metadata is provisional');

const currentMetadataFetch = reconcileFetchForMetadataReadiness(
    {
        identity: {dataSourceRef: 'line_history'},
        metadata: {
            __targetKey: JSON.stringify({platform: 'web', formFactor: 'desktop', surface: '', capabilities: []}),
            __provisionalInline: false,
        },
        _globalServices: {__connectorRuntime: {targetContext: desktopTarget}},
    },
    {fetch: true, parameters: {Id: 7396187}},
    {loading: false},
);
assert.equal(currentMetadataFetch, null, 'current non-provisional metadata must allow the fresh Id request');

console.log('dataSourceRestoreRebind ✓ suppresses stale launch input and schedules one fresh required-parameter fetch');
