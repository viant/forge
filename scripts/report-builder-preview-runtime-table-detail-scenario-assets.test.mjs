import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-table-detail.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 6);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes(".forge-report-runtime-table-panel .forge-dashboard-row-action")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Resolved detail target")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("target://example/performance/channel-detail")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Detail target resolved with omitted parameters: campaign.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes(".forge-report-runtime-host-intent") && expression.includes("channel") && expression.includes("Display") && expression.includes("!text.includes('Prospect Sprint')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-table-detail-proof")),
  true,
);

const actionsReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-runtime-table-panel .forge-dashboard-row-action"));
const clickDetailIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show channel details");
const resolvedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Resolved detail target"));
const omittedParamIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Detail target resolved with omitted parameters: campaign."));
const hostIntentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-runtime-host-intent"));

assert.notEqual(actionsReadyIndex, -1);
assert.notEqual(clickDetailIndex, -1);
assert.notEqual(resolvedIndex, -1);
assert.notEqual(omittedParamIndex, -1);
assert.notEqual(hostIntentIndex, -1);

assert.equal(actionsReadyIndex < clickDetailIndex, true);
assert.equal(clickDetailIndex < resolvedIndex, true);
assert.equal(resolvedIndex < omittedParamIndex, true);
assert.equal(omittedParamIndex < hostIntentIndex, true);

console.log("report-builder-preview-runtime-table-detail-scenario-assets ✓ semantic runtime table detail resolves host intent and surfaces omitted parameter diagnostics");
