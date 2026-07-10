import assert from "node:assert/strict";

import {
    buildReportBuilderSourceEditorDatasetPatch,
    buildReportBuilderSourceEditorDraft,
    validateReportBuilderSourceEditorDraft,
} from "./reportBuilderSourceEditorModel.js";

assert.deepEqual(buildReportBuilderSourceEditorDraft({
    value: "forecast_cube",
    label: "Forecast Cube",
    description: "Published forecast source",
    source: {
        kind: "mcp",
        toolName: "demo:forecast_summary",
    },
    request: {
        query: "forecast_summary",
    },
    resultContract: {
        shape: "rowSet",
        rowPath: "payload.records",
    },
}), {
    value: "forecast_cube",
    label: "Forecast Cube",
    description: "Published forecast source",
    toolName: "demo:forecast_summary",
    requestText: JSON.stringify({ query: "forecast_summary" }, null, 2),
    resultShape: "rowSet",
    resultRowPath: "payload.records",
    resultHasMorePath: "",
});

assert.deepEqual(buildReportBuilderSourceEditorDatasetPatch({
    value: "forecast_cube",
    label: "Edited Forecast Cube",
    description: "Edited description",
    toolName: "demo:forecast_summary_v2",
    requestText: JSON.stringify({ query: "edited_summary" }, null, 2),
    resultShape: "rowSet",
    resultRowPath: "payload.nextRecords",
    resultHasMorePath: "page.hasMore",
}, {
    id: "forecast_cube",
    label: "Forecast Cube",
    request: { query: "forecast_summary" },
    source: {
        kind: "mcp",
        toolName: "demo:forecast_summary",
    },
}), {
    label: "Edited Forecast Cube",
    description: "Edited description",
    request: {
        query: "edited_summary",
    },
    source: {
        kind: "mcp",
        toolName: "demo:forecast_summary_v2",
    },
    resultContract: {
        shape: "rowSet",
        rowPath: "payload.nextRecords",
        hasMorePath: "page.hasMore",
    },
});

assert.deepEqual(
    validateReportBuilderSourceEditorDraft({
        value: "forecast_cube",
        label: "Forecast Cube",
        requestText: JSON.stringify({ query: "forecast_summary" }, null, 2),
        resultShape: "rowSet",
        resultRowPath: "payload.records",
        resultHasMorePath: "",
    }),
    {
        valid: true,
        errors: [],
    },
);

assert.equal(
    validateReportBuilderSourceEditorDraft({
        value: "forecast_cube",
        label: "",
        requestText: "{ not-json",
        resultShape: "rowSet",
        resultRowPath: "",
        resultHasMorePath: "page.hasMore",
    }).errors.some((entry) => entry.field === "label"),
    true,
);
assert.equal(
    validateReportBuilderSourceEditorDraft({
        value: "forecast_cube",
        label: "",
        requestText: "{ not-json",
        resultShape: "rowSet",
        resultRowPath: "",
        resultHasMorePath: "page.hasMore",
    }).errors.some((entry) => entry.field === "requestText"),
    true,
);
assert.equal(
    validateReportBuilderSourceEditorDraft({
        value: "forecast_cube",
        label: "",
        requestText: "{ not-json",
        resultShape: "rowSet",
        resultRowPath: "",
        resultHasMorePath: "page.hasMore",
    }).errors.some((entry) => entry.field === "resultRowPath"),
    true,
);

console.log("reportBuilderSourceEditorModel ✓ builds editable source drafts and persisted dataset patches");
