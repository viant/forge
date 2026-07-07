import assert from "node:assert/strict";

import {
    applyReportBuilderPredicatePrefill,
    hasReportBuilderPredicates,
    listReportBuilderPinnedPredicates,
    lowerReportBuilderPredicates,
    normalizeReportBuilderPredicateBuckets,
    normalizeReportBuilderPredicateGroups,
    normalizeReportBuilderPredicates,
    resolveReportBuilderDynamicFilterFamilies,
    resolveReportBuilderDynamicFilterGroups,
    resolveReportBuilderScopeParamFilters,
} from "./reportBuilderPredicates.js";
import { applyReportBuilderStateHook } from "./reportBuilderHooks.js";
import {
    buildReportBuilderDefaultState,
    buildReportBuilderRequest,
    mergeReportBuilderState,
    resolveReportBuilderReadiness,
} from "./reportBuilderUtils.js";

const unifiedConfig = {
    measures: [
        { id: "impressions", key: "impressions", paramPath: "measures.impressions", default: true },
    ],
    dimensions: [],
    predicateGroups: [
        { id: "inventory", label: "Inventory", icon: "box" },
        { id: "location", label: "Location", icon: "map-marker" },
    ],
    predicates: [
        {
            id: "channels",
            label: "Channels",
            pinned: true,
            multiple: true,
            presentation: "compactIconRow",
            semanticRef: "delivery_channels_filter",
            paramPath: "filters.includeChannelV2",
            options: [
                { value: 1, label: "Display", default: true },
                { value: 2, label: "CTV" },
            ],
            prefill: { path: "includeChannelV2" },
        },
        {
            id: "dateRange",
            label: "Date Range",
            kind: "dateRange",
            required: true,
            default: { start: "2026-06-01", end: "2026-06-03" },
            startParamPath: "filters.from",
            endParamPath: "filters.to",
            prefill: { start: ["scope.from", "from"], end: ["scope.to", "to"] },
        },
        {
            id: "publisher",
            label: "Publisher",
            group: "inventory",
            dialogId: "publisherPicker",
            manualEntry: true,
            manualValueType: "int",
            valueSelector: "publisherId",
            labelSelector: "publisherName",
            recordSelectors: ["publisherId", "publisherName"],
            include: { filterId: "includePublisherId", paramPath: "filters.includePublisherId" },
            exclude: { filterId: "excludePublisherId", paramPath: "filters.excludePublisherId" },
            prefill: { include: ["scope.includePublisherId", "includePublisherId"], exclude: "excludePublisherId" },
        },
        {
            id: "siteType",
            label: "Site Type",
            group: "inventory",
            targetingFeatureKey: "ad.site.type",
            lookup: { dataSource: "targeting_tree_lookup", resolveInput: "Body.treeLookupParam.filter.filter" },
            include: true,
            exclude: true,
            prefill: { include: "includeSiteType" },
        },
        {
            id: "country",
            label: "Country",
            group: "location",
            targetingFeatureKey: "location",
            include: true,
        },
        {
            id: "audienceIds",
            label: "Audience",
            dialogId: "audiencePicker",
            semanticRef: "audience",
            manualValueType: "int",
            valueSelector: "audienceId",
            labelSelector: "audienceName",
            paramPath: "filters.audienceIds",
            prefill: ["scope.audienceIds", "audienceIds"],
        },
    ],
};

// --- normalization -----------------------------------------------------------

