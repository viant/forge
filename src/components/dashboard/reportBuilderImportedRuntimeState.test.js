import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildReportBuilderRuntimePreview } from "./reportBuilderRuntimePreview.js";
import { buildReportFillFromReportSpec } from "../../reporting/reportFillModel.js";
import { buildReportPrintFromReportFill } from "../../reporting/reportPrintModel.js";
import {
    buildImportedPipelineSummary,
    buildImportedStandaloneReportFillSummary,
    buildImportedStandaloneReportPrintSummary,
    resolveImportedPipelineCompanionFillCompatibility,
    resolveImportedPipelineCompanionPrintCompatibility,
    resolveImportedPipelineRuntimeState,
} from "./reportBuilderImportedRuntimeState.js";

const savedReportRecordFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-direct-series-saved-report-record-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);
const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);

const reportSpec = savedReportRecordFixture.savedReportPayload.reportSpec;
const matchingRows = savedReportRecordFixture.exportRequest.reportFill.datasets[0].rows;
const importedStandaloneReportFill = buildReportFillFromReportSpec(reportSpec, {
    primary: {
        rows: matchingRows,
        hasMore: false,
        diagnostics: [],
    },
});
const importedStandaloneReportPrint = buildReportPrintFromReportFill({
    reportSpec,
    reportFill: importedStandaloneReportFill,
});

const importedPipelinePreview = {
    kind: "reportSpec",
    title: reportSpec.title,
    fileName: "capacity-kpi-blend.report-spec.json",
    blockCount: reportSpec.blocks.length,
    datasetCount: reportSpec.datasets.length,
    payload: reportSpec,
    runtimeArtifact: buildReportBuilderRuntimePreview({
        model: {
            reportSpec,
        },
        rows: [],
        hasMore: false,
        runtimeTitle: reportSpec.title,
        runtimeSubtitle: "Local runtime preview compiled directly from the imported ReportSpec file.",
    }),
};

assert.deepEqual(buildImportedStandaloneReportFillSummary(importedStandaloneReportFill), {
    title: "Report",
    datasetCount: 1,
    blockCount: 6,
    rowCount: 8,
    diagnosticCount: 0,
    specVersion: 1,
    specHash: importedStandaloneReportFill.specHash,
});

assert.deepEqual(buildImportedStandaloneReportPrintSummary(importedStandaloneReportPrint), {
    title: "Capacity KPI Blend Q3",
    pageCount: importedStandaloneReportPrint.pages.length,
    bookmarkCount: importedStandaloneReportPrint.bookmarks.length,
    diagnosticCount: 0,
    pageWidth: importedStandaloneReportPrint.pageGeometry.width,
    pageHeight: importedStandaloneReportPrint.pageGeometry.height,
    specVersion: importedStandaloneReportPrint.specVersion,
    specHash: importedStandaloneReportPrint.specHash,
});

assert.deepEqual(buildImportedPipelineSummary(importedPipelinePreview), {
    kind: "reportSpec",
    title: "Capacity KPI Blend Q3",
    fileName: "capacity-kpi-blend.report-spec.json",
    blockCount: importedPipelinePreview.blockCount,
    datasetCount: importedPipelinePreview.datasetCount,
    specVersion: 1,
    specHash: importedStandaloneReportFill.specHash,
});

assert.deepEqual(resolveImportedPipelineCompanionFillCompatibility({
    importedPipelinePreview,
    importedStandaloneReportFill,
}), {
    available: true,
    compatible: true,
    tone: "info",
    message: "Imported ReportFill matches the imported ReportSpec by specVersion and specHash. Attach it explicitly to use real filled rows.",
});

assert.deepEqual(resolveImportedPipelineCompanionPrintCompatibility({
    importedPipelinePreview,
    importedStandaloneReportPrint,
}), {
    available: true,
    compatible: true,
    tone: "info",
    message: "Imported ReportPrint matches the imported ReportSpec by specVersion and specHash.",
});

const mismatchedVersionFill = {
    ...importedStandaloneReportFill,
    specVersion: 2,
};

assert.deepEqual(resolveImportedPipelineCompanionFillCompatibility({
    importedPipelinePreview,
    importedStandaloneReportFill: mismatchedVersionFill,
}), {
    available: true,
    compatible: false,
    tone: "warning",
    message: "Imported ReportFill does not match the current imported ReportSpec (spec v2 vs v1).",
});

const mismatchedHashFill = {
    ...importedStandaloneReportFill,
    specHash: "fnv1a:deadbeef",
};

const expectedSpecHashSuffix = String(importedStandaloneReportFill.specHash || "").split(":").pop();

