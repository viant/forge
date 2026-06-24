import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-location-chart-runtime-surface-resume.scenario.mjs";

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
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityLocationsTopMarketsQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceStandaloneRuntimeInteraction") && expression.includes("Keep only = US") && expression.includes("nextFieldRef: 'region'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("advanceStandaloneRuntimeInteraction") && expression.includes("Drill to Metro = West") && expression.includes("nextFieldRef: 'metrocode'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'metrocode')") && expression.includes("entry.field === 'region'") && expression.includes("entry.values[0] === 'West'") && expression.includes("entry.field === 'country'") && expression.includes("entry.values[0] === 'US'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("labels.includes('Region')") && expression.includes("!labels.includes('Market')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("labels.includes('Metro Area')") && expression.includes("!labels.includes('Region')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Locations Top Markets Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Template: Capacity Location Brief")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument: Capacity Locations Top Markets Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("reopen-report-document-location-chart-runtime-surface-resume")),
  true,
);

const selectedLocationIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Locations Top Markets Q3"));
const prepareGetRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const prepareSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const replaceInteractionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("replaceStandaloneRuntimeInteraction"));
const reloadIndex = scenario.steps.findIndex((step, index) => index > replaceInteractionIndex && step?.type === "reload");
const regionInteractionResumeIndex = scenario.steps.findIndex((step, index) => index > reloadIndex && step?.type === "waitForEval" && String(step?.expression || "").includes("getStandaloneRuntimeInteraction?.()") && String(step?.expression || "").includes("nextFieldRef === 'region'"));
const regionResumeIndex = scenario.steps.findIndex((step, index) => index > reloadIndex && step?.type === "waitForEval" && String(step?.expression || "").includes("labels.includes('Region')") && String(step?.expression || "").includes("!labels.includes('Market')"));
const advanceInteractionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("advanceStandaloneRuntimeInteraction"));
const metroStateResumeIndex = scenario.steps.findIndex((step, index) => index > advanceInteractionIndex && step?.type === "waitForEval" && String(step?.expression || "").includes("getBuilderState?.()") && String(step?.expression || "").includes("nextFieldRef === 'metrocode'"));
const metroStandaloneResumeIndex = scenario.steps.findIndex((step, index) => index > advanceInteractionIndex && step?.type === "waitForEval" && String(step?.expression || "").includes("getStandaloneRuntimeInteraction?.()") && String(step?.expression || "").includes("nextFieldRef === 'metrocode'"));
const finalHeaderIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("labels.includes('Metro Area')") && String(step?.expression || "").includes("!labels.includes('Region')"));

assert.notEqual(selectedLocationIndex, -1);
assert.notEqual(prepareGetRequestIndex, -1);
assert.notEqual(prepareSelectedResponseIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(replaceInteractionIndex, -1);
assert.notEqual(reloadIndex, -1);
assert.notEqual(regionInteractionResumeIndex, -1);
assert.notEqual(regionResumeIndex, -1);
assert.notEqual(advanceInteractionIndex, -1);
assert.notEqual(metroStateResumeIndex, -1);
assert.notEqual(metroStandaloneResumeIndex, -1);
assert.notEqual(finalHeaderIndex, -1);

assert.equal(selectedLocationIndex < prepareGetRequestIndex, true);
assert.equal(prepareGetRequestIndex < prepareSelectedResponseIndex, true);
assert.equal(prepareSelectedResponseIndex < reopenIndex, true);
assert.equal(reopenIndex < replaceInteractionIndex, true);
assert.equal(replaceInteractionIndex < reloadIndex, true);
assert.equal(reloadIndex < regionInteractionResumeIndex, true);
assert.equal(regionInteractionResumeIndex <= regionResumeIndex, true);
assert.equal(regionResumeIndex < advanceInteractionIndex, true);
assert.equal(advanceInteractionIndex < metroStateResumeIndex, true);
assert.equal(metroStateResumeIndex < metroStandaloneResumeIndex, true);
assert.equal(metroStandaloneResumeIndex < finalHeaderIndex, true);

console.log("report-builder-preview-reopen-report-document-location-chart-runtime-surface-resume-scenario-assets ✓ reopened location chart runtime surface resumes standalone interaction state across reload and second drill");
