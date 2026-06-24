import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-inventory-chart-runtime-surface-resume.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 35);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityInventoryTopChannelsQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceStandaloneRuntimeInteraction") && expression.includes("Keep only = Display") && expression.includes("nextFieldRef: 'publisher'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("advanceStandaloneRuntimeInteraction") && expression.includes("Drill to Site Type = Acme Media") && expression.includes("nextFieldRef: 'siteType'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'siteType')") && expression.includes("entry.field === 'publisher'") && expression.includes("entry.values[0] === 'Acme Media'") && expression.includes("entry.field === 'channelV2'") && expression.includes("entry.values[0] === 'Display'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("labels.includes('Publisher')") && expression.includes("!labels.includes('Channel')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("labels.includes('Site Type')") && expression.includes("!labels.includes('Publisher')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Inventory Top Channels Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Template: Capacity Inventory Brief")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument: Capacity Inventory Top Channels Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("reopen-report-document-inventory-chart-runtime-surface-resume")),
  true,
);

const selectedInventoryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Inventory Top Channels Q3"));
const prepareGetRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const prepareSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const replaceInteractionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("replaceStandaloneRuntimeInteraction"));
const reloadIndex = scenario.steps.findIndex((step, index) => index > replaceInteractionIndex && step?.type === "reload");
const publisherInteractionResumeIndex = scenario.steps.findIndex((step, index) => index > reloadIndex && step?.type === "waitForEval" && String(step?.expression || "").includes("getStandaloneRuntimeInteraction?.()") && String(step?.expression || "").includes("nextFieldRef === 'publisher'"));
const publisherResumeIndex = scenario.steps.findIndex((step, index) => index > reloadIndex && step?.type === "waitForEval" && String(step?.expression || "").includes("labels.includes('Publisher')") && String(step?.expression || "").includes("!labels.includes('Channel')"));
const advanceInteractionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("advanceStandaloneRuntimeInteraction"));
const finalHeaderIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("labels.includes('Site Type')") && String(step?.expression || "").includes("!labels.includes('Publisher')"));

assert.notEqual(selectedInventoryIndex, -1);
assert.notEqual(prepareGetRequestIndex, -1);
assert.notEqual(prepareSelectedResponseIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(replaceInteractionIndex, -1);
assert.notEqual(reloadIndex, -1);
assert.notEqual(publisherInteractionResumeIndex, -1);
assert.notEqual(publisherResumeIndex, -1);
assert.notEqual(advanceInteractionIndex, -1);
assert.notEqual(finalHeaderIndex, -1);

assert.equal(selectedInventoryIndex < prepareGetRequestIndex, true);
assert.equal(prepareGetRequestIndex < prepareSelectedResponseIndex, true);
assert.equal(prepareSelectedResponseIndex < reopenIndex, true);
assert.equal(reopenIndex < replaceInteractionIndex, true);
assert.equal(replaceInteractionIndex < reloadIndex, true);
assert.equal(reloadIndex < publisherInteractionResumeIndex, true);
assert.equal(publisherInteractionResumeIndex <= publisherResumeIndex, true);
assert.equal(publisherResumeIndex < advanceInteractionIndex, true);
assert.equal(advanceInteractionIndex < finalHeaderIndex, true);

console.log("report-builder-preview-reopen-report-document-inventory-chart-runtime-surface-resume-scenario-assets ✓ reopened inventory chart runtime surface resumes standalone interaction state across reload and second drill");
