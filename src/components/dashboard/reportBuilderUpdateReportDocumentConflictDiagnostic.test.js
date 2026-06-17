import assert from "node:assert/strict";

import {
    buildReportBuilderUpdateReportDocumentConflictDiagnostic,
    buildReportBuilderUpdateReportDocumentConflictDiagnosticDownload,
    buildReportBuilderUpdateReportDocumentConflictDiagnosticInspectorState,
    buildReportBuilderUpdateReportDocumentConflictDiagnosticSummary,
    buildReportBuilderUpdateReportDocumentConflictVersionState,
    resolveReportBuilderUpdateReportDocumentCurrentVersion,
    serializeReportBuilderUpdateReportDocumentConflictDiagnostic,
} from "./reportBuilderUpdateReportDocumentConflictDiagnostic.js";

const updatePayload = {
    version: 1,
    kind: "updateReportDocumentPayload",
    updatedAt: 8000,
    reportRef: {
        reportId: "demoReportBuilder",
    },
    expectedVersion: 7,
    title: "Exploration Demo",
    document: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Exploration Demo",
        subtitle: "Executive Snapshot",
        description: "Conflict diagnostic metadata summary.",
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 1,
        datasetCount: 1,
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
    },
};

assert.equal(resolveReportBuilderUpdateReportDocumentCurrentVersion("9"), 9);
assert.equal(resolveReportBuilderUpdateReportDocumentCurrentVersion(""), 0);
assert.equal(resolveReportBuilderUpdateReportDocumentCurrentVersion("9.5"), 0);

assert.deepEqual(buildReportBuilderUpdateReportDocumentConflictVersionState({
    expectedVersion: 7,
    currentVersionDraft: "9",
}), {
    draft: "9",
    expectedVersion: 7,
    currentVersion: 9,
    valid: true,
    conflictReady: true,
    helperText: "Current version 9 conflicts with expected version 7.",
});
assert.deepEqual(buildReportBuilderUpdateReportDocumentConflictVersionState({
    expectedVersion: 7,
    currentVersionDraft: "7",
}), {
    draft: "7",
    expectedVersion: 7,
    currentVersion: 7,
    valid: true,
    conflictReady: false,
    helperText: "Current version 7 matches expected version 7; no conflict diagnostic is needed.",
});

const diagnostic = buildReportBuilderUpdateReportDocumentConflictDiagnostic(updatePayload, {
    currentVersion: "9",
    detectedAt: 9100,
});
assert.deepEqual(diagnostic, {
    version: 1,
    kind: "updateReportDocumentConflictDiagnostic",
    code: "reportDocumentVersionConflict",
    severity: "error",
    detectedAt: 9100,
    reportRef: {
        reportId: "demoReportBuilder",
    },
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Conflict diagnostic metadata summary.",
    expectedVersion: 7,
    currentVersion: 9,
    message: "Could not update Exploration Demo because expected version 7 does not match current saved version 9.",
    suggestedAction: "Reload the latest ReportDocument before retrying the update.",
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
    },
});

assert.deepEqual(buildReportBuilderUpdateReportDocumentConflictDiagnosticSummary(diagnostic), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Conflict diagnostic metadata summary.",
    kind: "updateReportDocumentConflictDiagnostic",
    code: "reportDocumentVersionConflict",
    severity: "error",
    reportId: "demoReportBuilder",
    expectedVersion: 7,
    currentVersion: 9,
    message: "Could not update Exploration Demo because expected version 7 does not match current saved version 9.",
});

assert.match(
    serializeReportBuilderUpdateReportDocumentConflictDiagnostic(diagnostic),
    /"kind": "updateReportDocumentConflictDiagnostic"/,
);
assert.doesNotMatch(
    serializeReportBuilderUpdateReportDocumentConflictDiagnostic(diagnostic),
    /"document": \{/,
);

assert.deepEqual(buildReportBuilderUpdateReportDocumentConflictDiagnosticInspectorState(diagnostic), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Conflict diagnostic metadata summary.",
    headerSubtitle: "Executive Snapshot",
    headerDescription: "Conflict diagnostic metadata summary.",
    kind: "updateReportDocumentConflictDiagnostic",
    code: "reportDocumentVersionConflict",
    severity: "error",
    reportId: "demoReportBuilder",
    expectedVersion: 7,
    currentVersion: 9,
    message: "Could not update Exploration Demo because expected version 7 does not match current saved version 9.",
    content: serializeReportBuilderUpdateReportDocumentConflictDiagnostic(diagnostic),
});

assert.deepEqual(buildReportBuilderUpdateReportDocumentConflictDiagnosticDownload(diagnostic), {
    filename: "Exploration Demo-update-conflict-v7-current-v9.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderUpdateReportDocumentConflictDiagnostic(diagnostic),
});

assert.equal(buildReportBuilderUpdateReportDocumentConflictDiagnostic(updatePayload, { currentVersion: 7 }), null);
assert.equal(buildReportBuilderUpdateReportDocumentConflictDiagnostic(null, { currentVersion: 9 }), null);
assert.equal(buildReportBuilderUpdateReportDocumentConflictDiagnosticSummary(null), null);
assert.equal(serializeReportBuilderUpdateReportDocumentConflictDiagnostic(null), "");
assert.equal(buildReportBuilderUpdateReportDocumentConflictDiagnosticInspectorState(null), null);
assert.equal(buildReportBuilderUpdateReportDocumentConflictDiagnosticDownload(null), null);

console.log("reportBuilderUpdateReportDocumentConflictDiagnostic ✓ derives structured stale-version diagnostics from update payloads");