assert.deepEqual(resolveImportedPipelineCompanionFillCompatibility({
    importedPipelinePreview,
    importedStandaloneReportFill: mismatchedHashFill,
}), {
    available: true,
    compatible: false,
    tone: "warning",
    message: `Imported ReportFill does not match the current imported ReportSpec (hash mismatch (deadbeef vs ${expectedSpecHashSuffix})).`,
});

const mismatchedVersionPrint = {
    ...importedStandaloneReportPrint,
    specVersion: 2,
};

assert.deepEqual(resolveImportedPipelineCompanionPrintCompatibility({
    importedPipelinePreview,
    importedStandaloneReportPrint: mismatchedVersionPrint,
}), {
    available: true,
    compatible: false,
    tone: "warning",
    message: "Imported ReportPrint does not match the current imported ReportSpec (spec v2 vs v1).",
});

const mismatchedHashPrint = {
    ...importedStandaloneReportPrint,
    specHash: "fnv1a:deadbeef",
};

assert.deepEqual(resolveImportedPipelineCompanionPrintCompatibility({
    importedPipelinePreview,
    importedStandaloneReportPrint: mismatchedHashPrint,
}), {
    available: true,
    compatible: false,
    tone: "warning",
    message: `Imported ReportPrint does not match the current imported ReportSpec (hash mismatch (deadbeef vs ${expectedSpecHashSuffix})).`,
});

const unattachedRuntimeState = resolveImportedPipelineRuntimeState({
    importedPipelinePreview,
    importedStandaloneReportFill,
    attachedRequested: false,
});

assert.equal(unattachedRuntimeState.attachedApplied, false);
assert.equal(unattachedRuntimeState.attachFailureMessage, "");
assert.equal(unattachedRuntimeState.runtimeFillSummary.attached, false);
assert.equal(unattachedRuntimeState.runtimeFillSummary.rowCount, 0);
assert.equal(unattachedRuntimeState.runtimeArtifact.reportFill.datasets[0].rows.length, 0);

const attachedRuntimeState = resolveImportedPipelineRuntimeState({
    importedPipelinePreview,
    importedStandaloneReportFill,
    attachedRequested: true,
});

assert.equal(attachedRuntimeState.attachedApplied, true);
assert.equal(attachedRuntimeState.attachFailureMessage, "");
assert.equal(attachedRuntimeState.compatibility.message, "Imported ReportFill is attached to the imported ReportSpec runtime preview.");
assert.equal(attachedRuntimeState.compatibility.attached, true);
assert.equal(attachedRuntimeState.runtimeFillSummary.attached, true);
assert.equal(attachedRuntimeState.runtimeFillSummary.rowCount, 8);
assert.equal(attachedRuntimeState.runtimeArtifact.reportFill.datasets[0].rows.length, 8);
assert.equal(attachedRuntimeState.runtimeArtifact.reportPrint.kind, "reportPrint");
assert.equal(attachedRuntimeState.runtimeArtifact.exportRequest.kind, "reportExportRequest");
assert.equal(attachedRuntimeState.runtimeArtifact.exportRequest.reportFill.datasets[0].rows.length, 8);
assert.equal(attachedRuntimeState.runtimeArtifact.runtimeBlock.dashboard.reportRuntime.reportFill.datasets[0].rows.length, 8);
assert.equal(attachedRuntimeState.runtimeArtifact.runtimeBlock.dashboard.reportRuntime.semanticBindingViewState.title, "Semantic Binding");
assert.equal(attachedRuntimeState.runtimeArtifact.runtimeBlock.dashboard.reportRuntime.semanticBindingViewState.chips.includes("Model Ad Delivery"), true);
assert.equal(attachedRuntimeState.runtimeConfig.semanticBindingViewState.title, "Semantic Binding");
assert.equal(attachedRuntimeState.runtimeArtifact.runtimeBlock.subtitle, "Local runtime preview compiled from the imported ReportSpec and attached ReportFill artifacts.");

const detachedRuntimeState = resolveImportedPipelineRuntimeState({
    importedPipelinePreview,
    importedStandaloneReportFill,
    attachedRequested: false,
});

assert.equal(detachedRuntimeState.attachedApplied, false);
assert.equal(detachedRuntimeState.attachFailureMessage, "");
assert.equal(detachedRuntimeState.compatibility.attached, false);
assert.equal(detachedRuntimeState.runtimeFillSummary.attached, false);
assert.equal(detachedRuntimeState.runtimeFillSummary.rowCount, 0);
assert.equal(detachedRuntimeState.runtimeArtifact.reportFill.datasets[0].rows.length, 0);
assert.equal(detachedRuntimeState.runtimeArtifact.exportRequest.reportFill.datasets[0].rows.length, 0);
assert.equal(detachedRuntimeState.runtimeArtifact.runtimeBlock.subtitle, "Local runtime preview compiled directly from the imported ReportSpec file.");