{
    const predicates = normalizeReportBuilderPredicates(unifiedConfig);
    assert.equal(predicates.length, 6);
    assert.equal(hasReportBuilderPredicates(unifiedConfig), true);
    assert.equal(hasReportBuilderPredicates({}), false);

    const publisher = predicates.find((entry) => entry.id === "publisher");
    assert.equal(publisher.pinned, false);
    assert.deepEqual(publisher.directions.map((entry) => entry.direction), ["include", "exclude"]);
    assert.equal(publisher.directions[0].filter.id, "includePublisherId");
    assert.equal(publisher.directions[0].filter.paramPath, "filters.includePublisherId");
    assert.equal(publisher.directions[0].filter.manualValueType, "int");
    assert.equal(publisher.directions[0].filter.multiple, true);
    assert.equal(publisher.directions[0].filter.emitArray, true);
    assert.deepEqual(publisher.directions[0].prefillPaths, ["scope.includePublisherId", "includePublisherId"]);
    assert.deepEqual(publisher.directions[1].prefillPaths, ["excludePublisherId"]);

    const siteType = predicates.find((entry) => entry.id === "siteType");
    assert.equal(siteType.directions[0].filter.id, "includeSiteType");
    assert.equal(siteType.directions[0].filter.paramPath, "filters.includeSiteType");
    assert.equal(siteType.directions[1].filter.id, "excludeSiteType");
    assert.equal(siteType.directions[0].filter.targetingFeatureKey, "ad.site.type");
    assert.deepEqual(siteType.directions[0].filter.lookup, {
        dataSource: "targeting_tree_lookup",
        resolveInput: "Body.treeLookupParam.filter.filter",
    });
    assert.deepEqual(siteType.directions[0].prefillPaths, ["includeSiteType"]);
    assert.deepEqual(siteType.directions[1].prefillPaths, []);

    const audience = predicates.find((entry) => entry.id === "audienceIds");
    assert.equal(audience.directions.length, 1);
    assert.equal(audience.directions[0].direction, "");
    assert.equal(audience.directions[0].groupId, "scope");
    assert.equal(audience.directions[0].filter.paramPath, "filters.audienceIds");
    assert.deepEqual(audience.directions[0].prefillPaths, ["scope.audienceIds", "audienceIds"]);

    const groups = normalizeReportBuilderPredicateGroups(unifiedConfig);
    assert.deepEqual(groups.map((entry) => entry.id), ["inventory", "location"]);
    assert.equal(groups[0].icon, "box");
}

// --- lowering ----------------------------------------------------------------

{
    const untouched = { measures: [], staticFilters: [{ id: "x" }] };
    assert.equal(lowerReportBuilderPredicates(untouched), untouched);
}

const lowered = lowerReportBuilderPredicates(unifiedConfig);

{
    assert.deepEqual(lowered.staticFilters.map((entry) => entry.id), ["channels", "dateRange"]);
    const channels = lowered.staticFilters[0];
    assert.equal(channels.paramPath, "filters.includeChannelV2");
    assert.equal(channels.multiple, true);
    assert.equal(channels.presentation, "compactIconRow");
    assert.equal(channels.semanticRef, "delivery_channels_filter");
    assert.equal(channels.options.length, 2);
    const dateRange = lowered.staticFilters[1];
    assert.equal(dateRange.type, "dateRange");
    assert.equal(dateRange.required, true);
    assert.equal(dateRange.startParamPath, "filters.from");
    assert.equal(dateRange.endParamPath, "filters.to");

    const groupIds = lowered.dynamicFilterGroups.map((entry) => entry.id);
    assert.deepEqual(groupIds, ["include", "exclude", "scope"]);
    const includeGroup = lowered.dynamicFilterGroups.find((entry) => entry.id === "include");
    assert.deepEqual(
        includeGroup.filters.map((entry) => entry.id),
        ["includePublisherId", "includeSiteType", "includeCountry"],
    );
    const excludeGroup = lowered.dynamicFilterGroups.find((entry) => entry.id === "exclude");
    assert.deepEqual(excludeGroup.filters.map((entry) => entry.id), ["excludePublisherId", "excludeSiteType"]);
    const scopeGroup = lowered.dynamicFilterGroups.find((entry) => entry.id === "scope");
    assert.deepEqual(scopeGroup.filters.map((entry) => entry.id), ["audienceIds"]);
    assert.equal(scopeGroup.filters[0].semanticRef, "audience");

    const families = lowered.dynamicFilterFamilies;
    assert.deepEqual(families.map((entry) => entry.id), ["inventory", "location"]);
    assert.deepEqual(families[0].includeFilterIds, ["includePublisherId", "includeSiteType"]);
    assert.deepEqual(families[0].excludeFilterIds, ["excludePublisherId", "excludeSiteType"]);
    assert.equal(families[0].icon, "box");
    assert.deepEqual(families[1].includeFilterIds, ["includeCountry"]);
    assert.deepEqual(families[1].excludeFilterIds, []);

    // lowering is idempotent
    const relowered = lowerReportBuilderPredicates(lowered);
    assert.deepEqual(relowered.staticFilters, lowered.staticFilters);
    assert.deepEqual(relowered.dynamicFilterGroups, lowered.dynamicFilterGroups);
    assert.deepEqual(relowered.dynamicFilterFamilies, lowered.dynamicFilterFamilies);
}

