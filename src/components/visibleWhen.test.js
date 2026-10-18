import assert from 'node:assert/strict';

import {evaluatePlainVisibleWhen, isContainerVisible, resolveChildContext, trackVisibleWhen} from './visibleWhen.js';

const metricsContext = (metrics, overrides = {}) => ({
    metadata: {dataSource: {base: {}, profile: {}}},
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

const authorizationContext = metricsContext({}, {
    authorization: {
        principal: {features: ['ENABLE_EXPORTS']},
        resource: {capabilities: {read: true, write: false}},
    },
});

assert.equal(isContainerVisible({
    id: 'exports',
    visibleWhen: {source: 'authorization', field: 'principal.features', contains: 'ENABLE_EXPORTS'},
}, authorizationContext), true);
assert.equal(isContainerVisible({
    id: 'edit',
    visibleWhen: {source: 'authorization', field: 'resource.capabilities.write', equals: true},
}, authorizationContext), false);
assert.equal(isContainerVisible({
    id: 'hiddenHistory',
    hiddenWhen: {source: 'authorization', field: 'resource.capabilities.read', equals: true},
}, authorizationContext), false);
assert.equal(isContainerVisible({
    id: 'failClosed',
    visibleWhen: {source: 'authorization', field: 'resource.capabilities.read'},
}, metricsContext({})), false);
assert.equal(isContainerVisible({
    id: 'validHttps',
    visibleWhen: {source: 'metrics', field: 'landingPageUrl', matches: '^https://.+'},
}, metricsContext({landingPageUrl: 'https://example.com'})), true);
assert.equal(isContainerVisible({
    id: 'invalidHttp',
    visibleWhen: {source: 'metrics', field: 'landingPageUrl', matches: '^https://.+'},
}, metricsContext({landingPageUrl: 'http://example.com'})), false);
assert.equal(isContainerVisible({
    id: 'insideNumericBounds',
    visibleWhen: {source: 'metrics', field: 'windowHours', gt: 0, lte: 720},
}, metricsContext({windowHours: '720'})), true);
assert.equal(isContainerVisible({
    id: 'outsideNumericBounds',
    visibleWhen: {source: 'metrics', field: 'windowHours', gt: 0, lte: 720},
}, metricsContext({windowHours: 721})), false);
assert.equal(isContainerVisible({
    id: 'invalidNumericValue',
    visibleWhen: {source: 'metrics', field: 'windowHours', gt: 0},
}, metricsContext({windowHours: ''})), false);

assert.equal(evaluatePlainVisibleWhen(
    {source: 'row', field: 'implementation', equals: 'available'},
    metricsContext({}),
    {implementation: 'available'},
), true);
assert.equal(evaluatePlainVisibleWhen(
    {source: 'row', field: 'implementation', equals: 'available'},
    metricsContext({}),
    {implementation: 'unavailable'},
), false);

const dirtyFormContext = metricsContext({}, {
    signals: {
        formStatus: {
            peek: () => ({dirty: true}),
            value: {dirty: true},
        },
    },
});
assert.equal(evaluatePlainVisibleWhen(
    {source: 'formStatus', field: 'dirty', equals: true},
    dirtyFormContext,
), true, 'generic mutation predicates can gate on the scoped datasource dirty state');
assert.equal(evaluatePlainVisibleWhen(
    {source: 'formStatus', field: 'dirty', equals: false},
    dirtyFormContext,
), false);

console.log('visibleWhen ✓');

let tracked=0;
const control={loaded:true,loading:false,error:null};
const readySignal={peek:()=>control,get value(){tracked++;return control;}};
const baselineContext={identity:{dataSourceRef:'baseline'},signals:{control:readySignal}};
const invokingContext={identity:{dataSourceRef:'table'},Context:ref=>ref==='baseline'?baselineContext:undefined,signals:{control:{peek:()=>({loaded:false})}}};
const readyWhen={all:[
 {source:'control',dataSourceRef:'baseline',field:'loaded',equals:true},
 {source:'control',dataSourceRef:'baseline',field:'loading',notEquals:true},
 {source:'control',dataSourceRef:'baseline',field:'error',empty:true},
]};
assert.equal(evaluatePlainVisibleWhen(readyWhen,invokingContext),true);
trackVisibleWhen(readyWhen,invokingContext);assert.equal(tracked,3,'track only the explicitly referenced datasource control');
control.loading=true;assert.equal(evaluatePlainVisibleWhen(readyWhen,invokingContext),false);
control.loading=false;control.error='last page failed';assert.equal(evaluatePlainVisibleWhen(readyWhen,invokingContext),false);
assert.equal(evaluatePlainVisibleWhen({source:'control',dataSourceRef:'missing',field:'loaded',equals:true},invokingContext),false);
console.log('visibleWhen ✓ scoped datasource readiness and signal tracking');
