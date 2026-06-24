import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-selected-get-report-document-kpi-duplicate-response.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 25);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("demoReportBuilder") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("querySelectorAll('section h3')") && expression.includes("Reach KPI Copy") && expression.includes("Reach KPI")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reach KPI added to the report document.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reach KPI Copy duplicated in the authored report document.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("selected-get-report-document-kpi-duplicate-response")),
  true,
);

const addKpiIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Add KPI");
const duplicateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Duplicate Reach KPI");
const moveUpIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Move Reach KPI Copy up");
const selectedDemoIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Report Builder Demo"));
const openSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Open selected response");
const responseIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Get ReportDocument response: Report Builder Demo"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const semanticPanelIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Governed reporting model for the report builder preview."));
const runtimeKpiIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("querySelectorAll('section h3')") && String(step?.expression || "").includes("Reach KPI Copy") && String(step?.expression || "").includes("Reach KPI"));

assert.notEqual(addKpiIndex, -1);
assert.notEqual(duplicateIndex, -1);
assert.notEqual(moveUpIndex, -1);
assert.notEqual(selectedDemoIndex, -1);
assert.notEqual(openSelectedResponseIndex, -1);
assert.notEqual(responseIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(semanticPanelIndex, -1);
assert.notEqual(runtimeKpiIndex, -1);

assert.equal(addKpiIndex < duplicateIndex, true);
assert.equal(duplicateIndex < moveUpIndex, true);
assert.equal(moveUpIndex < selectedDemoIndex, true);
assert.equal(selectedDemoIndex < openSelectedResponseIndex, true);
assert.equal(openSelectedResponseIndex < responseIndex, true);
assert.equal(responseIndex < reopenIndex, true);
assert.equal(reopenIndex < semanticPanelIndex, true);
assert.equal(semanticPanelIndex < runtimeKpiIndex, true);

console.log("report-builder-preview-selected-get-report-document-kpi-duplicate-response-scenario-assets ✓ duplicated authored KPI survives saved payload, selected response open, and reopen ordering");
