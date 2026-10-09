import assert from "node:assert/strict";
import {
    applySavedReportRunOverride,
    resolveSavedReportRunScope,
} from "./reportBuilderRunOverrides.js";
import { applyReportBuilderStateHook } from "./reportBuilderHooks.js";
import { buildReportBuilderDefaultState, buildReportBuilderRequest } from "./reportBuilderUtils.js";
import { resolveNormalizedReportSpecDocumentContext } from "./reportBuilderSavedRecordMetadataContext.js";

// A date override must not broaden an explicitly campaign-scoped saved run.
const scopedConfig = {
    measures: [{id: "impressions", paramPath: "measures.impressions", default: true}],
    predicates: [
        {id: "dateRange", kind: "dateRange", startParamPath: "filters.from", endParamPath: "filters.to", prefill: {start: "from", end: "to"}},
        {id: "campaignIds", pinned: true, multiple: true, paramPath: "filters.campaignIds", prefill: {path: "campaignIds"}},
    ],
};
const campaignPrefill = {campaignIds: [555307], from: "2026-07-15", to: "2026-07-21"};
const currentRun = {from: "2026-10-01", to: "2026-10-08"};
const currentScope = resolveSavedReportRunScope(campaignPrefill, currentRun);
const scopedState = applyReportBuilderStateHook(null, scopedConfig, buildReportBuilderDefaultState(scopedConfig), {prefill: currentScope});
const scopedRequest = buildReportBuilderRequest(scopedConfig, scopedState);
assert.deepEqual(scopedRequest.filters.campaignIds, [555307]);
assert.equal(scopedRequest.filters.from, "2026-10-01");
assert.equal(scopedRequest.filters.to, "2026-10-08");
assert.deepEqual(campaignPrefill.campaignIds, [555307]);
assert.equal(campaignPrefill.from, "2026-07-15");
const oldScope = {params: [
    {id: "dateRange", value: {start: "2026-07-15", end: "2026-07-21"}},
    {id: "campaignIds", value: [111]},
]};
const savedBundle = {document: {scope: oldScope}, reportSpec: {scope: oldScope}};
const scopedBundle = applySavedReportRunOverride(savedBundle, currentScope);
const restoredScope = resolveNormalizedReportSpecDocumentContext(scopedBundle).scopeParams;
assert.deepEqual(restoredScope, [
    {id: "dateRange", value: {start: "2026-10-01", end: "2026-10-08"}},
    {id: "campaignIds", value: [555307]},
]);
assert.deepEqual(savedBundle.reportSpec.scope, oldScope);

const override = {
    from: "2026-07-27",
    to: "2026-07-30",
    orderIds: [2637055],
};

const response = applySavedReportRunOverride({
    document: {
        scope: {
            params: [
                { id: "dateRange", value: { start: "2026-07-25", end: "2026-07-31" } },
                { id: "orderIds", value: [111] },
                { id: "channelIds", value: [1] },
            ],
        },
    },
}, override);

assert.deepEqual(response.document.scope.params, [
    { id: "dateRange", value: { start: "2026-07-27", end: "2026-07-30" } },
    { id: "orderIds", value: [2637055] },
    { id: "channelIds", value: [1] },
]);

console.log("reportBuilderRunOverrides ✓ temporary scope is applied immutably");
