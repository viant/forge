import assert from "node:assert/strict";

import {
    buildReportBuilderGetReportDocumentRequest,
    buildReportBuilderGetReportDocumentRequestDownload,
    buildReportBuilderGetReportDocumentRequestInspectorState,
    buildReportBuilderGetReportDocumentRequestSummary,
    serializeReportBuilderGetReportDocumentRequest,
} from "./reportBuilderGetReportDocumentRequest.js";

const listResponse = {
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "demoReportBuilder" },
            documentVersion: 11,
            title: "Exploration Demo",
        },
        {
            reportRef: { reportId: "forecastingQ3" },
            documentVersion: 4,
            title: "Forecasting Q3",
        },
    ],
};

const request = buildReportBuilderGetReportDocumentRequest(listResponse, {
    entryReportId: "forecastingQ3",
});
assert.deepEqual(request, {
    version: 1,
    kind: "getReportDocumentRequest",
    reportRef: {
        reportId: "forecastingQ3",
    },
});

assert.deepEqual(buildReportBuilderGetReportDocumentRequestSummary(request), {
    kind: "getReportDocumentRequest",
    reportId: "forecastingQ3",
});
assert.deepEqual(buildReportBuilderGetReportDocumentRequestSummary(request, {
    metadata: {
        title: "Forecasting Q3",
        subtitle: "Inventory Ladder",
        description: "Selected request metadata.",
    },
}), {
    kind: "getReportDocumentRequest",
    reportId: "forecastingQ3",
    title: "Forecasting Q3",
    subtitle: "Inventory Ladder",
    description: "Selected request metadata.",
});

assert.match(
    serializeReportBuilderGetReportDocumentRequest(request),
    /"kind": "getReportDocumentRequest"/,
);

assert.deepEqual(buildReportBuilderGetReportDocumentRequestInspectorState(request, {
    metadata: {
        title: "Forecasting Q3",
        subtitle: "Inventory Ladder",
        description: "Selected request metadata.",
    },
}), {
    kind: "getReportDocumentRequest",
    reportId: "forecastingQ3",
    title: "Forecasting Q3",
    subtitle: "Inventory Ladder",
    description: "Selected request metadata.",
    headerSubtitle: "Inventory Ladder",
    headerDescription: "Selected request metadata.",
    content: serializeReportBuilderGetReportDocumentRequest(request),
});

assert.deepEqual(buildReportBuilderGetReportDocumentRequestDownload(request, {
    metadata: {
        title: "Forecasting Q3",
    },
}), {
    filename: "Forecasting Q3-get-report-document-request.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderGetReportDocumentRequest(request),
});

assert.equal(buildReportBuilderGetReportDocumentRequest(listResponse, { entryReportId: "" }), null);
assert.equal(buildReportBuilderGetReportDocumentRequest(listResponse, { entryReportId: "missing" }), null);
assert.equal(buildReportBuilderGetReportDocumentRequestSummary(null), null);
assert.equal(serializeReportBuilderGetReportDocumentRequest(null), "");
assert.equal(buildReportBuilderGetReportDocumentRequestInspectorState(null), null);
assert.equal(buildReportBuilderGetReportDocumentRequestDownload(null), null);

console.log("reportBuilderGetReportDocumentRequest ✓ derives getReportDocument requests from selected list entries");