{
    // explicit legacy declarations win over generated ones and are preserved
    const mixed = lowerReportBuilderPredicates({
        ...unifiedConfig,
        staticFilters: [{ id: "channels", label: "Legacy Channels", paramPath: "filters.legacyChannels" }],
        dynamicFilterGroups: [
            {
                id: "include",
                label: "Include Targeting",
                filters: [{ id: "includePublisherId", label: "Legacy Publisher", paramPath: "filters.legacyPublisher" }],
            },
        ],
        dynamicFilterFamilies: [{ id: "inventory", label: "Legacy Inventory", includeFilterIds: ["includePublisherId"] }],
    });
    const channels = mixed.staticFilters.find((entry) => entry.id === "channels");
    assert.equal(channels.label, "Legacy Channels");
    const includeGroup = mixed.dynamicFilterGroups.find((entry) => entry.id === "include");
    assert.equal(includeGroup.label, "Include Targeting");
    const publisherFilter = includeGroup.filters.find((entry) => entry.id === "includePublisherId");
    assert.equal(publisherFilter.label, "Legacy Publisher");
    assert.deepEqual(includeGroup.filters.map((entry) => entry.id), ["includePublisherId", "includeSiteType", "includeCountry"]);
    const inventoryFamily = mixed.dynamicFilterFamilies.find((entry) => entry.id === "inventory");
    assert.equal(inventoryFamily.label, "Legacy Inventory");
    assert.equal(mixed.dynamicFilterFamilies.length, 2);
}

// --- predicate buckets ----------------------------------------------------------

{
    const buckets = normalizeReportBuilderPredicateBuckets({
        predicateBuckets: [
            { id: "scope", label: "Scope", description: "Add one scope line at a time." },
            { id: "inventory", description: "Flat inventory filters." },
            { label: "no id -> dropped" },
        ],
    });
    assert.deepEqual(buckets, [
        { id: "scope", label: "Scope", description: "Add one scope line at a time.", order: 0 },
        { id: "inventory", label: "inventory", description: "Flat inventory filters.", order: 1 },
    ]);
    assert.deepEqual(normalizeReportBuilderPredicateBuckets({}), []);

    // declared buckets replace hand-written dynamicFilterGroups shells: they seed
    // groups up-front (declaration order) with label/description metadata.
    const bucketed = lowerReportBuilderPredicates({
        predicateBuckets: [
            { id: "targeting", label: "Targeting", description: "Tree-backed targeting filters." },
            { id: "scope", label: "Scope", description: "Add one scope line at a time." },
        ],
        predicates: [
            { id: "audienceIds", label: "Audience", bucket: "scope", paramPath: "filters.audienceIds" },
            { id: "irisSegmentIds", label: "IRIS Segment", bucket: "targeting", paramPath: "filters.targetingIncl" },
            { id: "dealIds", label: "Deal", bucket: "inventory", paramPath: "filters.dealIds" },
        ],
    });
    assert.deepEqual(bucketed.dynamicFilterGroups.map((entry) => entry.id), ["targeting", "scope", "inventory"]);
    const scopeBucket = bucketed.dynamicFilterGroups.find((entry) => entry.id === "scope");
    assert.equal(scopeBucket.label, "Scope");
    assert.equal(scopeBucket.description, "Add one scope line at a time.");
    assert.deepEqual(scopeBucket.filters.map((entry) => entry.id), ["audienceIds"]);
    // undeclared buckets still fall back to a pascal-cased seed
    const inventoryBucket = bucketed.dynamicFilterGroups.find((entry) => entry.id === "inventory");
    assert.equal(inventoryBucket.label, "Inventory");
    assert.equal(inventoryBucket.description, undefined);

    // a declared bucket with no predicates still appears, like a legacy shell did
    const unused = lowerReportBuilderPredicates({
        predicateBuckets: [{ id: "spare", label: "Spare", description: "Reserved." }],
        predicates: [{ id: "audienceIds", label: "Audience", bucket: "scope", paramPath: "filters.audienceIds" }],
    });
    assert.deepEqual(unused.dynamicFilterGroups.map((entry) => entry.id), ["spare", "scope"]);
    assert.deepEqual(unused.dynamicFilterGroups[0].filters, []);

    // hand-written dynamicFilterGroups still win over declared bucket metadata
    const shellWins = lowerReportBuilderPredicates({
        dynamicFilterGroups: [{ id: "scope", label: "Legacy Scope", description: "Legacy shell." }],
        predicateBuckets: [{ id: "scope", label: "Scope", description: "Bucket metadata." }],
        predicates: [{ id: "audienceIds", label: "Audience", bucket: "scope", paramPath: "filters.audienceIds" }],
    });
    const shellScope = shellWins.dynamicFilterGroups.find((entry) => entry.id === "scope");
    assert.equal(shellScope.label, "Legacy Scope");
    assert.equal(shellScope.description, "Legacy shell.");
}

