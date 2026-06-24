import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-preview-retry.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 720,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 10);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("__runtimePreviewRetryBaseline") && expression.includes("entry.type === 'runtimePreview'") && expression.includes("phase === 'error'") && expression.includes("phase === 'success'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("Runtime preview fetch failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("entry.type === 'runtimePreview'") && expression.includes("phase === 'success'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("errorCount > baseline.errorCount")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("text.includes('Runtime preview fetch failed.')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("fetchBehaviors.length === 0")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("successCount > baseline.successCount")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!text.includes('Runtime preview fetch failed.')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes(".forge-report-builder__runtime-preview .forge-report-runtime-table-panel")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Compiled Runtime Preview")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-preview-retry")),
  true,
);

const baselineIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("__runtimePreviewRetryBaseline"));
const initialSuccessIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("entry.type === 'runtimePreview'") && String(step?.expression || "").includes("phase === 'success'"));
const firstRunIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Run");
const errorCountIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("errorCount > baseline.errorCount"));
const errorVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Runtime preview fetch failed."));
const behaviorsClearedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("fetchBehaviors.length === 0"));
const secondRunIndex = scenario.steps.findIndex((step, index) => index > behaviorsClearedIndex && step?.type === "clickRole" && step?.name === "Run");
const successCountIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("successCount > baseline.successCount"));
const errorClearedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!text.includes('Runtime preview fetch failed.')"));
const runtimeTableVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-builder__runtime-preview .forge-report-runtime-table-panel"));

assert.notEqual(baselineIndex, -1);
assert.notEqual(initialSuccessIndex, -1);
assert.notEqual(firstRunIndex, -1);
assert.notEqual(errorCountIndex, -1);
assert.notEqual(errorVisibleIndex, -1);
assert.notEqual(behaviorsClearedIndex, -1);
assert.notEqual(secondRunIndex, -1);
assert.notEqual(successCountIndex, -1);
assert.notEqual(errorClearedIndex, -1);
assert.notEqual(runtimeTableVisibleIndex, -1);

assert.equal(initialSuccessIndex < baselineIndex, true);
assert.equal(baselineIndex < firstRunIndex, true);
assert.equal(firstRunIndex < errorCountIndex, true);
assert.equal(errorCountIndex < errorVisibleIndex, true);
assert.equal(errorVisibleIndex < behaviorsClearedIndex, true);
assert.equal(behaviorsClearedIndex < secondRunIndex, true);
assert.equal(secondRunIndex < successCountIndex, true);
assert.equal(successCountIndex < errorClearedIndex, true);
assert.equal(errorClearedIndex < runtimeTableVisibleIndex, true);

console.log("report-builder-preview-runtime-preview-retry-scenario-assets ✓ runtime preview retries from a transient fetch failure and returns to a compiled runtime surface");
