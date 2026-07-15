import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import flatModelScenario from "../tests/report-builder-preview-semantic-reopen-report-document-flat-model-runtime-binding.scenario.mjs";
import directSeriesDraftExportScenario from "../tests/report-builder-preview-semantic-reopen-report-document-direct-series-detail-selection-rows.scenario.mjs";
import importedSavedViewExportScenario from "../tests/report-builder-preview-semantic-import-saved-view-export-request.scenario.mjs";
import importedPublishedSnapshotExportScenario from "../tests/report-builder-preview-semantic-import-published-snapshot-export-request.scenario.mjs";
import listEntrySavedViewExportScenario from "../tests/report-builder-preview-semantic-list-entry-saved-view-export-request.scenario.mjs";
import listEntryPublishedSnapshotExportScenario from "../tests/report-builder-preview-semantic-list-entry-published-snapshot-export-request.scenario.mjs";
import reopenedExportScenario from "../tests/report-builder-preview-semantic-reopen-report-document-location-chart-export-request.scenario.mjs";
import semanticModelReloadScenario from "../tests/report-builder-preview-semantic-reopen-report-document-model-error-runtime-reload.scenario.mjs";
import reopenedResponseScenario from "../tests/report-builder-preview-semantic-reopen-report-document-response.scenario.mjs";
import reopenedChartResponseScenario from "../tests/report-builder-preview-semantic-reopen-report-document-chart-response.scenario.mjs";
import reopenedLocationResponseScenario from "../tests/report-builder-preview-semantic-reopen-report-document-location-response.scenario.mjs";
import reopenedModelErrorUpdatePayloadScenario from "../tests/report-builder-preview-semantic-reopen-report-document-model-error-update-payload.scenario.mjs";
import reopenedLocationTableRuntimeResumeScenario from "../tests/report-builder-preview-semantic-reopen-report-document-location-table-runtime-surface-resume.scenario.mjs";
import runtimeCapacityInventoryLadderScenario from "../tests/report-builder-preview-semantic-runtime-capacity-inventory-ladder.scenario.mjs";
import runtimeCapacityLocationLadderScenario from "../tests/report-builder-preview-semantic-runtime-capacity-location-ladder.scenario.mjs";
import savedExportScenario from "../tests/report-builder-preview-semantic-authored-geo-export-request.scenario.mjs";
import getRequestMetadataScenario from "../tests/report-builder-preview-semantic-get-report-document-request-metadata.scenario.mjs";
import createPayloadScenario from "../tests/report-builder-preview-semantic-create-report-document-payload.scenario.mjs";
import updateConflictDiagnosticScenario from "../tests/report-builder-preview-semantic-update-report-document-conflict-diagnostic.scenario.mjs";

for (const scenario of [flatModelScenario, directSeriesDraftExportScenario]) {
  assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
  assert.deepEqual(scenario.viewport, {
    width: 1280,
    height: 960,
  });
  assert.equal(Array.isArray(scenario.steps), true);
  assert.ok(scenario.steps.length > 10);
}

for (const scenario of [
  importedSavedViewExportScenario,
  importedPublishedSnapshotExportScenario,
  listEntrySavedViewExportScenario,
  listEntryPublishedSnapshotExportScenario,
]) {
  assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
  assert.deepEqual(scenario.viewport, {
    width: 1280,
    height: 960,
  });
  assert.equal(Array.isArray(scenario.steps), true);
  assert.ok(scenario.steps.length > 8);
}

const expressions = flatModelScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  expressions.some((expression) => expression.includes("replaceSemanticModelBehaviors") && expression.includes("Audience Delivery")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("appendSeededSavedReportPayloadRecord") && expression.includes("flatAudienceSegmentQ3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("harmonizer://feature/user.segment.index")),
  true,
);
assert.equal(
  flatModelScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic binding: Audience Delivery • Entity: Audience Line Delivery")),
  true,
);
assert.equal(
  flatModelScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Flat Audience Segment Q3 for editing.")),
  true,
);
assert.equal(
  flatModelScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("flat-model-runtime-binding")),
  true,
);

const directSeriesExpressions = directSeriesDraftExportScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  directSeriesExpressions.some((expression) => expression.includes("Draft export request summary") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  directSeriesExpressions.some((expression) => expression.includes("__directSeriesDraftExportBaseline")),
  true,
);
assert.equal(
  directSeriesDraftExportScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("direct-series-detail-selection-rows")),
  true,
);

