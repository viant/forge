import assert from "node:assert/strict";

import {
    buildReportBuilderExportRequestDownload,
    buildReportBuilderExportRequestInspectorState,
    buildReportBuilderExportRequestSummary,
    resolveReportBuilderExportHandler,
    resolveReportBuilderSavedPayloadExportRequest,
    resolveReportBuilderSavedPayloadExportRequestBySource,
    serializeReportBuilderExportRequest,
} from "./reportBuilderExportRequest.js";

const exportRequest = {
    version: 1,
    kind: "reportExportRequest",
    target: {
        format: "pdf",
    },
    source: {
        from: "savedPayload",
        artifactKind: "reportBuilder.savedReportPayload",
        artifactRef: "reportBuilder.savedReportPayload://rbreport_forecasting_q3",
        title: "Forecasting Q3",
        reportId: "forecastingQ3",
        payloadId: "rbreport_forecasting_q3",
        sourceArtifactId: "forecasting_q3",
        documentVersion: 4,
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        title: "Forecasting Q3",
    },
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

assert.deepEqual(buildReportBuilderExportRequestSummary(exportRequest), {
    title: "Forecasting Q3",
    format: "PDF",
    from: "savedPayload",
    artifactRef: "reportBuilder.savedReportPayload://rbreport_forecasting_q3",
    payloadId: "rbreport_forecasting_q3",
    reportId: "forecastingQ3",
    documentVersion: 4,
    hasReportPrint: true,
});

assert.match(
    serializeReportBuilderExportRequest(exportRequest),
    /"kind": "reportExportRequest"/,
);

assert.deepEqual(buildReportBuilderExportRequestInspectorState(exportRequest), {
    title: "Forecasting Q3",
    format: "PDF",
    from: "savedPayload",
    artifactRef: "reportBuilder.savedReportPayload://rbreport_forecasting_q3",
    payloadId: "rbreport_forecasting_q3",
    reportId: "forecastingQ3",
    documentVersion: 4,
    hasReportPrint: true,
    content: serializeReportBuilderExportRequest(exportRequest),
});

assert.deepEqual(buildReportBuilderExportRequestDownload(exportRequest), {
    filename: "Forecasting Q3-savedPayload-pdf-export-request.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderExportRequest(exportRequest),
});

assert.equal(resolveReportBuilderExportHandler({
    handlers: {
        reportExport: {
            submitRequest() {},
        },
    },
}).submitRequest instanceof Function, true);
assert.equal(resolveReportBuilderExportHandler({ handlers: {} }), null);

const savedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_forecasting_q3",
    sourceArtifactId: "forecasting_q3",
    reportDocument: {
        id: "forecastingQ3",
        title: "Forecasting Q3",
    },
};

const matchingRichRecord = {
    savedReportPayload,
    exportRequest,
};

assert.deepEqual(
    resolveReportBuilderSavedPayloadExportRequest(savedReportPayload, [matchingRichRecord]),
    exportRequest,
);

assert.deepEqual(
    resolveReportBuilderSavedPayloadExportRequest(matchingRichRecord, []),
    exportRequest,
);

assert.deepEqual(
    resolveReportBuilderSavedPayloadExportRequestBySource({
        payloadId: "rbreport_forecasting_q3",
        sourceArtifactId: "forecasting_q3",
        reportId: "forecastingQ3",
    }, [matchingRichRecord]),
    exportRequest,
);

assert.deepEqual(
    resolveReportBuilderSavedPayloadExportRequestBySource({
        source: {
            payloadId: "rbreport_forecasting_q3",
            sourceArtifactId: "forecasting_q3",
        },
    }, [matchingRichRecord]),
    exportRequest,
);

assert.equal(
    resolveReportBuilderSavedPayloadExportRequest({
        ...savedReportPayload,
        payloadId: "",
        sourceArtifactId: "other_artifact",
    }, [matchingRichRecord]),
    null,
);

console.log("reportBuilderExportRequest ✓ resolves host export handlers and saved payload export requests");
