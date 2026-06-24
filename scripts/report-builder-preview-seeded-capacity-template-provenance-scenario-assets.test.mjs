import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-seeded-capacity-template-provenance.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 20);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved report payload: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("List ReportDocuments response: 7 entries")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "selectSelector" && step?.value === "capacityQ3"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "selectSelector" && step?.value === "capacityLocationsTopMarketsQ3"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Selected entry: Capacity Q3") && expression.includes("Template: Capacity Inventory Brief")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Selected entry: Capacity Locations Top Markets Q3") && expression.includes("Template: Capacity Location Brief")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("document.querySelectorAll('.forge-report-builder__chart-inline-notice')") && expression.includes("Get ReportDocument response: Capacity Q3") && expression.includes("Template: Capacity Inventory Brief")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("document.querySelectorAll('.forge-report-builder__chart-inline-notice')") && expression.includes("Get ReportDocument response: Capacity Locations Top Markets Q3") && expression.includes("Template: Capacity Location Brief")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Hide get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("seeded-capacity-template-provenance")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Fork from here"),
  false,
);

const prepareListIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare list response");
const firstSelectIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "capacityQ3");
const firstSelectedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Q3"));
const firstPrepareRequestIndex = findStepIndex((step, index) => index > firstSelectedIndex && step?.type === "clickRole" && step?.name === "Prepare get request");
const firstPrepareResponseIndex = findStepIndex((step, index) => index > firstPrepareRequestIndex && step?.type === "clickRole" && step?.name === "Prepare selected get response");
const firstResponseIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Capacity Q3"));
const hideResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Hide get response");
const secondSelectIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "capacityLocationsTopMarketsQ3");
const secondSelectedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Locations Top Markets Q3"));
const secondPrepareRequestIndex = findStepIndex((step, index) => index > secondSelectedIndex && step?.type === "clickRole" && step?.name === "Prepare get request");
const secondPrepareResponseIndex = findStepIndex((step, index) => index > secondPrepareRequestIndex && step?.type === "clickRole" && step?.name === "Prepare selected get response");
const secondResponseIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Capacity Locations Top Markets Q3"));

assert.notEqual(prepareListIndex, -1);
assert.notEqual(firstSelectIndex, -1);
assert.notEqual(firstSelectedIndex, -1);
assert.notEqual(firstPrepareRequestIndex, -1);
assert.notEqual(firstPrepareResponseIndex, -1);
assert.notEqual(firstResponseIndex, -1);
assert.notEqual(hideResponseIndex, -1);
assert.notEqual(secondSelectIndex, -1);
assert.notEqual(secondSelectedIndex, -1);
assert.notEqual(secondPrepareRequestIndex, -1);
assert.notEqual(secondPrepareResponseIndex, -1);
assert.notEqual(secondResponseIndex, -1);

assert.equal(prepareListIndex < firstSelectIndex, true);
assert.equal(firstSelectIndex < firstSelectedIndex, true);
assert.equal(firstSelectedIndex < firstPrepareRequestIndex, true);
assert.equal(firstPrepareRequestIndex < firstPrepareResponseIndex, true);
assert.equal(firstPrepareResponseIndex < firstResponseIndex, true);
assert.equal(firstResponseIndex < hideResponseIndex, true);
assert.equal(hideResponseIndex < secondSelectIndex, true);
assert.equal(secondSelectIndex < secondSelectedIndex, true);
assert.equal(secondSelectedIndex < secondPrepareRequestIndex, true);
assert.equal(secondPrepareRequestIndex < secondPrepareResponseIndex, true);
assert.equal(secondPrepareResponseIndex < secondResponseIndex, true);

console.log("report-builder-preview-seeded-capacity-template-provenance-scenario-assets ✓ seeded capacity template entries preserve template provenance across list selection and selected get response flows");
