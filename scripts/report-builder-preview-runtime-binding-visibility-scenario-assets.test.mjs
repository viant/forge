import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-binding-visibility.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1440,
  height: 1400,
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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Compiled Report Runtime Preview")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Governed model and field selections compiled into this runtime artifact.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[data-report-runtime-binding-panel=\"semantic\"]") && expression.includes("selected dimensions (2)")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[data-report-runtime-binding-panel=\"semantic\"]") && expression.includes("selected measures (2)")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[data-report-runtime-binding-panel=\"semantic\"]") && expression.includes("Delivery Date")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[data-report-runtime-binding-panel=\"semantic\"]") && expression.includes("Channel")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[data-report-runtime-binding-panel=\"semantic\"]") && expression.includes("Available Impressions")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[data-report-runtime-binding-panel=\"semantic\"]") && expression.includes("Household Uniques")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-binding-visibility")),
  true,
);

const runtimePreviewIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Compiled Report Runtime Preview"));
const bindingDescriptionIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Governed model and field selections compiled into this runtime artifact."));
const selectedDimensionsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("selected dimensions (2)"));
const selectedMeasuresIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("selected measures (2)"));

assert.notEqual(runtimePreviewIndex, -1);
assert.notEqual(bindingDescriptionIndex, -1);
assert.notEqual(selectedDimensionsIndex, -1);
assert.notEqual(selectedMeasuresIndex, -1);

assert.equal(runtimePreviewIndex < bindingDescriptionIndex, true);
assert.equal(bindingDescriptionIndex < selectedDimensionsIndex, true);
assert.equal(selectedDimensionsIndex < selectedMeasuresIndex, true);

console.log("report-builder-preview-runtime-binding-visibility-scenario-assets ✓ semantic runtime binding panel remains visible with compiled dimensions and measures");
