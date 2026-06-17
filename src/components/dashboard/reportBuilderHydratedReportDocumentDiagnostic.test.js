import assert from "node:assert/strict";

import {
    buildReportBuilderHydratedReportDocumentDiagnostic,
    buildReportBuilderHydratedReportDocumentDiagnosticDownload,
    buildReportBuilderHydratedReportDocumentDiagnosticInspectorState,
    buildReportBuilderHydratedReportDocumentDiagnosticSummary,
    buildReportBuilderListReportDocumentsEntryDiagnostic,
    serializeReportBuilderHydratedReportDocumentDiagnostic,
} from "./reportBuilderHydratedReportDocumentDiagnostic.js";

const getResponse = {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "demoReportBuilder",
    },
    documentVersion: 11,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Exploration Demo",
        subtitle: "Executive Snapshot",
        description: "Reopen diagnostic metadata summary.",
    },
};

const hydrateResult = {
    valid: false,
    code: "incompatibleSource",
    message: "This ReportDocument targets a different builder source: data source demoReportSource.",
    source: {
        kind: "dashboard.reportBuilder",
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
};

const diagnostic = buildReportBuilderHydratedReportDocumentDiagnostic(getResponse, hydrateResult, {
    detectedAt: 9100,
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "otherSource",
    },
});

assert.deepEqual(diagnostic, {
    version: 1,
    kind: "reportBuilder.reopenDiagnostic",
    code: "incompatibleSource",
    severity: "error",
    detectedAt: 9100,
    reportRef: {
        reportId: "demoReportBuilder",
    },
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Reopen diagnostic metadata summary.",
    responseKind: "getReportDocumentResponse",
    responseVersion: 1,
    documentKind: "reportDocument",
    documentVersion: 11,
    documentSchemaVersion: 1,
    builderTarget: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "otherSource",
    },
    message: "This ReportDocument targets a different builder source: data source demoReportSource.",
    suggestedAction: "Open this ReportDocument from a compatible builder target or reload a matching document.",
    source: {
        kind: "dashboard.reportBuilder",
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
});

assert.deepEqual(buildReportBuilderHydratedReportDocumentDiagnosticSummary(diagnostic), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Reopen diagnostic metadata summary.",
    kind: "reportBuilder.reopenDiagnostic",
    code: "incompatibleSource",
    severity: "error",
    reportId: "demoReportBuilder",
    message: "This ReportDocument targets a different builder source: data source demoReportSource.",
});

assert.match(
    serializeReportBuilderHydratedReportDocumentDiagnostic(diagnostic),
    /"kind": "reportBuilder\.reopenDiagnostic"/,
);
assert.doesNotMatch(
    serializeReportBuilderHydratedReportDocumentDiagnostic(diagnostic),
    /"config": \{/,
);

assert.deepEqual(buildReportBuilderHydratedReportDocumentDiagnosticInspectorState(diagnostic), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Reopen diagnostic metadata summary.",
    headerSubtitle: "Executive Snapshot",
    headerDescription: "Reopen diagnostic metadata summary.",
    kind: "reportBuilder.reopenDiagnostic",
    code: "incompatibleSource",
    severity: "error",
    reportId: "demoReportBuilder",
    message: "This ReportDocument targets a different builder source: data source demoReportSource.",
    content: serializeReportBuilderHydratedReportDocumentDiagnostic(diagnostic),
});

assert.deepEqual(buildReportBuilderHydratedReportDocumentDiagnosticDownload(diagnostic), {
    filename: "Exploration Demo-reopen-diagnostic.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderHydratedReportDocumentDiagnostic(diagnostic),
});

const listDiagnostic = buildReportBuilderListReportDocumentsEntryDiagnostic({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "demoReportBuilder" },
            documentVersion: 11,
            title: "Exploration Demo",
            source: {
                kind: "dashboard.reportBuilder",
                containerId: "demoReportBuilder",
                stateKey: "demoReportBuilder",
                dataSourceRef: "demoReportSource",
            },
        },
        {
            reportRef: { reportId: "forecastingQ3" },
            documentVersion: 4,
            title: "Forecasting Q3",
            subtitle: "Inventory Ladder",
            description: "Selected list entry metadata.",
        },
    ],
}, {
    entryReportId: "forecastingQ3",
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    detectedAt: 9200,
});

assert.deepEqual(listDiagnostic, {
    version: 1,
    kind: "reportBuilder.reopenDiagnostic",
    code: "incompatibleSource",
    severity: "error",
    detectedAt: 9200,
    reportRef: {
        reportId: "forecastingQ3",
    },
    title: "Forecasting Q3",
    subtitle: "Inventory Ladder",
    description: "Selected list entry metadata.",
    responseKind: "listReportDocumentsResponse",
    responseVersion: 1,
    documentKind: "",
    documentVersion: 4,
    documentSchemaVersion: 0,
    builderTarget: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    message: "This ReportDocument targets a different builder source: missing source kind, missing container, missing state key, missing data source.",
    suggestedAction: "Open this ReportDocument from a compatible builder target or reload a matching document.",
});

assert.equal(buildReportBuilderListReportDocumentsEntryDiagnostic({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "demoReportBuilder" },
            documentVersion: 11,
            title: "Exploration Demo",
            source: {
                kind: "dashboard.reportBuilder",
                containerId: "demoReportBuilder",
                stateKey: "demoReportBuilder",
                dataSourceRef: "demoReportSource",
            },
        },
    ],
}, {
    entryReportId: "demoReportBuilder",
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
}), null);

assert.deepEqual(buildReportBuilderListReportDocumentsEntryDiagnostic({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [],
}, {
    entryReportId: "missingReport",
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    detectedAt: 9300,
}), {
    version: 1,
    kind: "reportBuilder.reopenDiagnostic",
    code: "missingEntry",
    severity: "error",
    detectedAt: 9300,
    reportRef: {
        reportId: "missingReport",
    },
    title: "missingReport",
    responseKind: "listReportDocumentsResponse",
    responseVersion: 1,
    documentKind: "",
    documentVersion: 0,
    documentSchemaVersion: 0,
    builderTarget: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    message: "The list response entry missingReport is unavailable for reopen compatibility checks.",
    suggestedAction: "Select a valid list response entry before checking reopen compatibility.",
});

assert.equal(buildReportBuilderHydratedReportDocumentDiagnostic(getResponse, {
    code: "missingResponse",
    message: "A getReportDocument response is required to reopen the builder.",
})?.code, "missingResponse");
assert.equal(buildReportBuilderHydratedReportDocumentDiagnosticSummary({
    title: "   ",
    reportRef: { reportId: "demoReportBuilder" },
})?.title, "demoReportBuilder");

assert.equal(buildReportBuilderHydratedReportDocumentDiagnostic(getResponse, { valid: true }), null);
assert.equal(buildReportBuilderHydratedReportDocumentDiagnosticSummary(null), null);
assert.equal(serializeReportBuilderHydratedReportDocumentDiagnostic(null), "");
assert.equal(buildReportBuilderHydratedReportDocumentDiagnosticInspectorState(null), null);
assert.equal(buildReportBuilderHydratedReportDocumentDiagnosticDownload(null), null);

console.log("reportBuilderHydratedReportDocumentDiagnostic ✓ derives structured reopen diagnostics from hydration failures");