// --- pinned predicate listing -----------------------------------------------------

{
    assert.deepEqual(
        listReportBuilderPinnedPredicates(unifiedConfig).map((entry) => entry.id),
        ["channels", "dateRange"],
    );
    assert.deepEqual(listReportBuilderPinnedPredicates({}), []);
}

// --- scope param filters (predicate-native pinned params) ----------------------

{
    // legacy non-predicate configs fall back to staticFilters unchanged
    assert.deepEqual(
        resolveReportBuilderScopeParamFilters({
            staticFilters: [{ id: "dateRange", label: "Date Range", type: "dateRange" }],
        }),
        [{ id: "dateRange", label: "Date Range", type: "dateRange" }],
    );
    assert.deepEqual(resolveReportBuilderScopeParamFilters({}), []);

    // predicate configs derive pinned scope params without lowering
    const native = resolveReportBuilderScopeParamFilters(unifiedConfig);
    assert.deepEqual(native.map((entry) => entry.id), ["channels", "dateRange"]);
    assert.equal(native[0].paramPath, "filters.includeChannelV2");
    assert.equal(native[0].semanticRef, "delivery_channels_filter");
    assert.equal(native[1].type, "dateRange");
    assert.equal(native[1].required, true);

    // residual unmatched staticFilters survive alongside pinned predicates
    const residual = resolveReportBuilderScopeParamFilters({
        ...unifiedConfig,
        staticFilters: [{ id: "legacyOnly", label: "Legacy Only" }],
    });
    assert.deepEqual(residual.map((entry) => entry.id), ["legacyOnly", "channels", "dateRange"]);

    // a matching staticFilters entry enriches the predicate-native base
    // (e.g. semantic overlay metadata applied after lowering)
    const enriched = resolveReportBuilderScopeParamFilters({
        ...unifiedConfig,
        staticFilters: [
            {
                id: "channels",
                label: "Delivery Channels",
                description: "Approved channel scope",
                paramPath: "filters.includeChannelV2",
                semanticRef: "delivery_channels_filter",
            },
        ],
    });
    assert.deepEqual(enriched.map((entry) => entry.id), ["channels", "dateRange"]);
    assert.equal(enriched[0].label, "Delivery Channels");
    assert.equal(enriched[0].description, "Approved channel scope");
    // predicate-native fields not present on the enrichment entry are kept
    assert.equal(enriched[0].multiple, true);
    assert.equal(enriched[0].presentation, "compactIconRow");

    // already-lowered configs resolve to the lowered staticFilters (identity)
    assert.deepEqual(resolveReportBuilderScopeParamFilters(lowered), lowered.staticFilters);
}

// --- canonical dynamic group/family resolvers -----------------------------------