// The scenario must seed the direct-series fixture and hand its list response straight to the
// preview API rather than routing through the retired measure-pill/save-artifact draft-prep UI.
assert.equal(
  directSeriesExpressions.some((expression) => expression.includes("capacityDirectSeriesFixtureState.js") && expression.includes("buildCapacityDirectSeriesFixtureState")),
  true,
);
assert.equal(
  directSeriesExpressions.some((expression) => expression.includes("replacePreparedListReportDocumentsResponse") && expression.includes("capacityKpiBlendByDateQ3")),
  true,
);
assert.equal(
  directSeriesDraftExportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "") === "Selected entry: Capacity KPI Blend Q3"),
  true,
);
assert.equal(
  directSeriesDraftExportScenario.steps.some((step) => (
    (step?.type === "clickSelectorContains" && String(step?.selector || "").includes("measure-pill"))
    || (step?.type === "clickRole" && String(step?.name || "") === "Save artifact")
    || (step?.type === "clickRole" && String(step?.name || "") === "Prepare report payload")
  )),
  false,
);

const directSeriesSeedFixtureIndex = directSeriesDraftExportScenario.steps.findIndex((step) => (
  (step?.type === "eval" || step?.type === "waitForEval")
  && String(step?.expression || "").includes("buildCapacityDirectSeriesFixtureState")
  && String(step?.expression || "").includes("replaceSeededSavedReportPayloads")
));
const directSeriesReplaceListResponseIndex = directSeriesDraftExportScenario.steps.findIndex((step) => (
  (step?.type === "eval" || step?.type === "waitForEval")
  && String(step?.expression || "").includes("replacePreparedListReportDocumentsResponse")
));
const directSeriesSelectedEntryIndex = directSeriesDraftExportScenario.steps.findIndex((step) => (
  step?.type === "waitForDomContains" && String(step.text || "") === "Selected entry: Capacity KPI Blend Q3"
));
const directSeriesPrepareGetRequestIndex = directSeriesDraftExportScenario.steps.findIndex((step) => (
  step?.type === "clickRole" && step?.name === "Prepare get request"
));
const directSeriesReopenIndex = directSeriesDraftExportScenario.steps.findIndex((step) => (
  step?.type === "clickRole" && step?.name === "Reopen in builder"
));

assert.notEqual(directSeriesSeedFixtureIndex, -1);
assert.notEqual(directSeriesReplaceListResponseIndex, -1);
assert.notEqual(directSeriesSelectedEntryIndex, -1);
assert.notEqual(directSeriesPrepareGetRequestIndex, -1);
assert.notEqual(directSeriesReopenIndex, -1);
assert.equal(directSeriesSeedFixtureIndex < directSeriesReplaceListResponseIndex, true);
assert.equal(directSeriesReplaceListResponseIndex < directSeriesSelectedEntryIndex, true);
assert.equal(directSeriesSelectedEntryIndex < directSeriesPrepareGetRequestIndex, true);
assert.equal(directSeriesPrepareGetRequestIndex < directSeriesReopenIndex, true);

const importedSavedViewExpressions = importedSavedViewExportScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  importedSavedViewExpressions.some((expression) => expression.includes("reportBuilder.savedView") && expression.includes("saved_view_capacityTrendQ3")),
  true,
);
assert.equal(
  importedSavedViewExportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("imported saved-view")),
  true,
);

const importedPublishedSnapshotExpressions = importedPublishedSnapshotExportScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  importedPublishedSnapshotExpressions.some((expression) => expression.includes("reportBuilder.publishedSnapshot") && expression.includes("published_snapshot_capacityTrendQ3")),
  true,
);
assert.equal(
  importedPublishedSnapshotExportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("imported published-snapshot")),
  true,
);

const listEntrySavedViewExpressions = listEntrySavedViewExportScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  listEntrySavedViewExpressions.some((expression) => expression.includes("reportBuilder.savedView") && expression.includes("saved_view_capacityTrendQ3")),
  true,
);
assert.equal(
  listEntrySavedViewExpressions.some((expression) => expression.includes("reportBuilder.publishedSnapshot") && expression.includes("published_snapshot_capacityTrendQ3")),
  true,
);
assert.equal(
  listEntrySavedViewExportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3 Saved View")),
  true,
);

const listEntryPublishedSnapshotExpressions = listEntryPublishedSnapshotExportScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  listEntryPublishedSnapshotExpressions.some((expression) => expression.includes("reportBuilder.publishedSnapshot") && expression.includes("published_snapshot_capacityTrendQ3")),
  true,
);
assert.equal(
  listEntryPublishedSnapshotExpressions.some((expression) => expression.includes("reportBuilder.savedView") && expression.includes("saved_view_capacityTrendQ3")),
  true,
);
assert.equal(
  listEntryPublishedSnapshotExportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3 Published Snapshot")),
  true,
);

