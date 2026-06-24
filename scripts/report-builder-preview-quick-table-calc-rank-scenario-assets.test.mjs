import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-quick-table-calc-rank.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
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
  expressions.some((expression) => expression.includes("applyQuickTableCalculation API not available.") && expression.includes("reachRank")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("parsed?.localTableCalculations") && expression.includes("reachRank")),
  true,
);
assert.equal(
  expressions.filter((expression) => expression.includes("headers.includes('reach rank')") && expression.includes("headers.includes('market')") && expression.includes("headers.includes('channel')")).length >= 2,
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("quick-table-calc-rank")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelector" && String(step.selector || "").includes(".forge-report-builder__panel-action-button--table-calc")),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && String(step.selector || "").includes("[role=\"menuitem\"]")),
  false,
);

const applyQuickRankIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("applyQuickTableCalculation API not available."));
const firstLocalDraftIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft"));
const storedRankIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("parsed?.localTableCalculations") && String(step.expression || "").includes("reachRank"));
const firstHeadersIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("headers.includes('reach rank')") && String(step.expression || "").includes("headers.includes('market')") && String(step.expression || "").includes("headers.includes('channel')"));
const reloadIndex = findStepIndex((step, index) => index > firstHeadersIndex && step?.type === "reload");
const reloadedDraftIndex = findStepIndex((step, index) => index > reloadIndex && step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft"));
const reloadedStateIndex = findStepIndex((step, index) => index > reloadIndex && step?.type === "waitForEval" && String(step.expression || "").includes("state?.localTableCalculations") && String(step.expression || "").includes("reachRank"));

assert.notEqual(applyQuickRankIndex, -1);
assert.notEqual(firstLocalDraftIndex, -1);
assert.notEqual(storedRankIndex, -1);
assert.notEqual(firstHeadersIndex, -1);
assert.notEqual(reloadIndex, -1);
assert.notEqual(reloadedDraftIndex, -1);
assert.notEqual(reloadedStateIndex, -1);

assert.equal(applyQuickRankIndex < firstLocalDraftIndex, true);
assert.equal(firstLocalDraftIndex < storedRankIndex, true);
assert.equal(storedRankIndex < firstHeadersIndex, true);
assert.equal(firstHeadersIndex < reloadIndex, true);
assert.equal(reloadIndex < reloadedDraftIndex, true);
assert.equal(reloadedDraftIndex < reloadedStateIndex, true);

console.log("report-builder-preview-quick-table-calc-rank-scenario-assets ✓ quick rank table calculation persists through reload without regressing to the old quick-menu flow");
