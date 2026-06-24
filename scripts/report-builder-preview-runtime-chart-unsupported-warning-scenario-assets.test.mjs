import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-chart-unsupported-warning.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 12);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("replaceRuntimeActionBehaviors") && expression.includes("blockKind: 'chartBlock'") && expression.includes("fieldRef: 'eventDate'") && expression.includes("Show date details")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails + HH Uniques by Date" && step?.index === 0),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitSelector" && step?.selector === ".forge-report-runtime-chart-panel .recharts-bar-rectangle"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected value: 2026-05-01 • avails")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Runtime Diagnostics")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Runtime refinement actions are unavailable for Date because no backend runtime filter mapping is declared.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Show date details")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Keep Date only")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Exclude Date")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Drill to Time Detail")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-chart-unsupported-warning-proof")),
  true,
);

const injectActionsIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceRuntimeActionBehaviors"));
const selectPresetIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails + HH Uniques by Date");
const chartReadyIndex = findStepIndex((step) => step?.type === "waitSelector" && step?.selector === ".forge-report-runtime-chart-panel .recharts-bar-rectangle");
const clickBarIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-runtime-chart-panel .recharts-bar-rectangle");
const selectedValueIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected value: 2026-05-01 • avails"));
const noDiagnosticsIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step?.text || "").includes("Runtime Diagnostics"));
const noUnsupportedWarningIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step?.text || "").includes("Runtime refinement actions are unavailable for Date"));
const validDetailIndex = findStepIndex((step) => step?.type === "assertDomContains" && String(step?.text || "").includes("Show date details"));
const noKeepIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step?.text || "").includes("Keep Date only"));
const noExcludeIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step?.text || "").includes("Exclude Date"));
const noDrillIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step?.text || "").includes("Drill to Time Detail"));

assert.notEqual(injectActionsIndex, -1);
assert.notEqual(selectPresetIndex, -1);
assert.notEqual(chartReadyIndex, -1);
assert.notEqual(clickBarIndex, -1);
assert.notEqual(selectedValueIndex, -1);
assert.notEqual(noDiagnosticsIndex, -1);
assert.notEqual(noUnsupportedWarningIndex, -1);
assert.notEqual(validDetailIndex, -1);
assert.notEqual(noKeepIndex, -1);
assert.notEqual(noExcludeIndex, -1);
assert.notEqual(noDrillIndex, -1);

assert.equal(injectActionsIndex < selectPresetIndex, true);
assert.equal(selectPresetIndex < chartReadyIndex, true);
assert.equal(chartReadyIndex < clickBarIndex, true);
assert.equal(clickBarIndex < selectedValueIndex, true);
assert.equal(selectedValueIndex < noDiagnosticsIndex, true);
assert.equal(noDiagnosticsIndex < noUnsupportedWarningIndex, true);
assert.equal(noUnsupportedWarningIndex < validDetailIndex, true);
assert.equal(validDetailIndex < noKeepIndex, true);
assert.equal(noKeepIndex < noExcludeIndex, true);
assert.equal(noExcludeIndex < noDrillIndex, true);

console.log("report-builder-preview-runtime-chart-unsupported-warning-scenario-assets ✓ unsupported chart refinement actions stay hidden while valid detail actions remain available");
