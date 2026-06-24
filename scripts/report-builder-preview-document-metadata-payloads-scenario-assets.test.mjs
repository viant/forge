import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-document-metadata-payloads.scenario.mjs";

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
  scenario.steps.some((step) => step?.type === "fillSelector" && String(step.selector || "").includes("Report document description") && String(step.value || "").includes("Authored payload metadata visibility.")),
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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Create ReportDocument payload: Executive Snapshot")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Update ReportDocument payload: Executive Snapshot")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Update conflict diagnostic: Executive Snapshot")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("document-metadata-payloads")),
  true,
);

const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const prepareCreateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare create payload");
const inspectCreateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect create payload");
const expectedVersionIndex = findStepIndex((step) => step?.type === "fillSelector" && String(step.selector || "").includes("Expected version") && String(step.value || "") === "7");
const prepareUpdateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare update payload");
const inspectUpdateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect update payload");
const currentVersionIndex = findStepIndex((step) => step?.type === "fillSelector" && String(step.selector || "").includes("Current version") && String(step.value || "") === "9");
const prepareConflictIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare conflict diagnostic");
const inspectConflictIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect conflict diagnostic");
const screenshotIndex = findStepIndex((step) => step?.type === "screenshot" && String(step.file || "").includes("document-metadata-payloads"));

assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(prepareCreateIndex, -1);
assert.notEqual(inspectCreateIndex, -1);
assert.notEqual(expectedVersionIndex, -1);
assert.notEqual(prepareUpdateIndex, -1);
assert.notEqual(inspectUpdateIndex, -1);
assert.notEqual(currentVersionIndex, -1);
assert.notEqual(prepareConflictIndex, -1);
assert.notEqual(inspectConflictIndex, -1);
assert.notEqual(screenshotIndex, -1);

assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < prepareCreateIndex, true);
assert.equal(prepareCreateIndex < inspectCreateIndex, true);
assert.equal(inspectCreateIndex < expectedVersionIndex, true);
assert.equal(expectedVersionIndex < prepareUpdateIndex, true);
assert.equal(prepareUpdateIndex < inspectUpdateIndex, true);
assert.equal(inspectUpdateIndex < currentVersionIndex, true);
assert.equal(currentVersionIndex < prepareConflictIndex, true);
assert.equal(prepareConflictIndex < inspectConflictIndex, true);

const createWindow = getWindow(prepareCreateIndex, expectedVersionIndex);
const updateWindow = getWindow(prepareUpdateIndex, currentVersionIndex);
const conflictWindow = getWindow(prepareConflictIndex, screenshotIndex);

function windowHasText(windowSteps, text, type = "waitForDomContains") {
  return windowSteps.some((step) => step?.type === type && String(step.text || "").includes(text));
}

function windowFindIndex(windowSteps, predicate) {
  return windowSteps.findIndex(predicate);
}

assert.equal(windowHasText(createWindow, "\"kind\": \"createReportDocumentPayload\"", "assertDomNotContains"), true);
assert.equal(windowHasText(createWindow, "\"kind\": \"createReportDocumentPayload\""), true);
assert.equal(windowHasText(createWindow, "\"title\": \"Executive Snapshot\""), true);
assert.equal(windowHasText(createWindow, "\"subtitle\": \"Weekly Rollup\""), true);
assert.equal(windowHasText(createWindow, "\"description\": \"Authored payload metadata visibility.\""), true);

assert.equal(windowHasText(updateWindow, "\"kind\": \"updateReportDocumentPayload\"", "assertDomNotContains"), true);
assert.equal(windowHasText(updateWindow, "\"kind\": \"updateReportDocumentPayload\""), true);
assert.equal(windowHasText(updateWindow, "\"title\": \"Executive Snapshot\""), true);
assert.equal(windowHasText(updateWindow, "\"subtitle\": \"Weekly Rollup\""), true);
assert.equal(windowHasText(updateWindow, "\"description\": \"Authored payload metadata visibility.\""), true);

assert.equal(windowHasText(conflictWindow, "\"kind\": \"updateReportDocumentConflictDiagnostic\"", "assertDomNotContains"), true);
assert.equal(windowHasText(conflictWindow, "\"kind\": \"updateReportDocumentConflictDiagnostic\""), true);
assert.equal(windowHasText(conflictWindow, "\"title\": \"Executive Snapshot\""), true);
assert.equal(windowHasText(conflictWindow, "\"subtitle\": \"Weekly Rollup\""), true);
assert.equal(windowHasText(conflictWindow, "\"description\": \"Authored payload metadata visibility.\""), true);