{
    // raw canonical configs resolve without lowering
    assert.deepEqual(resolveReportBuilderDynamicFilterGroups(unifiedConfig), lowered.dynamicFilterGroups);
    assert.deepEqual(resolveReportBuilderDynamicFilterFamilies(unifiedConfig), lowered.dynamicFilterFamilies);

    // already-lowered configs resolve to their lowered structures (identity)
    assert.deepEqual(resolveReportBuilderDynamicFilterGroups(lowered), lowered.dynamicFilterGroups);
    assert.deepEqual(resolveReportBuilderDynamicFilterFamilies(lowered), lowered.dynamicFilterFamilies);

    // legacy non-predicate configs pass through their hand-written structures
    const legacy = {
        dynamicFilterGroups: [{ id: "include", label: "Include", filters: [{ id: "legacyId" }] }],
        dynamicFilterFamilies: [{ id: "inventory", includeFilterIds: ["legacyId"] }],
    };
    assert.deepEqual(resolveReportBuilderDynamicFilterGroups(legacy), legacy.dynamicFilterGroups);
    assert.deepEqual(resolveReportBuilderDynamicFilterFamilies(legacy), legacy.dynamicFilterFamilies);
    assert.deepEqual(resolveReportBuilderDynamicFilterGroups({}), []);
    assert.deepEqual(resolveReportBuilderDynamicFilterFamilies({}), []);

    // predicate configs with legacy overlays resolve to the same structures
    // lowering produces (overlays win, predicates fill in the rest)
    const overlayConfig = {
        ...unifiedConfig,
        dynamicFilterGroups: [
            {
                id: "include",
                label: "Include Targeting",
                filters: [{ id: "includePublisherId", label: "Legacy Publisher", paramPath: "filters.legacyPublisher" }],
            },
        ],
        dynamicFilterFamilies: [{ id: "inventory", label: "Legacy Inventory", includeFilterIds: ["includePublisherId"] }],
    };
    const overlayLowered = lowerReportBuilderPredicates(overlayConfig);
    assert.deepEqual(resolveReportBuilderDynamicFilterGroups(overlayConfig), overlayLowered.dynamicFilterGroups);
    assert.deepEqual(resolveReportBuilderDynamicFilterFamilies(overlayConfig), overlayLowered.dynamicFilterFamilies);
}

// --- default state and readiness ----------------------------------------------

const defaultState = buildReportBuilderDefaultState(lowered);

{
    assert.deepEqual(defaultState.scopeParams.channels, [1]);
    assert.deepEqual(defaultState.scopeParams.dateRange, { start: "2026-06-01", end: "2026-06-03" });
    assert.deepEqual(defaultState.dynamicGroups, { include: [], exclude: [], scope: [] });
    assert.equal(resolveReportBuilderReadiness(lowered, defaultState).canRun, true);

    const emptyDateState = {
        ...defaultState,
        scopeParams: { ...defaultState.scopeParams, dateRange: { start: "", end: "" } },
    };
    assert.deepEqual(resolveReportBuilderReadiness(lowered, emptyDateState), { canRun: false, reason: "requiredFilter" });
}

// --- prefill -------------------------------------------------------------------

const prefillWindowForm = {
    prefill: {
        includeChannelV2: [1, 2],
        from: "2026-06-10",
        to: "2026-06-20",
        includePublisherId: [
            { publisherId: 11, publisherName: "Pub Eleven" },
            22,
        ],
        excludePublisherId: ["33"],
        includeSiteType: ["mobile_web"],
        scope: { audienceIds: [501] },
    },
};

const prefilled = applyReportBuilderPredicatePrefill(lowered, defaultState, prefillWindowForm);

