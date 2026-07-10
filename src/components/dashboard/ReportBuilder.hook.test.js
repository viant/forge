import assert from "node:assert/strict";

import {
    applyReportBuilderRequestHook,
    applyReportBuilderStateHook,
    buildLookupHydrationJobs,
    hydrateReportBuilderLookupLabels,
    prefillSignature,
    resolveReportBuilderHookHandler,
    resolveReportBuilderLookupDescriptor,
    resolveReportBuilderNotices,
    shouldDeferReportBuilderRequestForPrefill,
} from "./reportBuilderHooks.js";

const prefill = { dealId: 778899 };
assert.notEqual(
    prefillSignature({
        prefill,
        __forge: { prefillRevision: 1 },
    }),
    prefillSignature({
        prefill,
        __forge: { prefillRevision: 2 },
    }),
);
assert.equal(
    shouldDeferReportBuilderRequestForPrefill({
        currentPrefillSignature: "",
        appliedPrefillSignature: "",
    }),
    false,
);
assert.equal(
    shouldDeferReportBuilderRequestForPrefill({
        currentPrefillSignature: "prefill::1",
        appliedPrefillSignature: "",
    }),
    true,
);
assert.equal(
    shouldDeferReportBuilderRequestForPrefill({
        currentPrefillSignature: "prefill::1",
        appliedPrefillSignature: "prefill::1",
    }),
    false,
);

const namespacedCalls = [];
const namespacedHandler = () => "ok";
const namespacedContext = {
    metadata: { namespace: "Performance Metrics" },
    lookupHandler(name) {
        namespacedCalls.push(name);
        if (name === "Performance Metrics.metricsReportBuilder.buildRequest") {
            return namespacedHandler;
        }
        throw new Error(`missing ${name}`);
    },
};
assert.equal(
    resolveReportBuilderHookHandler(namespacedContext, "metricsReportBuilder.buildRequest"),
    namespacedHandler,
);
assert.deepEqual(namespacedCalls, [
    "metricsReportBuilder.buildRequest",
    "Performance Metrics.metricsReportBuilder.buildRequest",
]);

const directHandler = () => "ok";
const directContext = {
    metadata: { namespace: "Performance Metrics" },
    lookupHandler(name) {
        if (name === "metricsReportBuilder.buildRequest") {
            return directHandler;
        }
        throw new Error(`missing ${name}`);
    },
};
assert.equal(
    resolveReportBuilderHookHandler(directContext, "metricsReportBuilder.buildRequest"),
    directHandler,
);

const strippedHandlerCalls = [];
const strippedHandler = () => "ok";
const strippedContext = {
    metadata: { namespace: "Performance Metrics" },
    lookupHandler(name) {
        strippedHandlerCalls.push(name);
        if (name === "stewardReportBuilder.buildRequest") {
            return strippedHandler;
        }
        throw new Error(`missing ${name}`);
    },
};
assert.equal(
    resolveReportBuilderHookHandler(strippedContext, "Performance Metrics.stewardReportBuilder.buildRequest"),
    strippedHandler,
);
assert.deepEqual(strippedHandlerCalls, [
    "Performance Metrics.stewardReportBuilder.buildRequest",
    "stewardReportBuilder.buildRequest",
]);

const suffixFallbackCalls = [];
const suffixFallbackHandler = () => "ok";
const suffixFallbackContext = {
    metadata: {},
    lookupHandler(name) {
        suffixFallbackCalls.push(name);
        if (name === "stewardReportBuilder.buildRequest") {
            return suffixFallbackHandler;
        }
        throw new Error(`missing ${name}`);
    },
};
assert.equal(
    resolveReportBuilderHookHandler(suffixFallbackContext, "Performance Metrics.stewardReportBuilder.buildRequest"),
    suffixFallbackHandler,
);
assert.deepEqual(suffixFallbackCalls, [
    "Performance Metrics.stewardReportBuilder.buildRequest",
    "stewardReportBuilder.buildRequest",
]);

