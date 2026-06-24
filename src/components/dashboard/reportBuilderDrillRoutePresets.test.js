import assert from "node:assert/strict";

import {
    buildReportBuilderDetailTargetRouteSuggestions,
    mergeReportBuilderDetailTargets,
    resolveReportBuilderDetailTargetRoutePreset,
    resolveReportBuilderProviderDetailTargetPresets,
} from "./reportBuilderDrillRoutePresets.js";

assert.deepEqual(buildReportBuilderDetailTargetRouteSuggestions({
    field: {
        id: "channelV2",
        key: "channelV2",
        label: "Channel",
    },
    detailTargets: [
        {
            targetRef: "target://example/performance/market-detail",
            navigationMode: "hostRoute",
            title: "Market detail",
        },
    ],
}), [
    {
        targetRef: "target://example/performance/channel-detail",
        label: "Suggested Channel detail",
        description: "Uses target://example/performance/ as the detail-target namespace.",
    },
    {
        targetRef: "target://example/performance/market-detail",
        label: "Market detail",
        description: "hostRoute",
    },
]);

assert.deepEqual(buildReportBuilderDetailTargetRouteSuggestions({
    field: {
        id: "siteType",
        key: "siteType",
        label: "Site Type",
    },
    detailTargets: [],
    fallbackPrefix: "target://custom/runtime",
}), [
    {
        targetRef: "target://custom/runtime/site-type-detail",
        label: "Suggested Site Type detail",
        description: "Uses target://custom/runtime/ as the detail-target namespace.",
    },
]);

assert.deepEqual(buildReportBuilderDetailTargetRouteSuggestions({
    field: {
        id: "country_code",
        key: "country_code",
        label: "!!!",
    },
    detailTargets: [],
}), [
    {
        targetRef: "target://example/performance/country-code-detail",
        label: "Suggested !!! detail",
        description: "Uses target://example/performance/ as the detail-target namespace.",
    },
]);

assert.deepEqual(resolveReportBuilderDetailTargetRoutePreset([
    {
        targetRef: "target://example/performance/market-detail",
        navigationMode: "modal",
        title: "Market detail",
        description: "Open the selected market detail route.",
        parameters: {
            market: "$value",
            scope: "$row.scopeFilter",
        },
    },
], "target://example/performance/market-detail"), {
    targetRef: "target://example/performance/market-detail",
    navigationMode: "modal",
    title: "Market detail",
    description: "Open the selected market detail route.",
    parameters: {
        market: "$value",
        scope: "$row.scopeFilter",
    },
});
assert.equal(resolveReportBuilderDetailTargetRoutePreset([], "target://example/performance/market-detail"), null);

assert.deepEqual(mergeReportBuilderDetailTargets([
    {
        targetRef: "target://example/performance/market-detail",
        navigationMode: "modal",
        title: "Authored market detail",
        parameters: {
            market: "$value",
        },
    },
], [
    {
        targetRef: "target://example/performance/market-detail",
        navigationMode: "hostRoute",
        title: "Provider market detail",
        parameters: {
            market: "$row.market",
        },
    },
    {
        targetRef: "target://example/performance/channel-detail",
        navigationMode: "modal",
        title: "Provider channel detail",
        parameters: {
            channel: "$value",
        },
    },
]), [
    {
        targetRef: "target://example/performance/market-detail",
        navigationMode: "modal",
        title: "Authored market detail",
        parameters: {
            market: "$value",
        },
    },
    {
        targetRef: "target://example/performance/channel-detail",
        navigationMode: "modal",
        title: "Provider channel detail",
        parameters: {
            channel: "$value",
        },
    },
]);

const providerPresets = await resolveReportBuilderProviderDetailTargetPresets({
    detailProvider: {
        async listAvailableRefinements(blockKind, fieldRef) {
            assert.equal(blockKind, "tableBlock");
            assert.equal(fieldRef, "channelV2");
            return {
                actions: [
                    { id: "keep:channelV2", label: "Keep only", kind: "keep" },
                    { id: "detail:channelV2:channel", label: "Show Channel details", kind: "detail", targetRef: "target://example/performance/channel-detail" },
                    { id: "detail:channelV2:channel", label: "Show Channel details", kind: "detail", targetRef: "target://example/performance/channel-detail" },
                ],
            };
        },
        async getDetailTarget(targetRef, options) {
            assert.equal(targetRef, "target://example/performance/channel-detail");
            assert.equal(options.blockKind, "tableBlock");
            assert.equal(options.fieldRef, "channelV2");
            return {
                detailTarget: {
                    targetRef,
                    navigationMode: "modal",
                    description: "Open the selected channel detail route.",
                    parameters: {
                        channel: "$value",
                    },
                },
            };
        },
    },
    fieldRef: "channelV2",
});

assert.deepEqual(providerPresets, [
    {
        targetRef: "target://example/performance/channel-detail",
        navigationMode: "modal",
        title: "Show Channel details",
        description: "Open the selected channel detail route.",
        parameters: {
            channel: "$value",
        },
    },
]);

assert.deepEqual(await resolveReportBuilderProviderDetailTargetPresets({
    detailProvider: null,
    fieldRef: "channelV2",
}), []);

console.log("reportBuilderDrillRoutePresets ✓ suggests safe detail-target routes from authored and provider-backed detail metadata");
