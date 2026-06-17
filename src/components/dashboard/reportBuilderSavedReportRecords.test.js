import assert from "node:assert/strict";

import {
    matchesReportBuilderSavedPayloadSourceIdentity,
    normalizeReportBuilderSavedPayloadSourceIdentity,
    normalizeReportBuilderSavedReportRecord,
    normalizeReportBuilderSavedReportRecords,
    resolveReportBuilderSavedReportRecordByReportId,
    resolveReportBuilderSavedReportRecordBySource,
} from "./reportBuilderSavedReportRecords.js";

const savedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_forecasting_q3",
    savedAt: 9100,
    title: "Forecasting Q3",
    sourceArtifactId: "forecasting_q3_inventory_ladder",
    sourceSession: {
        sourceRef: {
            templateId: "forecast_inventory_brief",
            templateLabel: "Forecast Inventory Brief",
        },
    },
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

const exportRequest = {
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
    reportSpec: savedReportPayload.reportSpec,
    reportFill: {
        version: 1,
        kind: "reportFill",
    },
    reportPrint: {
        version: 1,
        kind: "reportPrint",
        title: "Forecasting Q3",
    },
};

assert.deepEqual(normalizeReportBuilderSavedPayloadSourceIdentity(savedReportPayload), {
    payloadId: "rbreport_forecasting_q3",
    sourceArtifactId: "forecasting_q3_inventory_ladder",
    reportId: "forecastingQ3",
});

assert.equal(matchesReportBuilderSavedPayloadSourceIdentity(
    { payloadId: "rbreport_forecasting_q3", sourceArtifactId: "forecasting_q3_inventory_ladder", reportId: "forecastingQ3" },
    { payloadId: "rbreport_forecasting_q3", sourceArtifactId: "other", reportId: "other" },
), true);

const normalizedPlainRecord = normalizeReportBuilderSavedReportRecord(savedReportPayload, {
    documentVersion: 4,
});
assert.equal(normalizedPlainRecord.reportId, "forecastingQ3");
assert.equal(normalizedPlainRecord.templateId, "forecast_inventory_brief");
assert.equal(normalizedPlainRecord.exportable, false);

const normalizedRichRecord = normalizeReportBuilderSavedReportRecord({
    documentVersion: 4,
    savedReportPayload,
    exportRequest,
});
assert.equal(normalizedRichRecord.exportable, true);
assert.equal(normalizedRichRecord.exportRequest.source.payloadId, "rbreport_forecasting_q3");

const normalizedRecords = normalizeReportBuilderSavedReportRecords([
    savedReportPayload,
    {
        documentVersion: 4,
        savedReportPayload,
        exportRequest,
    },
]);
assert.equal(normalizedRecords.length, 2);
assert.equal(resolveReportBuilderSavedReportRecordByReportId(normalizedRecords, "forecastingQ3")?.reportId, "forecastingQ3");
assert.equal(resolveReportBuilderSavedReportRecordBySource(normalizedRecords, {
    payloadId: "rbreport_forecasting_q3",
})?.exportRequest?.source?.payloadId, "rbreport_forecasting_q3");

console.log("reportBuilderSavedReportRecords ✓ normalizes plain and rich saved report records with shared source identity");