{
    assert.notEqual(prefilled, defaultState);
    assert.deepEqual(prefilled.scopeParams.channels, [1, 2]);
    assert.deepEqual(prefilled.scopeParams.dateRange, { start: "2026-06-10", end: "2026-06-20" });

    const includeRows = prefilled.dynamicGroups.include;
    assert.equal(includeRows.length, 2);
    const publisherRow = includeRows.find((row) => row.filterId === "includePublisherId");
    assert.equal(publisherRow.id, "prefill_includePublisherId");
    assert.equal(publisherRow.enabled, true);
    assert.deepEqual(
        publisherRow.selections.map((entry) => ({ value: entry.value, label: entry.label })),
        [
            { value: 11, label: "Pub Eleven" },
            { value: 22, label: "22" },
        ],
    );
    assert.equal(publisherRow.selections[0].record.publisherId, 11);
    assert.equal(publisherRow.selections[0].record.publisherName, "Pub Eleven");

    const siteTypeRow = includeRows.find((row) => row.filterId === "includeSiteType");
    assert.deepEqual(siteTypeRow.selections.map((entry) => entry.value), ["mobile_web"]);

    const excludeRows = prefilled.dynamicGroups.exclude;
    assert.deepEqual(excludeRows.map((row) => row.filterId), ["excludePublisherId"]);
    assert.deepEqual(excludeRows[0].selections.map((entry) => entry.value), [33]);

    const scopeRows = prefilled.dynamicGroups.scope;
    assert.deepEqual(scopeRows.map((row) => row.filterId), ["audienceIds"]);
    assert.deepEqual(scopeRows[0].selections.map((entry) => entry.value), [501]);
}

{
    // no prefill payload -> same state reference
    assert.equal(applyReportBuilderPredicatePrefill(lowered, defaultState, {}), defaultState);
    assert.equal(applyReportBuilderPredicatePrefill(lowered, defaultState, { prefill: null }), defaultState);
    // config without predicates -> same state reference
    assert.equal(applyReportBuilderPredicatePrefill({ staticFilters: [] }, defaultState, prefillWindowForm), defaultState);
}

{
    // prefill replaces prior rows for the same filter, keeps unrelated rows
    const seededState = {
        ...defaultState,
        dynamicGroups: {
            ...defaultState.dynamicGroups,
            include: [
                { id: "manual_1", filterId: "includePublisherId", enabled: true, selections: [{ value: 99, label: "Stale" }] },
                { id: "manual_2", filterId: "includeCountry", enabled: true, selections: [{ value: "US", label: "US" }] },
            ],
        },
    };
    const replaced = applyReportBuilderPredicatePrefill(lowered, seededState, prefillWindowForm);
    const includeRows = replaced.dynamicGroups.include;
    const publisherRows = includeRows.filter((row) => row.filterId === "includePublisherId");
    assert.equal(publisherRows.length, 1);
    assert.deepEqual(publisherRows[0].selections.map((entry) => entry.value), [11, 22]);
    const countryRow = includeRows.find((row) => row.filterId === "includeCountry");
    assert.deepEqual(countryRow.selections.map((entry) => entry.value), ["US"]);
}

// --- prefill fallback paths ------------------------------------------------------

{
    // nested scope.* payload resolves through the first fallback path
    const nested = applyReportBuilderPredicatePrefill(lowered, defaultState, {
        prefill: {
            scope: {
                from: "2026-06-11",
                to: "2026-06-21",
                includePublisherId: [{ publisherId: 44, publisherName: "Nested Pub" }],
                audienceIds: [601],
            },
        },
    });
    assert.deepEqual(nested.scopeParams.dateRange, { start: "2026-06-11", end: "2026-06-21" });
    const nestedPublisher = nested.dynamicGroups.include.find((row) => row.filterId === "includePublisherId");
    assert.deepEqual(
        nestedPublisher.selections.map((entry) => ({ value: entry.value, label: entry.label })),
        [{ value: 44, label: "Nested Pub" }],
    );
    assert.deepEqual(nested.dynamicGroups.scope[0].selections.map((entry) => entry.value), [601]);

    // top-level payload resolves through the trailing fallback path
    const flat = applyReportBuilderPredicatePrefill(lowered, defaultState, {
        prefill: {
            from: "2026-06-12",
            to: "2026-06-22",
            includePublisherId: [55],
            audienceIds: [602],
        },
    });
    assert.deepEqual(flat.scopeParams.dateRange, { start: "2026-06-12", end: "2026-06-22" });
    const flatPublisher = flat.dynamicGroups.include.find((row) => row.filterId === "includePublisherId");
    assert.deepEqual(flatPublisher.selections.map((entry) => entry.value), [55]);
    assert.deepEqual(flat.dynamicGroups.scope[0].selections.map((entry) => entry.value), [602]);

    // when both shapes are present, declaration order wins (nested first)
    const both = applyReportBuilderPredicatePrefill(lowered, defaultState, {
        prefill: {
            scope: { audienceIds: [601] },
            audienceIds: [602],
        },
    });
    assert.deepEqual(both.dynamicGroups.scope[0].selections.map((entry) => entry.value), [601]);

    // an empty list at the first path falls through to the next fallback
    const emptyFirst = applyReportBuilderPredicatePrefill(lowered, defaultState, {
        prefill: {
            scope: { audienceIds: [] },
            audienceIds: [603],
        },
    });
    assert.deepEqual(emptyFirst.dynamicGroups.scope[0].selections.map((entry) => entry.value), [603]);
}

