import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-authored-chart-saved-record-detail.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 26);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("beginStandaloneDraft API not available.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("appendSeededSavedReportPayloadRecord API not available.") && expression.includes("authoredChannelChartQ3Preview") && expression.includes("Channel Detail Chart")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("authoredChannelChartQ3Preview") && expression.includes("documentVersion === 12")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Channel Detail Chart runtime panel not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Channel Detail Chart mark not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Channel Detail Chart detail action not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"kind\": \"getReportDocumentResponse\"") && expression.includes("\"title\": \"Authored Channel Chart Preview\"") && expression.includes("\"documentVersion\": 12") && expression.includes("\"title\": \"Channel Detail Chart\"") && expression.includes("\"blockId\": \"channelDetailChart\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes(".forge-report-runtime-host-intent__parameter") && expression.includes("parameters.length === 1") && expression.includes("channel") && expression.includes("Display") && expression.includes("target://example/performance/channel-detail")),
  true,
);

assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved exploration artifact: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Authored Channel Chart Preview")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("reopen-authored-chart-saved-record-detail")),
  true,
);

const draftIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("beginStandaloneDraft API not available."));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const appendRecordIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("appendSeededSavedReportPayloadRecord API not available."));
const prepareListIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare list response");
const prepareGetRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const prepareSelectedGetResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const inspectGetResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get response");
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const reopenedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("getHydratedReportDocumentSession") && String(step.expression || "").includes("authoredChannelChartQ3Preview"));
const runtimePanelIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Channel Detail Chart") && String(step.expression || "").includes(".recharts-rectangle"));
const markClickIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Channel Detail Chart mark not found."));
const selectedValueIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Selected value:") && String(step.expression || "").includes("Show channel details"));
const detailActionIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Channel Detail Chart detail action not found."));
const hostIntentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes(".forge-report-runtime-host-intent__parameter") && String(step.expression || "").includes("parameters.length === 1") && String(step.expression || "").includes("target://example/performance/channel-detail") && String(step.expression || "").includes("Display"));

assert.notEqual(draftIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(appendRecordIndex, -1);
assert.notEqual(prepareListIndex, -1);
assert.notEqual(prepareGetRequestIndex, -1);
assert.notEqual(prepareSelectedGetResponseIndex, -1);
assert.notEqual(inspectGetResponseIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(reopenedSessionIndex, -1);
assert.notEqual(runtimePanelIndex, -1);
assert.notEqual(markClickIndex, -1);
assert.notEqual(selectedValueIndex, -1);
assert.notEqual(detailActionIndex, -1);
assert.notEqual(hostIntentIndex, -1);

assert.equal(draftIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < appendRecordIndex, true);
assert.equal(appendRecordIndex < prepareListIndex, true);
assert.equal(prepareListIndex < prepareGetRequestIndex, true);
assert.equal(prepareGetRequestIndex < prepareSelectedGetResponseIndex, true);
assert.equal(prepareSelectedGetResponseIndex < inspectGetResponseIndex, true);
assert.equal(inspectGetResponseIndex < reopenIndex, true);
assert.equal(reopenIndex < reopenedSessionIndex, true);
assert.equal(reopenedSessionIndex < runtimePanelIndex, true);
assert.equal(runtimePanelIndex < markClickIndex, true);
assert.equal(markClickIndex < selectedValueIndex, true);
assert.equal(selectedValueIndex < detailActionIndex, true);
assert.equal(detailActionIndex < hostIntentIndex, true);

console.log("report-builder-preview-reopen-authored-chart-saved-record-detail-scenario-assets ✓ seeded authored chart saved-record reopens with channel detail action resolution");
