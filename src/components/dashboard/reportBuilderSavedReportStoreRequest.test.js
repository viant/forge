import assert from "node:assert/strict";

import { buildReportBuilderSaveReportRequest } from "./reportBuilderSavedReportPayload.js";

const savedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_forecasting_q3",
    savedAt: 9200,
    title: "Forecasting Q3",
    sourceArtifactId: "forecasting_q3",
    sourceSession: {
        sourceRef: {
            templateId: "forecast_review",
        },
        builderTarget: {
            kind: "dashboard.reportBuilder",
            containerId: "performanceMetrics",
            stateKey: "metricReportBuilder",
            dataSourceRef: "metrics_ad_cube_report",
        },
    },
    reportDocument: {
        kind: "reportDocument",
        id: "forecastingQ3",
        title: "Forecasting Q3",
        blocks: [{
            kind: "reportBuilderBlock",
            id: "builder",
            source: {
                kind: "dashboard.reportBuilder",
                stateKey: "reportBuilder",
            },
        }],
    },
    reportSpec: {
        kind: "reportSpec",
        title: "Forecasting Q3",
    },
    compileState: {
        status: "clean",
        diagnostics: [],
    },
};

const runtimeArtifact = {
    document: {
        kind: "reportDocument",
        id: "forecastingQ3",
        title: "Forecasting Q3 Runtime",
        blocks: [{
            kind: "reportBuilderBlock",
            id: "builder",
            source: {
                kind: "dashboard.reportBuilder",
                stateKey: "reportBuilder",
            },
        }],
    },
    reportSpec: {
        kind: "reportSpec",
        title: "Forecasting Q3 Runtime",
    },
    reportFill: {
        kind: "reportFill",
        version: 1,
    },
    reportPrint: {
        kind: "reportPrint",
        version: 1,
    },
};

const savedReportPayloadRecord = {
    documentVersion: 7,
    exportRequest: {
        source: {
            artifactRef: "reportBuilder.savedReportPayload://rbreport_forecasting_q3",
        },
    },
};

assert.deepEqual(buildReportBuilderSaveReportRequest(savedReportPayload, {
    runtimeArtifact,
    savedReportPayloadRecord,
    metadata: {
        conversationId: "conv-123",
        workspaceId: "steward",
    },
}), {
    artifactRef: "reportBuilder.savedReportPayload://rbreport_forecasting_q3",
    reportId: "forecastingQ3",
    title: "Forecasting Q3",
    version: 7,
    documentVersion: 7,
    reportDocument: {
        kind: "reportDocument",
        id: "forecastingQ3",
        title: "Forecasting Q3 Runtime",
        blocks: [{
            kind: "reportBuilderBlock",
            id: "builder",
            source: {
                kind: "dashboard.reportBuilder",
                containerId: "performanceMetrics",
                stateKey: "metricReportBuilder",
                dataSourceRef: "metrics_ad_cube_report",
            },
        }],
    },
    reportSpec: {
        kind: "reportSpec",
        title: "Forecasting Q3 Runtime",
    },
    compileState: {
        status: "clean",
        diagnostics: [],
    },
    reportFill: {
        kind: "reportFill",
        version: 1,
    },
    reportPrint: {
        kind: "reportPrint",
        version: 1,
    },
    metadata: {
        payloadId: "rbreport_forecasting_q3",
        sourceArtifactId: "forecasting_q3",
        savedAt: 9200,
        sourceSession: {
            sourceRef: {
                templateId: "forecast_review",
            },
            builderTarget: {
                kind: "dashboard.reportBuilder",
                containerId: "performanceMetrics",
                stateKey: "metricReportBuilder",
                dataSourceRef: "metrics_ad_cube_report",
            },
        },
        conversationId: "conv-123",
        workspaceId: "steward",
    },
});

assert.equal(buildReportBuilderSaveReportRequest(null), null);

console.log("reportBuilderSavedReportStoreRequest ✓ builds canonical store save requests from saved report payloads");
