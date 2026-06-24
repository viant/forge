import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-template-save-reopen.scenario.mjs";

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
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Apply template"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".bp6-menu-item" && step?.text === "Market Brief"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Market Brief applied.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Seeded from template: Market Brief")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Fork from here"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved exploration artifact: Market Brief")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved report payload: Market Brief")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Saved report payload: Market Brief") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect report payload"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"reportDocumentTemplateId\": \"market_brief\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"reportDocumentTemplateLabel\": \"Market Brief\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Prepare get response button not found.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect get response"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"kind\": \"getReportDocumentResponse\"") && expression.includes("\"reportDocumentTemplateId\": \"market_brief\"") && expression.includes("\"reportDocumentTemplateLabel\": \"Market Brief\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Market Brief for editing.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument: Market Brief")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("state?.reportDocumentTitle === 'Market Brief'") && expression.includes("state?.reportDocumentTemplateId === 'market_brief'") && expression.includes("state?.reportDocumentTemplateLabel === 'Market Brief'") && expression.includes("titles.includes('Executive Summary')") && expression.includes("titles.includes('Headline KPI')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Market Brief.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("demo-export-job-1") && expression.includes("queued") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Available Impressions") && expression.includes("Household Uniques")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is queued.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === 'Market Brief.pdf'") && expression.includes("payloadReady === true")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.mimeType === 'application/pdf'") && expression.includes("%PDF-demo Market Brief")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-template-save-reopen")),
  true,
);

const applyTemplateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Apply template");
const selectTemplateIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".bp6-menu-item" && step?.text === "Market Brief");
const seededNoticeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Seeded from template: Market Brief"));
const forkIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Fork from here");
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const inspectPayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect report payload");
const prepareGetIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Prepare get response button not found."));
const inspectGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get response");
const reopenIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Reopen in builder button not found."));
const reopenedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("state?.reportDocumentTemplateId === 'market_brief'") && String(step.expression || "").includes("titles.includes('Executive Summary')"));
const submitExportIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Export snapshot button not found in reopened Market Brief section."));
const acceptedExportIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Market Brief."));
const queuedExportIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is queued."));
const succeededExportIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded."));
const downloadArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download artifact");
const downloadedArtifactIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.filename === 'Market Brief.pdf'"));

assert.notEqual(applyTemplateIndex, -1);
assert.notEqual(selectTemplateIndex, -1);
assert.notEqual(seededNoticeIndex, -1);
assert.notEqual(forkIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(inspectPayloadIndex, -1);
assert.notEqual(prepareGetIndex, -1);
assert.notEqual(inspectGetIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(reopenedStateIndex, -1);
assert.notEqual(submitExportIndex, -1);
assert.notEqual(acceptedExportIndex, -1);
assert.notEqual(queuedExportIndex, -1);
assert.notEqual(succeededExportIndex, -1);
assert.notEqual(downloadArtifactIndex, -1);
assert.notEqual(downloadedArtifactIndex, -1);

assert.equal(applyTemplateIndex < selectTemplateIndex, true);
assert.equal(selectTemplateIndex < seededNoticeIndex, true);
assert.equal(seededNoticeIndex < forkIndex, true);
assert.equal(forkIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < inspectPayloadIndex, true);
assert.equal(inspectPayloadIndex < prepareGetIndex, true);
assert.equal(prepareGetIndex < inspectGetIndex, true);
assert.equal(inspectGetIndex < reopenIndex, true);
assert.equal(reopenIndex < reopenedStateIndex, true);
assert.equal(reopenedStateIndex < submitExportIndex, true);
assert.equal(submitExportIndex < acceptedExportIndex, true);
assert.equal(acceptedExportIndex < queuedExportIndex, true);
assert.equal(queuedExportIndex < succeededExportIndex, true);
assert.equal(succeededExportIndex < downloadArtifactIndex, true);
assert.equal(downloadArtifactIndex < downloadedArtifactIndex, true);

console.log("report-builder-preview-semantic-template-save-reopen-scenario-assets ✓ Market Brief template survives fork, save, payload/get inspection, reopen, and export execution with semantic metadata intact");
