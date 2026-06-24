import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-collection-source.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 8);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("replaceCollectionRows") && expression.includes("2026-05-09") && expression.includes("channelV2: 'Direct'") && expression.includes("avails: 77777")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes(".forge-report-runtime-table-panel") && expression.includes("text.includes('Direct')") && expression.includes("!text.includes('CTV')") && expression.includes("!text.includes('Display')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Compiled Runtime Preview")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-collection-source")),
  true,
);

const replaceRowsIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceCollectionRows"));
const verifyCollectionPanelIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("text.includes('Direct')") && String(step?.expression || "").includes("!text.includes('CTV')") && String(step?.expression || "").includes("!text.includes('Display')"));
const runtimePreviewIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Compiled Runtime Preview"));

assert.notEqual(replaceRowsIndex, -1);
assert.notEqual(verifyCollectionPanelIndex, -1);
assert.notEqual(runtimePreviewIndex, -1);

assert.equal(replaceRowsIndex < verifyCollectionPanelIndex, true);
assert.equal(verifyCollectionPanelIndex < runtimePreviewIndex, true);

console.log("report-builder-preview-runtime-collection-source-scenario-assets ✓ compiled runtime preview honors injected collection rows over the default seeded dataset");
