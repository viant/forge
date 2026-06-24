import assert from "node:assert/strict";

import { buildSemanticFieldGovernanceChipViewModels } from "./semanticFieldGovernanceView.js";

assert.deepEqual(buildSemanticFieldGovernanceChipViewModels(), []);

assert.deepEqual(buildSemanticFieldGovernanceChipViewModels({
  status: "approved",
  certification: "reviewed",
  ownerRef: "team://example/performance",
}), [
  { key: "approved", label: "Approved", tone: "approved" },
  { key: "certification:reviewed", label: "Reviewed", tone: "certification" },
  { key: "owner:team://example/performance", label: "Owner team://example/performance", tone: "owner" },
]);

assert.deepEqual(buildSemanticFieldGovernanceChipViewModels({
  status: "deprecated",
  certification: "certified",
}), [
  { key: "deprecated", label: "Deprecated", tone: "deprecated" },
  { key: "certification:certified", label: "Certified", tone: "certification" },
]);

assert.deepEqual(buildSemanticFieldGovernanceChipViewModels({
  status: "draft",
}), [
  { key: "draft", label: "Draft", tone: "draft" },
]);

console.log("semanticFieldGovernanceView ✓ formats semantic governance chips for builder/runtime surfaces");
