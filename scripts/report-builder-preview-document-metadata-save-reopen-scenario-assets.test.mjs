import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-document-metadata-save-reopen.scenario.mjs";

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

function getWindow(startIndex, endIndex) {
  return scenario.steps.slice(startIndex, endIndex === -1 ? undefined : endIndex);
}

assert.equal(
  expressions.some((expression) => expression.includes("Household Uniques measure button not found")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "fillSelector" && String(step.selector || "").includes("Report document title") && String(step.value || "") === "Executive Snapshot"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "fillSelector" && String(step.selector || "").includes("Report document subtitle") && String(step.value || "") === "Weekly Rollup"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "fillSelector" && String(step.selector || "").includes("Report document description") && String(step.value || "").includes("Authored document metadata from the live builder.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved exploration artifact: Executive Snapshot")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved report payload: Executive Snapshot")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Executive Snapshot")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("List ReportDocuments response: 7 entries")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect list response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Executive Snapshot for editing.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument: Executive Snapshot")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("reportDocumentTitle === 'Executive Snapshot'") && expression.includes("reportDocumentSubtitle === 'Weekly Rollup'") && expression.includes("reportDocumentDescription === 'Authored document metadata from the live builder.'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("SELECTED MEASURES (2)") && expression.includes("Available Impressions") && expression.includes("Household Uniques")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"reportBuilder.explorationArtifact\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"title\": \"Executive Snapshot\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"getReportDocumentResponse\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("document-metadata-save-reopen")),
  true,
);

const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const inspectArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const inspectPayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect report payload");
const prepareGetResponseIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Prepare get response button not found."));
const prepareListIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare list response");
const inspectListResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect list response");
const openSelectedIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Open selected response");
const inspectGetResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get response");
const reopenBuilderIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Reopen in builder button not found."));
const screenshotIndex = findStepIndex((step) => step?.type === "screenshot" && String(step.file || "").includes("document-metadata-save-reopen"));

assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(inspectArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(inspectPayloadIndex, -1);
assert.notEqual(prepareGetResponseIndex, -1);
assert.notEqual(prepareListIndex, -1);
assert.notEqual(inspectListResponseIndex, -1);
assert.notEqual(openSelectedIndex, -1);
assert.notEqual(inspectGetResponseIndex, -1);
assert.notEqual(reopenBuilderIndex, -1);
assert.notEqual(screenshotIndex, -1);

assert.equal(saveArtifactIndex < inspectArtifactIndex, true);
assert.equal(inspectArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < inspectPayloadIndex, true);
assert.equal(inspectPayloadIndex < prepareGetResponseIndex, true);
assert.equal(prepareGetResponseIndex < prepareListIndex, true);
assert.equal(prepareListIndex < inspectListResponseIndex, true);
assert.equal(inspectListResponseIndex < openSelectedIndex, true);
assert.equal(openSelectedIndex < inspectGetResponseIndex, true);
assert.equal(inspectGetResponseIndex < reopenBuilderIndex, true);

const listWindow = getWindow(inspectListResponseIndex, openSelectedIndex);
const getWindowSteps = getWindow(inspectGetResponseIndex, reopenBuilderIndex);

function windowHasText(windowSteps, text, type = "waitForDomContains") {
  return windowSteps.some((step) => step?.type === type && String(step.text || "").includes(text));
}

assert.equal(
  listWindow.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("[aria-label=\"List ReportDocuments response summary\"]") && String(step.expression || "").includes("\"kind\": \"listReportDocumentsResponse\"") && String(step.expression || "").includes("\"title\": \"Executive Snapshot\"") && String(step.expression || "").includes("\"subtitle\": \"Weekly Rollup\"") && String(step.expression || "").includes("\"description\": \"Authored document metadata from the live builder.\"")),
  true,
);

assert.equal(
  getWindowSteps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("[aria-label=\"Get ReportDocument response summary\"]") && String(step.expression || "").includes("\"kind\": \"getReportDocumentResponse\"") && String(step.expression || "").includes("\"title\": \"Executive Snapshot\"") && String(step.expression || "").includes("\"subtitle\": \"Weekly Rollup\"") && String(step.expression || "").includes("\"description\": \"Authored document metadata from the live builder.\"")),
  true,
);

console.log("report-builder-preview-document-metadata-save-reopen-scenario-assets ✓ document metadata survives artifact save, payload/get/list inspection, reopen, and semantic binding visibility")
