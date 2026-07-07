import assert from "node:assert/strict";

import { shouldShowReportBuilderSemanticWorkspace } from "./reportBuilderSemanticWorkspaceAvailability.js";

assert.equal(shouldShowReportBuilderSemanticWorkspace(), false);
assert.equal(shouldShowReportBuilderSemanticWorkspace({
    providerAvailable: true,
}), true);
assert.equal(shouldShowReportBuilderSemanticWorkspace({
    binding: {
        mode: "semantic",
    },
}), true);
assert.equal(shouldShowReportBuilderSemanticWorkspace({
    configuredSemanticModel: {
        modelRef: "model://example/performance/delivery@v1",
    },
}), true);
assert.equal(shouldShowReportBuilderSemanticWorkspace({
    activationCount: 1,
}), true);

console.log("reportBuilderSemanticWorkspaceAvailability ✓ hides the model surface unless semantic support is actually present");