const stateHookContext = {
    metadata: { namespace: "Performance Metrics" },
    lookupHandler(name) {
        if (name === "Performance Metrics.metricsReportBuilder.initializeState") {
            return ({ state, windowForm }) => ({
                ...state,
                seededFromPrefill: windowForm.prefill.advertiserId,
            });
        }
        throw new Error(`missing ${name}`);
    },
};
assert.deepEqual(
    applyReportBuilderStateHook(
        stateHookContext,
        { hooks: { initializeState: "Performance Metrics.metricsReportBuilder.initializeState" } },
        { page: 1 },
        { prefill: { advertiserId: 123 } },
    ),
    {
        page: 1,
        seededFromPrefill: 123,
    },
);
const invalidStateHookContext = {
    metadata: { namespace: "Performance Metrics" },
    lookupHandler(name) {
        if (name === "Performance Metrics.metricsReportBuilder.initializeState") {
            return () => ["invalid"];
        }
        throw new Error(`missing ${name}`);
    },
};
assert.deepEqual(
    applyReportBuilderStateHook(
        invalidStateHookContext,
        { hooks: { initializeState: "Performance Metrics.metricsReportBuilder.initializeState" } },
        { page: 2 },
        {},
    ),
    { page: 2 },
);

const requestHookContext = {
    metadata: { namespace: "Performance Metrics" },
    lookupHandler(name) {
        if (name === "Performance Metrics.metricsReportBuilder.buildRequest") {
            return ({ request }) => ({
                ...request,
                filters: {
                    ...(request.filters || {}),
                    channelIds: [1, 2],
                },
            });
        }
        throw new Error(`missing ${name}`);
    },
};
assert.deepEqual(
    applyReportBuilderRequestHook(
        requestHookContext,
        { hooks: { buildRequest: "Performance Metrics.metricsReportBuilder.buildRequest" } },
        {},
        { filters: { channelIds: [1, 2] } },
    ),
    {
        filters: {
            channelIds: [1, 2],
        },
    },
);
const invalidRequestHookContext = {
    metadata: { namespace: "Performance Metrics" },
    lookupHandler(name) {
        if (name === "Performance Metrics.metricsReportBuilder.buildRequest") {
            return () => ["invalid"];
        }
        throw new Error(`missing ${name}`);
    },
};
assert.deepEqual(
    applyReportBuilderRequestHook(
        invalidRequestHookContext,
        { hooks: { buildRequest: "Performance Metrics.metricsReportBuilder.buildRequest" } },
        { page: 1 },
        { limit: 25 },
    ),
    { limit: 25 },
);

assert.deepEqual(
    resolveReportBuilderNotices(
        {
            notices: [
                {
                    id: "unsupportedCapacityFeatures",
                    level: "warning",
                    title: "Unsupported capacity features were skipped",
                    sourcePath: "capacityHandoffMeta.unsupportedFeatureKeys",
                },
            ],
        },
        {
            capacityHandoffMeta: {
                unsupportedFeatureKeys: ["peer39.social.context"],
            },
        },
    ),
    [
        {
            id: "unsupportedCapacityFeatures",
            level: "warning",
            title: "Unsupported capacity features were skipped",
            description: "",
            items: ["peer39.social.context"],
        },
    ],
);

const lookupContext = {
    metadata: { namespace: "Capacity" },
    lookupHandler(name) {
        if (name === "Capacity.capacityBuilder.resolveLookup") {
            return ({ filterDef, rowId }) => ({
                dialogId: "targetingTreePicker",
                parameters: {
                    Field: "USER_POOL",
                    rowId,
                    featureKey: filterDef.targetingFeatureKey,
                },
            });
        }
        throw new Error(`missing ${name}`);
    },
};
assert.deepEqual(
    resolveReportBuilderLookupDescriptor(
        lookupContext,
        { hooks: { resolveLookup: "Capacity.capacityBuilder.resolveLookup" } },
        { scopeParams: { channelIds: [1] } },
        { id: "include" },
        {
            id: "includeUserPools",
            targetingFeatureKey: "user.segment",
            lookup: { multiple: true },
        },
        "row_1",
    ),
    {
        multiple: true,
        dialogId: "targetingTreePicker",
        parameters: {
            Field: "USER_POOL",
            rowId: "row_1",
            featureKey: "user.segment",
        },
    },
);

