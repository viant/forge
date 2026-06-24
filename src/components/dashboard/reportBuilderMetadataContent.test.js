import assert from "node:assert/strict";

import {
    hasReportBuilderArrayEntries,
    hasReportBuilderBindingContent,
    hasReportBuilderMetadataContextContent,
    hasReportBuilderScopeParamsContent,
    hasReportBuilderSemanticSummaryContent,
    isReportBuilderPlainObject,
} from "./reportBuilderMetadataContent.js";

assert.equal(isReportBuilderPlainObject({}), true);
assert.equal(isReportBuilderPlainObject([]), false);
assert.equal(isReportBuilderPlainObject(null), false);

assert.equal(hasReportBuilderArrayEntries([]), false);
assert.equal(hasReportBuilderArrayEntries([1]), true);

assert.equal(hasReportBuilderSemanticSummaryContent({
    kind: "semantic",
    selectedDimensions: [],
    selectedMeasures: [],
    selectedParameters: [],
}), false);
assert.ok(hasReportBuilderSemanticSummaryContent({
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
}));
assert.ok(hasReportBuilderSemanticSummaryContent({
    kind: "semantic",
    selectedMeasures: [{ id: "available_impressions" }],
}));

assert.equal(hasReportBuilderBindingContent({
    selectedDimensions: [],
    selectedMeasures: [],
}), false);
assert.ok(hasReportBuilderBindingContent({
    mode: "semantic",
}));
assert.ok(hasReportBuilderBindingContent({
    selectedMeasures: ["available_impressions"],
}));

assert.equal(hasReportBuilderScopeParamsContent(null), false);
assert.equal(hasReportBuilderScopeParamsContent([]), false);
assert.equal(hasReportBuilderScopeParamsContent([{ id: "dateRange" }]), true);
assert.equal(hasReportBuilderScopeParamsContent({
    scope: {
        params: [],
    },
}), false);
assert.equal(hasReportBuilderScopeParamsContent({
    scope: {
        params: [{ id: "dateRange" }],
    },
}), true);
assert.equal(hasReportBuilderScopeParamsContent({
    scopeParams: [{ id: "dateRange" }],
}), true);

assert.equal(hasReportBuilderMetadataContextContent({
    semanticSummary: {
        kind: "semantic",
        selectedMeasures: [],
    },
    binding: {
        selectedDimensions: [],
        selectedMeasures: [],
    },
    scope: {
        params: [],
    },
}), false);
assert.ok(hasReportBuilderMetadataContextContent({
    semanticSummary: {
        kind: "semantic",
        selectedMeasures: [{ id: "available_impressions" }],
    },
}));
assert.ok(hasReportBuilderMetadataContextContent({
    binding: {
        mode: "semantic",
    },
}));
assert.ok(hasReportBuilderMetadataContextContent({
    scopeParams: [{ id: "dateRange" }],
}));

console.log("reportBuilderMetadataContent ✓ detects meaningful semantic, binding, and scope metadata");
