import assert from "node:assert/strict";
import {
    applySavedReportRunOverride,
    resolveSavedReportRunScope,
} from "./reportBuilderRunOverrides.js";
import { applyReportBuilderStateHook } from "./reportBuilderHooks.js";
import { buildReportBuilderDefaultState, buildReportBuilderRequest } from "./reportBuilderUtils.js";
import { resolveNormalizedReportSpecDocumentContext } from "./reportBuilderSavedRecordMetadataContext.js";

// A date override must not broaden a saved run with an explicit section filter.
const scopedConfig = {
    measures: [{id: "quantity", paramPath: "measures.quantity", default: true}],
    predicates: [
        {id: "dateRange", kind: "dateRange", startParamPath: "filters.from", endParamPath: "filters.to", prefill: {start: "from", end: "to"}},
        {id: "sectionIds", pinned: true, multiple: true, paramPath: "filters.sectionIds", prefill: {path: "sectionIds"}},
    ],
};
const selectionPrefill = {sectionIds: [23], from: "2026-07-15", to: "2026-07-21"};
const currentRun = {from: "2026-10-01", to: "2026-10-08"};
const currentScope = resolveSavedReportRunScope(selectionPrefill, currentRun);
const scopedState = applyReportBuilderStateHook(null, scopedConfig, buildReportBuilderDefaultState(scopedConfig), {prefill: currentScope});
const scopedRequest = buildReportBuilderRequest(scopedConfig, scopedState);
assert.deepEqual(scopedRequest.filters.sectionIds, [23]);
assert.equal(scopedRequest.filters.from, "2026-10-01");
assert.equal(scopedRequest.filters.to, "2026-10-08");
assert.deepEqual(selectionPrefill.sectionIds, [23]);
assert.equal(selectionPrefill.from, "2026-07-15");
const oldScope = {params: [
    {id: "dateRange", value: {start: "2026-07-15", end: "2026-07-21"}},
    {id: "sectionIds", value: [111]},
]};
const savedBundle = {document: {scope: oldScope}, reportSpec: {scope: oldScope}};
const scopedBundle = applySavedReportRunOverride(savedBundle, currentScope);
const restoredScope = resolveNormalizedReportSpecDocumentContext(scopedBundle).scopeParams;
assert.deepEqual(restoredScope, [
    {id: "dateRange", value: {start: "2026-10-01", end: "2026-10-08"}},
    {id: "sectionIds", value: [23]},
]);
assert.deepEqual(savedBundle.reportSpec.scope, oldScope);

const override = {
    from: "2026-07-27",
    to: "2026-07-30",
    groupIds: [17],
};

const response = applySavedReportRunOverride({
    document: {
        scope: {
            params: [
                { id: "dateRange", value: { start: "2026-07-25", end: "2026-07-31" } },
                { id: "groupIds", value: [111] },
                { id: "categoryIds", value: [1] },
            ],
        },
    },
}, override);

assert.deepEqual(response.document.scope.params, [
    { id: "dateRange", value: { start: "2026-07-27", end: "2026-07-30" } },
    { id: "groupIds", value: [17] },
    { id: "categoryIds", value: [1] },
]);

console.log("reportBuilderRunOverrides ✓ temporary scope is applied immutably");
