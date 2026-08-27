import assert from 'node:assert/strict';

import {isContainerVisible, resolveChildContext} from './visibleWhen.js';

const metricsContext = (metrics, overrides = {}) => ({
    identity: {
        windowId: 'W1',
        dataSourceRef: 'base',
        ...(overrides.identity || {}),
    },
    signals: {
        metrics: {
            peek: () => metrics,
            value: metrics,
        },
        ...(overrides.signals || {}),
    },
    ...overrides,
});

const profileContext = metricsContext({isHousehold: 1}, {
    identity: {
        dataSourceRef: 'profile',
    },
});

const baseContext = metricsContext({}, {
    Context(ref) {
        if (ref === 'profile') {
            return profileContext;
        }
        return this;
    },
});

assert.equal(resolveChildContext(baseContext, 'profile'), profileContext);
assert.equal(
    isContainerVisible({
        id: 'hhMetricsTab',
        dataSourceRef: 'profile',
        visibleWhen: {
            source: 'metrics',
            field: 'isHousehold',
        },
    }, baseContext),
    true,
);

const nonHouseholdContext = metricsContext({}, {
    Context() {
        return metricsContext({isHousehold: 0}, {
            identity: {
                dataSourceRef: 'profile',
            },
        });
    },
});

assert.equal(
    isContainerVisible({
        id: 'hhMetricsTab',
        dataSourceRef: 'profile',
        visibleWhen: {
            source: 'metrics',
            field: 'isHousehold',
        },
    }, nonHouseholdContext),
    false,
);

const automationContext = metricsContext({}, {
    signals: {
        collection: {
            peek: () => [],
            value: [],
        },
        windowForm: {
            peek: () => ({automationView: 'list'}),
            value: {automationView: 'list'},
        },
    },
});

assert.equal(
    isContainerVisible({
        id: 'automationGuidance',
        visibleWhen: {
            all: [
                {source: 'collection', empty: true},
                {source: 'windowForm', field: 'automationView', notEquals: 'editor'},
            ],
        },
    }, automationContext),
    true,
);

assert.equal(
    isContainerVisible({
        id: 'automationWorkspace',
        visibleWhen: {source: 'collection', notEmpty: true},
    }, automationContext),
    false,
);

const populatedAutomationContext = metricsContext({}, {
    signals: {
        collection: {
            peek: () => [{id: 'schedule-1'}],
            value: [{id: 'schedule-1'}],
        },
        windowForm: {
            peek: () => ({automationView: 'list'}),
            value: {automationView: 'list'},
        },
    },
});

assert.equal(
    isContainerVisible({
        id: 'automationWorkspace',
        visibleWhen: {source: 'collection', notEmpty: true},
    }, populatedAutomationContext),
    true,
);

console.log('visibleWhen ✓');
