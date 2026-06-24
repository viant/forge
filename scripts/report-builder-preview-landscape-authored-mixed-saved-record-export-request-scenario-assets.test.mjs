import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import scenario from "../tests/report-builder-preview-semantic-landscape-authored-mixed-saved-record-export-request.scenario.mjs";

const exportRequestFixture = JSON.parse(readFileSync(
  new URL("../src/reporting/fixtures/authored-landscape-mixed-report-print-fixture.v1.json", import.meta.url),
  "utf8",
));

const expectedReportPrintSignature = {
  pageGeometry: exportRequestFixture.pageGeometry,
  pages: (exportRequestFixture.pages || []).map((page) => ({
    number: page.number,
    elements: (page.elements || []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })),
    headerElements: (page.headerElements || []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })),
    footerElements: (page.footerElements || []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })),
  })),
  diagnostics: exportRequestFixture.diagnostics || [],
};

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

const exactSignatureLiteral = JSON.stringify(JSON.stringify(expectedReportPrintSignature));
const exactSignatureOccurrences = expressions.filter((expression) => expression.includes(exactSignatureLiteral)).length;

assert.equal(
  expressions.some((expression) => expression.includes("__artifactDownloadCapture")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved report payload: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("List ReportDocuments response: 7 entries")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!Array.from(select.options || []).some((option) => option.value === 'authoredLandscapeMixedPreview')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("buildAuthoredLandscapeMixedSavedReportRecord") && expression.includes("authoredLandscapeMixedPreview")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getSeededSavedReportPayloads") && expression.includes("authoredLandscapeMixedPreview")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare list response"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("option.value === 'authoredLandscapeMixedPreview'")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "selectSelector" && step?.value === "authoredLandscapeMixedPreview"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"reportId\": \"authoredLandscapeMixedPreview\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Authored Landscape Mixed Report")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("session.reportId === \"authoredLandscapeMixedPreview\"") && expression.includes("session.title === \"Authored Landscape Mixed Report\"") && expression.includes("session.documentVersion === 13")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("reportDocumentTitle === 'Authored Landscape Mixed Report'") && expression.includes("selectedMeasures.length === 2") && expression.includes("selectedMeasures.includes('totalSpend')") && expression.includes("selectedMeasures.includes('impressions')") && expression.includes("selectedDimensions.includes('eventDate')") && expression.includes("selectedDimensions.includes('channelId')") && expression.includes("viewMode === 'table'") && expression.includes("blockId === 'stateGeo'") && expression.includes("blockId === 'narrativeIntro'") && expression.includes("blockId === 'headlineKpi'")),
  true,
);
assert.equal(expressions.some((expression) => expression.includes("Authored Landscape Mixed Report-savedPayload-pdf-export-request.json")), true);
assert.equal(exactSignatureOccurrences >= 2, true);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("landscape-authored-mixed-saved-record-export-request")),
  true,
);

const preInjectionListIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("List ReportDocuments response: 7 entries"));
const preInjectionAbsentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!Array.from(select.options || []).some((option) => option.value === 'authoredLandscapeMixedPreview')"));
const injectionIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("buildAuthoredLandscapeMixedSavedReportRecord") && String(step?.expression || "").includes("authoredLandscapeMixedPreview"));
const rebuildListIndex = scenario.steps.findIndex((step, index) => index > injectionIndex && step?.type === "clickRole" && step?.name === "Prepare list response");
const rebuiltListSummaryIndex = scenario.steps.findIndex((step, index) => index > rebuildListIndex && step?.type === "waitForDomContains" && String(step?.text || "").includes("List ReportDocuments response: 8 entries"));
const injectedOptionIndex = scenario.steps.findIndex((step, index) => index > rebuiltListSummaryIndex && step?.type === "waitForEval" && String(step?.expression || "").includes("option.value === 'authoredLandscapeMixedPreview'"));
const selectInjectedIndex = scenario.steps.findIndex((step, index) => index > injectedOptionIndex && step?.type === "selectSelector" && step?.value === "authoredLandscapeMixedPreview");
const reopenIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopened ReportDocument Authored Landscape Mixed Report for editing."));
const reopenedExportVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Review export") && String(step?.expression || "").includes("Inspect export"));
const inspectExportIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Inspect export button not found in mixed reopened section."));
const geometrySummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("JSON.stringify(signature) ===") && String(step?.expression || "").includes("stateGeo__svg_page_2") && String(step?.expression || "").includes("Authored Landscape Mixed Report"));
const downloadExportIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Download export request button not found."));
const downloadedReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Authored Landscape Mixed Report-savedPayload-pdf-export-request.json"));
const geometryDownloadedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("window.__artifactDownloadCapture?.payloadReady") && String(step?.expression || "").includes("JSON.stringify(signature) ===") && String(step?.expression || "").includes("stateGeo__svg_page_2") && String(step?.expression || "").includes("Authored Landscape Mixed Report"));

assert.notEqual(preInjectionListIndex, -1);
assert.notEqual(preInjectionAbsentIndex, -1);
assert.notEqual(injectionIndex, -1);
assert.notEqual(rebuildListIndex, -1);
assert.notEqual(rebuiltListSummaryIndex, -1);
assert.notEqual(injectedOptionIndex, -1);
assert.notEqual(selectInjectedIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(reopenedExportVisibleIndex, -1);
assert.notEqual(inspectExportIndex, -1);
assert.notEqual(geometrySummaryIndex, -1);
assert.notEqual(downloadExportIndex, -1);
assert.notEqual(downloadedReadyIndex, -1);
assert.notEqual(geometryDownloadedIndex, -1);

assert.equal(preInjectionListIndex < preInjectionAbsentIndex, true);
assert.equal(preInjectionAbsentIndex < injectionIndex, true);
assert.equal(injectionIndex < rebuildListIndex, true);
assert.equal(rebuildListIndex < rebuiltListSummaryIndex, true);
assert.equal(rebuiltListSummaryIndex < injectedOptionIndex, true);
assert.equal(injectedOptionIndex < selectInjectedIndex, true);
assert.equal(selectInjectedIndex < reopenIndex, true);
assert.equal(reopenIndex < reopenedExportVisibleIndex, true);
assert.equal(reopenedExportVisibleIndex < inspectExportIndex, true);
assert.equal(inspectExportIndex < geometrySummaryIndex, true);
assert.equal(geometrySummaryIndex < downloadExportIndex, true);
assert.equal(downloadExportIndex < downloadedReadyIndex, true);
assert.equal(downloadedReadyIndex < geometryDownloadedIndex, true);

console.log("report-builder-preview-landscape-authored-mixed-saved-record-export-request-scenario-assets ✓ authored mixed landscape saved-record export stays reopenable, inspectable, and geometry-stable");
