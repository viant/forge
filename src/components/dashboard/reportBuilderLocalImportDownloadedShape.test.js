import assert from "node:assert/strict";

import { parseReportBuilderLocalImport } from "./reportBuilderLocalImport.js";

const downloadedShapeSavedPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_demo",
    savedAt: 9100,
    title: "Imported Saved Payload",
    sourceArtifactId: "demo_payload",
    document: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Imported Saved Payload",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
};

const imported = parseReportBuilderLocalImport(
    JSON.stringify(downloadedShapeSavedPayload),
    { fileName: "downloaded-shape.saved-report-payload.json" },
);

assert.equal(imported.valid, true);
assert.equal(imported.kind, "reportBuilder.savedReportPayload");
assert.equal(imported.getReportDocumentResponse?.reportRef?.reportId, "demoReportBuilder");
assert.equal(imported.getReportDocumentResponse?.documentVersion, 1);
assert.equal(imported.message, "Imported saved report payload Imported Saved Payload. Reopen in builder is ready.");

console.log("reportBuilderLocalImportDownloadedShape ✓ downloaded saved-report payload shape is reopen-ready");
