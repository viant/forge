import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-invalid-authored-report-response.scenario.mjs";

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
  expressions.some((expression) => expression.includes("applyAuthoredDocumentBlock") && expression.includes("kpiBlock") && expression.includes("Reach KPI")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Available Impressions toggle not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("beginStandaloneDraft") && expression.includes("__scenarioDraft")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!document.querySelector('[aria-label=\"Get ReportDocument response summary\"]')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!document.body.innerText.includes('Persisted compile warning:')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!!document.querySelector('[aria-label=\"Get ReportDocument response summary\"]')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"kind\": \"getReportDocumentResponse\"") && expression.includes("\"documentVersion\": 11") && expression.includes("!text.includes('documentBlockValueFieldUnavailable')") && expression.includes("!text.includes('Persisted compile warning')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("demoReportBuilder") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!document.body.innerText.includes('Reopened compile warning:')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("reportDocumentReopenSession?.reopenedCompileState?.status === 'clean'")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Hide get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Report Builder Demo for editing.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("reopen-invalid-authored-report-response")),
  true,
);

const applyBlockIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("applyAuthoredDocumentBlock"));
const beginDraftIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("beginStandaloneDraft"));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const prepareGetResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get response");
const hiddenBeforeInspectIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!document.querySelector('[aria-label=\"Get ReportDocument response summary\"]')"));
const noPersistedWarningIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Persisted compile warning:"));
const inspectResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get response");
const responseVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!!document.querySelector('[aria-label=\"Get ReportDocument response summary\"]')"));
const hideResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Hide get response");
const hiddenAfterHideIndex = findStepIndex((step, index) => index > hideResponseIndex && step?.type === "waitForEval" && String(step.expression || "").includes("!document.querySelector('[aria-label=\"Get ReportDocument response summary\"]')"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const noReopenedWarningIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Reopened compile warning:"));
const cleanReopenStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("reopenedCompileState?.status === 'clean'"));

assert.notEqual(applyBlockIndex, -1);
assert.notEqual(beginDraftIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(prepareGetResponseIndex, -1);
assert.notEqual(hiddenBeforeInspectIndex, -1);
assert.notEqual(noPersistedWarningIndex, -1);
assert.notEqual(inspectResponseIndex, -1);
assert.notEqual(responseVisibleIndex, -1);
assert.notEqual(hideResponseIndex, -1);
assert.notEqual(hiddenAfterHideIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(noReopenedWarningIndex, -1);
assert.notEqual(cleanReopenStateIndex, -1);

assert.equal(applyBlockIndex < beginDraftIndex, true);
assert.equal(beginDraftIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < prepareGetResponseIndex, true);
assert.equal(prepareGetResponseIndex < hiddenBeforeInspectIndex, true);
assert.equal(hiddenBeforeInspectIndex < noPersistedWarningIndex, true);
assert.equal(noPersistedWarningIndex < inspectResponseIndex, true);
assert.equal(inspectResponseIndex < responseVisibleIndex, true);
assert.equal(responseVisibleIndex < hideResponseIndex, true);
assert.equal(hideResponseIndex < hiddenAfterHideIndex, true);
assert.equal(hiddenAfterHideIndex < reopenIndex, true);
assert.equal(reopenIndex < noReopenedWarningIndex, true);
assert.equal(noReopenedWarningIndex < cleanReopenStateIndex, true);

console.log("report-builder-preview-reopen-invalid-authored-report-response-scenario-assets ✓ invalid local authored state does not leak into persisted get response or reopened compile state");