const failingSourceFill = {
    ...importedStandaloneReportFill,
    source: {
        kind: "dashboard.reportBuilder",
        containerId: "otherContainer",
        stateKey: "otherState",
        dataSourceRef: "demoReportSource",
    },
};

const failedAttachRuntimeState = resolveImportedPipelineRuntimeState({
    importedPipelinePreview,
    importedStandaloneReportFill: failingSourceFill,
    attachedRequested: true,
});

assert.equal(failedAttachRuntimeState.compatibility.compatible, true);
assert.equal(failedAttachRuntimeState.compatibility.attached, false);
assert.equal(failedAttachRuntimeState.attachedApplied, false);
assert.equal(
    failedAttachRuntimeState.attachFailureMessage,
    "Could not attach the imported ReportFill to the imported ReportSpec runtime preview. The preview/export stayed on the compiled preview fill.",
);
assert.equal(failedAttachRuntimeState.runtimeFillSummary.attached, false);
assert.equal(failedAttachRuntimeState.runtimeArtifact.reportFill.datasets[0].rows.length, 0);
assert.equal(failedAttachRuntimeState.runtimeArtifact.exportRequest.reportFill.datasets[0].rows.length, 0);

const importedAudienceReportSpec = audienceArtifactFixture.savedReportPayload.reportSpec;
const importedAudienceRows = audienceArtifactFixture.reportExportRequest.reportFill.datasets[0].rows;
const importedAudiencePipelinePreview = {
    kind: "reportSpec",
    title: importedAudienceReportSpec.title,
    fileName: "capacity-audience-segment.report-spec.json",
    blockCount: importedAudienceReportSpec.blocks.length,
    datasetCount: importedAudienceReportSpec.datasets.length,
    payload: importedAudienceReportSpec,
    runtimeArtifact: buildReportBuilderRuntimePreview({
        model: {
            reportSpec: importedAudienceReportSpec,
        },
        rows: [],
        hasMore: false,
        runtimeTitle: importedAudienceReportSpec.title,
        runtimeSubtitle: "Local runtime preview compiled directly from the imported ReportSpec file.",
    }),
};
const importedAudienceStandaloneReportFill = buildReportFillFromReportSpec(importedAudienceReportSpec, {
    primary: {
        rows: importedAudienceRows,
        hasMore: false,
        diagnostics: [],
    },
});
const attachedAudienceRuntimeState = resolveImportedPipelineRuntimeState({
    importedPipelinePreview: importedAudiencePipelinePreview,
    importedStandaloneReportFill: importedAudienceStandaloneReportFill,
    attachedRequested: true,
});
assert.equal(attachedAudienceRuntimeState.attachedApplied, true);
assert.equal(attachedAudienceRuntimeState.runtimeArtifact.runtimeBlock.dashboard.reportRuntime.semanticBindingViewState.title, "Semantic Binding");
assert.equal(attachedAudienceRuntimeState.runtimeArtifact.runtimeBlock.dashboard.reportRuntime.semanticBindingViewState.chips.includes("Measures Audience Index"), true);
assert.deepEqual(
    attachedAudienceRuntimeState.runtimeArtifact.exportRequest.reportSpec.semanticSummary.selectedMeasures.find((field) => field?.id === "audience_index"),
    {
        id: "audience_index",
        rawId: "audienceIndex",
        label: "Audience Index",
        format: "number",
        category: "Audience",
        definitionRef: "harmonizer://feature/user.segment.index",
        governance: {
            status: "approved",
            certification: "reviewed",
            classification: "harmonizer.audience",
        },
    },
);
assert.deepEqual(
    attachedAudienceRuntimeState.runtimeArtifact.exportRequest.reportSpec.semanticSummary.selectedParameters.find((field) => field?.id === "audience_segment"),
    {
        id: "audience_segment",
        rawId: "audienceSegmentFilter",
        label: "Audience Segment",
        category: "Audience",
        definitionRef: "harmonizer://feature/user.segment",
        governance: {
            status: "approved",
            classification: "harmonizer.audience",
        },
    },
);

console.log("reportBuilderImportedRuntimeState ✓ pairs imported ReportSpec/ReportFill artifacts with explicit compatibility and export/runtime fallback handling");
