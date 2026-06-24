import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-capacity-location-template-save-reopen-drill.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 30);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Capacity Location Brief applied.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Seeded from template: Capacity Location Brief")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved exploration artifact: Capacity Location Brief")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved report payload: Capacity Location Brief")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Template: Capacity Location Brief")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("reportDocumentTemplateId === 'capacity_location_brief'") && expression.includes("reportDocumentTemplateLabel === 'Capacity Location Brief'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Drill to Region = US") && expression.includes("nextFieldRef: 'region'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Drill to Metro Area = West") && expression.includes("nextFieldRef: 'metrocode'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("labels.includes('Region')") && expression.includes("activeLabels.length === 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("labels.includes('Metro Area')") && expression.includes("!labels.includes('Region')") && expression.includes("activeLabels.length === 1")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("capacity-location-template-save-reopen-drill")),
  true,
);

const applyTemplateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Apply template");
const forkIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Fork from here");
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const payloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const getResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const reopenIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopened ReportDocument: Capacity Location Brief"));
const firstDrillIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Drill to Region = US"));
const reloadIndex = scenario.steps.findIndex((step, index) => index > firstDrillIndex && step?.type === "reload");
const secondDrillIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Drill to Metro Area = West"));
const finalHeaderIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("labels.includes('Metro Area')") && String(step?.expression || "").includes("!labels.includes('Region')") && String(step?.expression || "").includes("activeLabels.length === 1"));

assert.notEqual(applyTemplateIndex, -1);
assert.notEqual(forkIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(payloadIndex, -1);
assert.notEqual(getResponseIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(firstDrillIndex, -1);
assert.notEqual(reloadIndex, -1);
assert.notEqual(secondDrillIndex, -1);
assert.notEqual(finalHeaderIndex, -1);

assert.equal(applyTemplateIndex < forkIndex, true);
assert.equal(forkIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < payloadIndex, true);
assert.equal(payloadIndex < getResponseIndex, true);
assert.equal(getResponseIndex < reopenIndex, true);
assert.equal(reopenIndex < firstDrillIndex, true);
assert.equal(firstDrillIndex < reloadIndex, true);
assert.equal(reloadIndex < secondDrillIndex, true);
assert.equal(secondDrillIndex < finalHeaderIndex, true);

console.log("report-builder-preview-capacity-location-template-save-reopen-drill-scenario-assets ✓ capacity location template persists drill state through save, reopen, and second-step runtime drill");