const savedExportExpressions = (Array.isArray(savedExportScenario.steps) ? savedExportScenario.steps : [])
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  savedExportExpressions.some((expression) => expression.includes("Saved export request summary") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);

const reopenedExportExpressions = (Array.isArray(reopenedExportScenario.steps) ? reopenedExportScenario.steps : [])
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  reopenedExportExpressions.some((expression) => expression.includes("[aria-label=\"Reopened export request summary\"]") && expression.includes("Capacity Locations Top Markets Q3 Live") && expression.includes("bookmark.primaryChart") && expression.includes("Runtime Note")),
  true,
);

const semanticModelReloadExpressions = (Array.isArray(semanticModelReloadScenario.steps) ? semanticModelReloadScenario.steps : [])
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  semanticModelReloadScenario.steps.some((step) => step?.type === "clickRole" && step?.role === "button" && step?.name === "Retry model load"),
  true,
);
assert.equal(
  semanticModelReloadExpressions.some((expression) => expression.includes("metrics.getModelCount") && expression.includes(">= 2")),
  true,
);
assert.equal(
  semanticModelReloadScenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Semantic model error: Semantic model metadata failed.")),
  true,
);
assert.equal(
  semanticModelReloadScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery")),
  true,
);

for (const scenario of [createPayloadScenario, getRequestMetadataScenario, updateConflictDiagnosticScenario]) {
  assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
  assert.deepEqual(scenario.viewport, {
    width: 1280,
    height: 960,
  });
  assert.equal(Array.isArray(scenario.steps), true);
  assert.ok(scenario.steps.length > 15);
}

const createPayloadExpressions = (Array.isArray(createPayloadScenario.steps) ? createPayloadScenario.steps : [])
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  createPayloadExpressions.some((expression) => expression.includes("Saved report payload: Report Builder Demo") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  createPayloadExpressions.some((expression) => expression.includes("Create ReportDocument payload: Report Builder Demo") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);

const getRequestMetadataExpressions = (Array.isArray(getRequestMetadataScenario.steps) ? getRequestMetadataScenario.steps : [])
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  getRequestMetadataExpressions.some((expression) => expression.includes("Saved report payload: Executive Snapshot") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  getRequestMetadataExpressions.some((expression) => expression.includes("Get ReportDocument request: Executive Snapshot") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);

const updateConflictDiagnosticExpressions = (Array.isArray(updateConflictDiagnosticScenario.steps) ? updateConflictDiagnosticScenario.steps : [])
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  updateConflictDiagnosticExpressions.some((expression) => expression.includes("Saved report payload: Executive Snapshot") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  updateConflictDiagnosticExpressions.some((expression) => expression.includes("Update ReportDocument payload: Executive Snapshot") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  updateConflictDiagnosticExpressions.some((expression) => expression.includes("Update conflict diagnostic: Executive Snapshot") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);

for (const scenario of [
  reopenedResponseScenario,
  reopenedChartResponseScenario,
  reopenedLocationResponseScenario,
  reopenedModelErrorUpdatePayloadScenario,
]) {
  assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
  assert.deepEqual(scenario.viewport, {
    width: 1280,
    height: 960,
  });
  assert.equal(Array.isArray(scenario.steps), true);
  assert.ok(scenario.steps.length > 20);
}

assert.equal(
  reopenedResponseScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic Binding")),
  true,
);
assert.equal(
  reopenedChartResponseScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic Binding")),
  true,
);
assert.equal(
  reopenedLocationResponseScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic Binding")),
  true,
);
assert.equal(
  reopenedModelErrorUpdatePayloadScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic Binding")),
  true,
);

for (const scenario of [
  runtimeCapacityInventoryLadderScenario,
  runtimeCapacityLocationLadderScenario,
  reopenedLocationTableRuntimeResumeScenario,
]) {
  assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
  assert.deepEqual(scenario.viewport, {
    width: 1280,
    height: 960,
  });
  assert.equal(Array.isArray(scenario.steps), true);
  assert.ok(scenario.steps.length > 20);
}

assert.equal(
  runtimeCapacityInventoryLadderScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").toUpperCase().includes("SEMANTIC BINDING")),
  true,
);
assert.equal(
  runtimeCapacityLocationLadderScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic Binding")),
  true,
);
assert.equal(
  reopenedLocationTableRuntimeResumeScenario.steps.filter((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic Binding")).length >= 2,
  true,
);

console.log("report-builder-preview-scenario-assets ✓ flat semantic model, export flows, semantic metadata payloads, reopened responses, runtime ladder/resume flows, and semantic model retry scenarios preserve the expected semantic visibility assertions");
