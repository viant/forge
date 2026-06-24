import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-left-rail-scroll-bottom.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1600,
  height: 980,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 10);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("document.querySelector('.forge-report-builder__left')") && expression.includes("forge-report-builder__bottom--rail") && expression.includes("Open Filters") && expression.includes("forge-report-builder__left-jump")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("rail.scrollTo({ top: rail.scrollHeight, behavior: 'auto' })") && expression.includes("Left rail not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("railBottomGap < 2") && expression.includes("filterRect.bottom <= railRect.bottom - 8") && expression.includes("filterRect.height > 120")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-left-rail-scroll-bottom")),
  true,
);

const initialRailReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("forge-report-builder__left-jump") && String(step.expression || "").includes("Open Filters"));
const scrollRailIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("rail.scrollTo({ top: rail.scrollHeight, behavior: 'auto' })"));
const bottomVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("railBottomGap < 2") && String(step.expression || "").includes("filterRect.bottom <= railRect.bottom - 8"));

assert.notEqual(initialRailReadyIndex, -1);
assert.notEqual(scrollRailIndex, -1);
assert.notEqual(bottomVisibleIndex, -1);

assert.equal(initialRailReadyIndex < scrollRailIndex, true);
assert.equal(scrollRailIndex < bottomVisibleIndex, true);

console.log("report-builder-preview-semantic-left-rail-scroll-bottom-scenario-assets ✓ semantic left rail can scroll fully to reveal the bottom filters rail");
