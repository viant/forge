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
        if (name === "Performance Metrics.stewardReportBuilder.buildRequest") {
            return namespacedHandler;
        }
        throw new Error(`missing ${name}`);
    },
};
assert.equal(
    resolveReportBuilderHookHandler(namespacedContext, "stewardReportBuilder.buildRequest"),
    namespacedHandler,
);
assert.deepEqual(namespacedCalls, [
    "stewardReportBuilder.buildRequest",
    "Performance Metrics.stewardReportBuilder.buildRequest",
]);

const directHandler = () => "ok";
const directContext = {
    metadata: { namespace: "Performance Metrics" },
    lookupHandler(name) {
        if (name === "stewardReportBuilder.buildRequest") {
            return directHandler;
        }
        throw new Error(`missing ${name}`);
    },
};
assert.equal(
    resolveReportBuilderHookHandler(directContext, "stewardReportBuilder.buildRequest"),
    directHandler,
);

const stateHookContext = {
    metadata: { namespace: "Performance Metrics" },
    lookupHandler(name) {
        if (name === "Performance Metrics.stewardReportBuilder.initializeState") {
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
        { hooks: { initializeState: "Performance Metrics.stewardReportBuilder.initializeState" } },
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
        if (name === "Performance Metrics.stewardReportBuilder.initializeState") {
            return () => ["invalid"];
        }
        throw new Error(`missing ${name}`);
    },
};
assert.deepEqual(
    applyReportBuilderStateHook(
        invalidStateHookContext,
        { hooks: { initializeState: "Performance Metrics.stewardReportBuilder.initializeState" } },
        { page: 2 },
        {},
    ),
    { page: 2 },
);

const requestHookContext = {
    metadata: { namespace: "Performance Metrics" },
    lookupHandler(name) {
        if (name === "Performance Metrics.stewardReportBuilder.buildRequest") {
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
        { hooks: { buildRequest: "Performance Metrics.stewardReportBuilder.buildRequest" } },
        {},
        { filters: { channelIds: [1, 2] } },
    ),
    {
        filters: {
            channelIds: [1, 2],
            channel_ids: [1, 2],
            channel_id: [1, 2],
        },
    },
);
const invalidRequestHookContext = {
    metadata: { namespace: "Performance Metrics" },
    lookupHandler(name) {
        if (name === "Performance Metrics.stewardReportBuilder.buildRequest") {
            return () => ["invalid"];
        }
        throw new Error(`missing ${name}`);
    },
};
assert.deepEqual(
    applyReportBuilderRequestHook(
        invalidRequestHookContext,
        { hooks: { buildRequest: "Performance Metrics.stewardReportBuilder.buildRequest" } },
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
                    id: "unsupportedForecastFeatures",
                    level: "warning",
                    title: "Unsupported forecast features were skipped",
                    sourcePath: "forecastHandoffMeta.unsupportedFeatureKeys",
                },
            ],
        },
        {
            forecastHandoffMeta: {
                unsupportedFeatureKeys: ["peer39.social.context"],
            },
        },
    ),
    [
        {
            id: "unsupportedForecastFeatures",
            level: "warning",
            title: "Unsupported forecast features were skipped",
            description: "",
            items: ["peer39.social.context"],
        },
    ],
);

const lookupContext = {
    metadata: { namespace: "Forecasting" },
    lookupHandler(name) {
        if (name === "Forecasting.stewardForecastingBuilder.resolveLookup") {
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
        { hooks: { resolveLookup: "Forecasting.stewardForecastingBuilder.resolveLookup" } },
        { staticFilters: { channelIds: [1] } },
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
    metadata: { namespace: "Forecasting" },
    lookupHandler(name) {
        if (name === "Forecasting.stewardForecastingBuilder.resolveLookup") {
            return () => null;
        }
        throw new Error(`missing ${name}`);
    },
};
assert.deepEqual(
    resolveReportBuilderLookupDescriptor(
        nullLookupContext,
        { hooks: { resolveLookup: "Forecasting.stewardForecastingBuilder.resolveLookup" } },
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
                            value: 7288336,
                            label: "7288336",
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
        AudienceId: 7288336,
    },
]);
assert.equal(
    hydrated.dynamicGroups.scope[0].selections[0].label,
    "Resolved Audience",
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
                                    value: "90473",
                                    label: "Resolved Deal 90473",
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
                            value: "90473",
                            label: "90473",
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
                    forecasting: true,
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
                forecasting: true,
            },
        },
        "Body.treeLookupParam.filter.filter": "90473",
    },
]);
assert.equal(
    targetingHydrated.dynamicGroups.include[0].selections[0].label,
    "Resolved Deal 90473",
);

console.log("ReportBuilder hooks ✓");