const createHiddenIndex = windowFindIndex(createWindow, (step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"createReportDocumentPayload\""));
const createInspectIndex = windowFindIndex(createWindow, (step) => step?.type === "clickRole" && step?.name === "Inspect create payload");
const createTitleIndex = windowFindIndex(createWindow, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"title\": \"Executive Snapshot\""));
const createKindIndex = windowFindIndex(createWindow, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"createReportDocumentPayload\""));
const createSubtitleIndex = windowFindIndex(createWindow, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"subtitle\": \"Weekly Rollup\""));
const createDescriptionIndex = windowFindIndex(createWindow, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"description\": \"Authored payload metadata visibility.\""));

assert.notEqual(createHiddenIndex, -1);
assert.notEqual(createInspectIndex, -1);
assert.notEqual(createTitleIndex, -1);
assert.notEqual(createKindIndex, -1);
assert.notEqual(createSubtitleIndex, -1);
assert.notEqual(createDescriptionIndex, -1);
assert.equal(createHiddenIndex < createInspectIndex, true);
assert.equal(createInspectIndex < createTitleIndex, true);
assert.equal(createInspectIndex < createKindIndex, true);
assert.equal(createInspectIndex < createSubtitleIndex, true);
assert.equal(createInspectIndex < createDescriptionIndex, true);

const updateHiddenIndex = windowFindIndex(updateWindow, (step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"updateReportDocumentPayload\""));
const updateInspectIndex = windowFindIndex(updateWindow, (step) => step?.type === "clickRole" && step?.name === "Inspect update payload");
const updateTitleIndex = windowFindIndex(updateWindow, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"title\": \"Executive Snapshot\""));
const updateKindIndex = windowFindIndex(updateWindow, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"updateReportDocumentPayload\""));
const updateSubtitleIndex = windowFindIndex(updateWindow, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"subtitle\": \"Weekly Rollup\""));
const updateDescriptionIndex = windowFindIndex(updateWindow, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"description\": \"Authored payload metadata visibility.\""));

assert.notEqual(updateHiddenIndex, -1);
assert.notEqual(updateInspectIndex, -1);
assert.notEqual(updateTitleIndex, -1);
assert.notEqual(updateKindIndex, -1);
assert.notEqual(updateSubtitleIndex, -1);
assert.notEqual(updateDescriptionIndex, -1);
assert.equal(updateHiddenIndex < updateInspectIndex, true);
assert.equal(updateInspectIndex < updateTitleIndex, true);
assert.equal(updateInspectIndex < updateKindIndex, true);
assert.equal(updateInspectIndex < updateSubtitleIndex, true);
assert.equal(updateInspectIndex < updateDescriptionIndex, true);

const conflictHiddenIndex = windowFindIndex(conflictWindow, (step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"updateReportDocumentConflictDiagnostic\""));
const conflictInspectIndex = windowFindIndex(conflictWindow, (step) => step?.type === "clickRole" && step?.name === "Inspect conflict diagnostic");
const conflictTitleIndex = windowFindIndex(conflictWindow, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"title\": \"Executive Snapshot\""));
const conflictSubtitleIndex = windowFindIndex(conflictWindow, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"subtitle\": \"Weekly Rollup\""));
const conflictDescriptionIndex = windowFindIndex(conflictWindow, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"description\": \"Authored payload metadata visibility.\""));
const conflictKindIndex = windowFindIndex(conflictWindow, (step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"updateReportDocumentConflictDiagnostic\""));

assert.notEqual(conflictHiddenIndex, -1);
assert.notEqual(conflictInspectIndex, -1);
assert.notEqual(conflictTitleIndex, -1);
assert.notEqual(conflictSubtitleIndex, -1);
assert.notEqual(conflictDescriptionIndex, -1);
assert.notEqual(conflictKindIndex, -1);
assert.equal(conflictHiddenIndex < conflictInspectIndex, true);
assert.equal(conflictInspectIndex < conflictTitleIndex, true);
assert.equal(conflictInspectIndex < conflictSubtitleIndex, true);
assert.equal(conflictInspectIndex < conflictDescriptionIndex, true);
assert.equal(conflictInspectIndex < conflictKindIndex, true);

console.log("report-builder-preview-document-metadata-payloads-scenario-assets ✓ document metadata inspectors stay ordered and preserve authored metadata across create/update/conflict views")