const nullLookupContext = {
    metadata: { namespace: "Capacity" },
    lookupHandler(name) {
        if (name === "Capacity.capacityBuilder.resolveLookup") {
            return () => null;
        }
        throw new Error(`missing ${name}`);
    },
};
assert.deepEqual(
    resolveReportBuilderLookupDescriptor(
        nullLookupContext,
        { hooks: { resolveLookup: "Capacity.capacityBuilder.resolveLookup" } },
        {},
        { id: "include" },
        {
            id: "includeExternalPmpDeals",
            targetingFeatureKey: "external.pmp.deal",
        },
        "row_external",
    ),
    {},
);

const inferredResolveInputContext = {
    metadata: {
        dialogs: [
            {
                id: "targetingTreePicker",
                dataSourceRef: "targeting_tree_lookup",
                properties: {
                    quickFilters: [
                        { field: "Body.treeLookupParam.filter.filter" },
                    ],
                },
            },
        ],
    },
    Context() {
        return {
            handlers: {
                dataSource: {
                    fetchRecords: async () => ({ rows: [] }),
                },
            },
        };
    },
};
assert.deepEqual(
    buildLookupHydrationJobs(
        inferredResolveInputContext,
        {
            dynamicFilterGroups: [
                {
                    id: "include",
                    filters: [
                        {
                            id: "includeSiteType",
                            dialogId: "targetingTreePicker",
                            valueSelector: "value",
                            labelSelector: "label",
                        },
                    ],
                },
            ],
        },
        {
            dynamicGroups: {
                include: [
                    {
                        id: "row_1",
                        filterId: "includeSiteType",
                        selections: [
                            { value: "123", label: "123" },
                        ],
                    },
                ],
            },
        },
        () => ({
            dialogId: "targetingTreePicker",
            parameters: {
                Field: "SITE_TYPE",
            },
        }),
    ).map((job) => ({
        dataSourceRef: job.dataSourceRef,
        filterId: job.filterDef?.id,
        groupId: job.groupId,
        parameters: job.parameters,
        resolveInput: job.resolveInput,
        rowId: job.rowId,
        selectionIndex: job.selectionIndex,
        value: job.value,
    })),
    [
        {
            dataSourceRef: "targeting_tree_lookup",
            filterId: "includeSiteType",
            groupId: "include",
            parameters: {
                Field: "SITE_TYPE",
            },
            resolveInput: "Body.treeLookupParam.filter.filter",
            rowId: "row_1",
            selectionIndex: 0,
            value: "123",
        },
    ],
);

// raw canonical predicate config yields the same hydration jobs as the
// equivalent lowered dynamicFilterGroups declaration
assert.deepEqual(
    buildLookupHydrationJobs(
        inferredResolveInputContext,
        {
            predicates: [
                {
                    id: "siteType",
                    label: "Site Type",
                    dialogId: "targetingTreePicker",
                    valueSelector: "value",
                    labelSelector: "label",
                    include: { filterId: "includeSiteType" },
                },
            ],
        },
        {
            dynamicGroups: {
                include: [
                    {
                        id: "row_1",
                        filterId: "includeSiteType",
                        selections: [
                            { value: "123", label: "123" },
                        ],
                    },
                ],
            },
        },
        () => ({
            dialogId: "targetingTreePicker",
            parameters: {
                Field: "SITE_TYPE",
            },
        }),
    ).map((job) => ({
        dataSourceRef: job.dataSourceRef,
        filterId: job.filterDef?.id,
        groupId: job.groupId,
        resolveInput: job.resolveInput,
        rowId: job.rowId,
        selectionIndex: job.selectionIndex,
        value: job.value,
    })),
    [
        {
            dataSourceRef: "targeting_tree_lookup",
            filterId: "includeSiteType",
            groupId: "include",
            resolveInput: "Body.treeLookupParam.filter.filter",
            rowId: "row_1",
            selectionIndex: 0,
            value: "123",
        },
    ],
);