// --- request shaping (end to end) ----------------------------------------------

{
    const state = mergeReportBuilderState(lowered, prefilled);
    const request = buildReportBuilderRequest(lowered, state);
    assert.deepEqual(request.filters.includeChannelV2, [1, 2]);
    assert.equal(request.filters.from, "2026-06-10");
    assert.equal(request.filters.to, "2026-06-20");
    assert.deepEqual(request.filters.includePublisherId, [11, 22]);
    assert.deepEqual(request.filters.excludePublisherId, [33]);
    assert.deepEqual(request.filters.includeSiteType, ["mobile_web"]);
    assert.deepEqual(request.filters.audienceIds, [501]);
}

// --- raw canonical config parity (state/request helpers, no pre-lowering) --------

{
    const rawDefault = buildReportBuilderDefaultState(unifiedConfig);
    assert.deepEqual(rawDefault, defaultState);
    assert.deepEqual(resolveReportBuilderReadiness(unifiedConfig, rawDefault), resolveReportBuilderReadiness(lowered, defaultState));

    const rawPrefilled = applyReportBuilderPredicatePrefill(unifiedConfig, rawDefault, prefillWindowForm);
    assert.deepEqual(rawPrefilled, prefilled);

    const rawState = mergeReportBuilderState(unifiedConfig, rawPrefilled);
    assert.deepEqual(rawState, mergeReportBuilderState(lowered, prefilled));
    assert.deepEqual(buildReportBuilderRequest(unifiedConfig, rawState), buildReportBuilderRequest(lowered, rawState));

    // required pinned predicate gates readiness straight from the raw config
    const emptyDateState = {
        ...rawDefault,
        scopeParams: { ...rawDefault.scopeParams, dateRange: { start: "", end: "" } },
    };
    assert.deepEqual(resolveReportBuilderReadiness(unifiedConfig, emptyDateState), { canRun: false, reason: "requiredFilter" });
}

// --- state hook integration -----------------------------------------------------

{
    // without a custom hook, declarative prefill still applies
    const next = applyReportBuilderStateHook(null, lowered, defaultState, prefillWindowForm);
    assert.deepEqual(next.scopeParams.channels, [1, 2]);
    assert.deepEqual(next.dynamicGroups.scope.map((row) => row.filterId), ["audienceIds"]);

    // a custom hook receives the prefilled state and can refine it further
    const seenStates = [];
    const builderContext = {
        lookupHandler: () => ({ state: hookState }) => {
            seenStates.push(hookState);
            return { ...hookState, hookApplied: true };
        },
    };
    const hooked = applyReportBuilderStateHook(
        builderContext,
        { ...lowered, hooks: { initializeState: "custom.init" } },
        defaultState,
        prefillWindowForm,
    );
    assert.equal(hooked.hookApplied, true);
    assert.deepEqual(seenStates[0].scopeParams.channels, [1, 2]);

    // untouched when neither prefill nor hook contribute
    assert.equal(applyReportBuilderStateHook(null, lowered, defaultState, {}), defaultState);
}

console.log("reportBuilderPredicates.test.js OK");
