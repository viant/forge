import assert from "node:assert/strict";

import { buildReportBuilderSavedReportState } from "./reportBuilderSavedReportState.js";

const plainSavedPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_forecasting_q3",
    sourceArtifactId: "forecasting_q3_inventory_ladder",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "forecastingQ3",
        title: "Forecasting Q3",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
};

const richSavedRecord = {
    documentVersion: 4,
    savedReportPayload: plainSavedPayload,
    exportRequest: {
        version: 1,
        kind: "reportExportRequest",
        target: { format: "pdf" },
        source: {
            from: "savedPayload",
            artifactKind: "reportBuilder.savedReportPayload",
            artifactRef: "reportBuilder.savedReportPayload://rbreport_forecasting_q3",
            title: "Forecasting Q3",
            payloadId: "rbreport_forecasting_q3",
            sourceArtifactId: "forecasting_q3_inventory_ladder",
            reportId: "forecastingQ3",
            documentVersion: 4,
        },
        reportSpec: plainSavedPayload.reportSpec,
        reportFill: { version: 1, kind: "reportFill" },
        reportPrint: { version: 1, kind: "reportPrint", title: "Forecasting Q3" },
    },
};

const state = buildReportBuilderSavedReportState({
    savedReportPayload: plainSavedPayload,
    currentSavedRecord: richSavedRecord,
    configuredSavedPayloads: [richSavedRecord],
    reopenedSource: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_forecasting_q3",
        sourceArtifactId: "forecasting_q3_inventory_ladder",
    },
    selectedListEntry: {
        reportRef: { reportId: "forecastingQ3" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_forecasting_q3",
            sourceArtifactId: "forecasting_q3_inventory_ladder",
        },
    },
});

assert.equal(state.rawLocalSavedPayloads.length, 3);
assert.equal(state.localSavedReportRecords.length, 3);
assert.equal(state.currentSavedRecord?.exportable, true);
assert.equal(state.reopenedSavedRecord?.exportable, true);
assert.equal(state.selectedListEntrySavedRecord?.exportable, true);
assert.equal(state.savedReportPayloadExportRequest?.source?.payloadId, "rbreport_forecasting_q3");
assert.equal(state.reopenedExportRequest?.source?.payloadId, "rbreport_forecasting_q3");
assert.equal(state.selectedListEntryExportRequest?.source?.payloadId, "rbreport_forecasting_q3");
state.reopenedExportRequest.source.payloadId = "mutated";
assert.equal(richSavedRecord.exportRequest.source.payloadId, "rbreport_forecasting_q3");

const plainOnlyState = buildReportBuilderSavedReportState({
    savedReportPayload: plainSavedPayload,
    configuredSavedPayloads: [],
    reopenedSource: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_forecasting_q3",
    },
});

assert.equal(plainOnlyState.currentSavedRecord?.exportable, false);
assert.equal(plainOnlyState.savedReportPayloadExportRequest, null);
assert.equal(plainOnlyState.reopenedExportRequest, null);

const fallbackReopenedState = buildReportBuilderSavedReportState({
    savedReportPayload: null,
    configuredSavedPayloads: [richSavedRecord],
    reopenedSource: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "missing_payload_id",
        sourceArtifactId: "missing_source_artifact",
    },
    reopenedReportId: "forecastingQ3",
});

assert.equal(fallbackReopenedState.reopenedSavedRecord?.reportId, "forecastingQ3");
assert.equal(fallbackReopenedState.reopenedSavedRecord?.exportable, true);
assert.equal(fallbackReopenedState.reopenedExportRequest?.source?.payloadId, "rbreport_forecasting_q3");

const emptyFallbackState = buildReportBuilderSavedReportState({
    savedReportPayload: null,
    configuredSavedPayloads: [
        {
            reportId: "",
            title: "Empty Report Id",
            documentVersion: 1,
            savedAt: 1,
            document: { version: 1, kind: "reportDocument", id: "ignored" },
            source: { kind: "reportBuilder.savedReportPayload", payloadId: "ignored" },
            exportRequest: richSavedRecord.exportRequest,
        },
    ],
    reopenedSource: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "missing_payload_id",
    },
    reopenedReportId: "",
});

assert.equal(emptyFallbackState.reopenedSavedRecord, null);
assert.equal(emptyFallbackState.reopenedExportRequest, null);

console.log("reportBuilderSavedReportState ✓ centralizes local saved record normalization and export availability resolution");