const singularQuickFilterContext = {
    metadata: {
        dialogs: [
            {
                id: "advertiserPicker",
                dataSourceRef: "advertiser_lookup",
                properties: {
                    quickFilter: {
                        field: "AdvertiserId",
                    },
                },
            },
        ],
    },
    Context() {
        return {
            handlers: {
                dataSource: {
                    fetchRecords: async () => ({ rows: [] }),
                },
            },
        };
    },
};
assert.deepEqual(
    buildLookupHydrationJobs(
        singularQuickFilterContext,
        {
            dynamicFilterGroups: [
                {
                    id: "scope",
                    filters: [
                        {
                            id: "advertiserIds",
                            dialogId: "advertiserPicker",
                            valueSelector: "advertiserId",
                            labelSelector: "advertiserName",
                        },
                    ],
                },
            ],
        },
        {
            dynamicGroups: {
                scope: [
                    {
                        id: "row_scope",
                        filterId: "advertiserIds",
                        selections: [
                            { value: "731", label: "731" },
                        ],
                    },
                ],
            },
        },
        () => ({
            dialogId: "advertiserPicker",
            parameters: {
                Limit: 1,
            },
        }),
    ).map((job) => ({
        dataSourceRef: job.dataSourceRef,
        resolveInput: job.resolveInput,
        parameters: job.parameters,
        value: job.value,
    })),
    [
        {
            dataSourceRef: "advertiser_lookup",
            resolveInput: "AdvertiserId",
            parameters: {
                Limit: 1,
            },
            value: "731",
        },
    ],
);

const hydrationCalls = [];
const hydrationContext = {
    metadata: {
        dialogs: [
            {
                id: "audiencePicker",
                dataSourceRef: "audience_lookup",
                properties: {
                    resolveInput: "AudienceId",
                },
            },
        ],
    },
    Context(dataSourceRef) {
        assert.equal(dataSourceRef, "audience_lookup");
        return {
            handlers: {
                dataSource: {
                    async fetchRecords({ parameters }) {
                        hydrationCalls.push(parameters);
                        return {
                            rows: [
                                {
                                    audienceId: parameters.AudienceId,
                                    audienceName: "Resolved Audience",
                                },
                            ],
                        };
                    },
                },
            },
        };
    },
};
const hydrated = await hydrateReportBuilderLookupLabels(
    hydrationContext,
    {
        dynamicFilterGroups: [
            {
                id: "scope",
                filters: [
                    {
                        id: "audienceIds",
                        dialogId: "audiencePicker",
                        valueSelector: "audienceId",
                        labelSelector: "audienceName",
                    },
                ],
            },
        ],
    },
    {
        dynamicGroups: {
            scope: [
                {
                    id: "row_scope",
                    filterId: "audienceIds",
                    selections: [
                        {
                            value: 12345,
                            label: "12345",
                        },
                    ],
                },
            ],
        },
    },
    () => ({
        dialogId: "audiencePicker",
        dataSourceRef: "audience_lookup",
        resolveInput: "AudienceId",
        parameters: {
            Limit: 1,
        },
    }),
);
assert.deepEqual(hydrationCalls, [
    {
        Limit: 1,
        AudienceId: 12345,
    },
]);
assert.equal(
    hydrated.dynamicGroups.scope[0].selections[0].label,
    "Resolved Audience",
);

const connectorHydrationCalls = [];
const connectorHydrationContext = {
    metadata: {
        dialogs: [
            {
                id: "audiencePicker",
                dataSourceRef: "audience_lookup",
                properties: {
                    resolveInput: "AudienceId",
                },
            },
        ],
    },
    Context(dataSourceRef) {
        assert.equal(dataSourceRef, "audience_lookup");
        return {
            dataSource: {
                selectors: {
                    data: "data",
                },
            },
            connector: {
                async get({ inputParameters }) {
                    connectorHydrationCalls.push(inputParameters);
                    return {
                        data: [
                            {
                                audienceId: inputParameters.AudienceId,
                                audienceName: "Resolved Audience Via Connector",
                            },
                        ],
                    };
                },
            },
            handlers: {
                dataSource: {},
            },
        };
    },
};
const connectorHydrated = await hydrateReportBuilderLookupLabels(
    connectorHydrationContext,
    {
        dynamicFilterGroups: [
            {
                id: "scope",
                filters: [
                    {
                        id: "audienceIds",
                        dialogId: "audiencePicker",
                        valueSelector: "audienceId",
                        labelSelector: "audienceName",
                    },
                ],
            },
        ],
    },
    {
        dynamicGroups: {
            scope: [
                {
                    id: "row_scope_connector",
                    filterId: "audienceIds",
                    selections: [
                        {
                            value: 54321,
                            label: "54321",
                        },
                    ],
                },
            ],
        },
    },
    () => ({
        dialogId: "audiencePicker",
        dataSourceRef: "audience_lookup",
        resolveInput: "AudienceId",
    }),
);
assert.deepEqual(connectorHydrationCalls, [
    {
        AudienceId: 54321,
    },
]);
assert.equal(
    connectorHydrated.dynamicGroups.scope[0].selections[0].label,
    "Resolved Audience Via Connector",
);

const targetingHydrationCalls = [];
const targetingHydrationContext = {
    metadata: {
        dialogs: [
            {
                id: "targetingTreePicker",
                dataSourceRef: "targeting_tree_lookup",
                properties: {
                    resolveInput: "Body.treeLookupParam.filter.filter",
                },
            },
        ],
    },
    Context(dataSourceRef) {
        assert.equal(dataSourceRef, "targeting_tree_lookup");
        return {
            handlers: {
                dataSource: {
                    async fetchRecords({ parameters }) {
                        targetingHydrationCalls.push(parameters);
                        return {
                            rows: [
                                {
                                    value: "fixture-pmp-1",
                                    label: "Resolved Deal fixture-pmp-1",
                                },
                            ],
                        };
                    },
                },
            },
        };
    },
};
const targetingHydrated = await hydrateReportBuilderLookupLabels(
    targetingHydrationContext,
    {
        dynamicFilterGroups: [
            {
                id: "include",
                filters: [
                    {
                        id: "includeDealsPmp",
                        dialogId: "targetingTreePicker",
                        valueSelector: "value",
                        labelSelector: "label",
                    },
                ],
            },
        ],
    },
    {
        dynamicGroups: {
            include: [
                {
                    id: "row_include",
                    filterId: "includeDealsPmp",
                    selections: [
                        {
                            value: "fixture-pmp-1",
                            label: "fixture-pmp-1",
                        },
                    ],
                },
            ],
        },
    },
    () => ({
        dialogId: "targetingTreePicker",
        parameters: {
            Field: "PMP_DEAL",
            Body: {
                treeModelParam: {
                    capacity: true,
                },
            },
        },
    }),
);
assert.deepEqual(targetingHydrationCalls, [
    {
        Field: "PMP_DEAL",
        Body: {
            treeModelParam: {
                capacity: true,
            },
        },
        "Body.treeLookupParam.filter.filter": "fixture-pmp-1",
    },
]);
assert.equal(
    targetingHydrated.dynamicGroups.include[0].selections[0].label,
    "Resolved Deal fixture-pmp-1",
);

console.log("ReportBuilder hooks ✓");
