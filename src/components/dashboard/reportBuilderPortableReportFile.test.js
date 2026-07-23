import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    buildReportBuilderPortableReportFile,
    parseReportBuilderPortableReportFile,
    sanitizeReportBuilderPortableValue,
    validateReportBuilderPortableReportFile,
} from "./reportBuilderPortableReportFile.js";

const savedPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    title: "Delivery / Command Center",
    sourceSession: {
        sourceRef: { kind: "reportTemplate", templateId: "delivery-command-center" },
        builderTarget: {
            kind: "dashboard.reportBuilder",
            containerId: "performanceMetrics",
            stateKey: "reportBuilder:metricsCubeBuilder",
            dataSourceRef: "metrics_ad_cube_report",
        },
        authToken: "must-not-leak",
        scratchpadUrl: "scratchpad://localhost/private-result",
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "deliveryCommandCenter",
        title: "Delivery Command Center",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                source: {
                    kind: "dashboard.reportBuilder",
                    containerId: "reportBuilder",
                    stateKey: "reportBuilder",
                    dataSourceRef: "legacy_source",
                },
            },
            { id: "summary", kind: "markdownBlock", bodyTemplate: "## ${dataset.label}" },
            { id: "trend", kind: "chartBlock", datasetRef: "delivery", xField: "date", measures: ["spend"] },
            { id: "detail", kind: "tableBlock", datasetRef: "delivery", columns: ["date", "spend"] },
        ],
        layout: {
            type: "grid",
            items: [
                { blockId: "summary", span: 12 },
                { blockId: "trend", span: 8 },
                { blockId: "detail", span: 4 },
            ],
        },
        tabs: [{ id: "overview", title: "Overview", blockIds: ["summary", "trend", "detail"] }],
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        datasets: [{ id: "delivery", sourceRef: "metrics_delivery" }],
        scope: { params: [{ id: "dateRange", value: { from: "2026-07-15", to: "2026-07-22" } }] },
        rows: [{ spend: 123 }],
    },
    compileState: { diagnostics: [{ severity: "error", message: "runtime only" }] },
    runtimeArtifact: { reportFill: { rows: [{ spend: 123 }] } },
};

const reportFile = buildReportBuilderPortableReportFile(savedPayload);
assert.equal(reportFile.kind, "forge.reporting.reportFile");
assert.equal(reportFile.schemaVersion, 1);
assert.equal(reportFile.sourceSession.authToken, undefined);
assert.equal(reportFile.sourceSession.scratchpadUrl, undefined);
assert.deepEqual(reportFile.sourceSession.builderTarget, savedPayload.sourceSession.builderTarget);
assert.equal(reportFile.reportSpec.rows, undefined);
assert.equal(reportFile.compileState, undefined);
assert.equal(reportFile.runtimeArtifact, undefined);
assert.deepEqual(reportFile.reportDocument.layout.items.map((item) => item.span), [12, 8, 4]);
assert.deepEqual(reportFile.reportDocument.blocks[0].source, savedPayload.sourceSession.builderTarget);
assert.equal(reportFile.reportDocument.blocks[1].bodyTemplate, "## ${dataset.label}");

assert.deepEqual(sanitizeReportBuilderPortableValue({
    config: {
        reportDocumentTemplates: [{ documentPatch: { blocks: [{ datasetRef: "inactive_template_source" }] } }],
        reportDocumentSavedPayloads: [{ reportDocument: { blocks: [{ datasetRef: "historical_source" }] } }],
        currentMode: "authored",
    },
}), {
    config: {
        currentMode: "authored",
    },
});

const parsed = parseReportBuilderPortableReportFile(reportFile);
assert.equal(parsed.valid, true);
assert.equal(parsed.payload.kind, "reportBuilder.savedReportPayload");
assert.equal(parsed.payload.sourceSession.unsavedDraft, true);
assert.equal(parsed.payload.reportDocument.tabs[0].id, "overview");
assert.deepEqual(parsed.payload.reportDocument.blocks, reportFile.reportDocument.blocks);

const editedPayload = JSON.parse(JSON.stringify(savedPayload));
editedPayload.reportDocument.blocks = [
    editedPayload.reportDocument.blocks[0],
    editedPayload.reportDocument.blocks[1],
    editedPayload.reportDocument.blocks[3],
    {
        id: "headline",
        kind: "kpiBlock",
        datasetRef: "delivery",
        displayMode: "both",
        valueField: "spend",
        bodyTemplate: "**Spend:** ${fmt.currency(row.spend)}",
    },
];
editedPayload.reportDocument.layout.items = [
    { blockId: "summary", span: 12 },
    { blockId: "headline", span: 4 },
    { blockId: "detail", span: 8 },
];
editedPayload.reportDocument.tabs[0].blockIds = ["summary", "headline", "detail"];
editedPayload.reportSpec.scope.params.push({ id: "orderId", value: [2659694] });

const editedFile = buildReportBuilderPortableReportFile(editedPayload);
const editedRoundTrip = parseReportBuilderPortableReportFile(editedFile);
assert.equal(editedRoundTrip.valid, true);
assert.deepEqual(
    editedRoundTrip.payload.reportDocument.blocks.map((block) => block.id),
    ["primaryBuilder", "summary", "detail", "headline"],
);
assert.equal(editedRoundTrip.payload.reportDocument.blocks.some((block) => block.id === "trend"), false);
assert.equal(editedRoundTrip.payload.reportDocument.blocks[3].bodyTemplate, "**Spend:** ${fmt.currency(row.spend)}");
assert.deepEqual(editedRoundTrip.payload.reportDocument.layout.items, editedPayload.reportDocument.layout.items);
assert.deepEqual(editedRoundTrip.payload.reportSpec.scope.params.at(-1), { id: "orderId", value: [2659694] });

assert.equal(validateReportBuilderPortableReportFile({ ...reportFile, schemaVersion: 2 }).code, "unsupportedSchemaVersion");
assert.equal(validateReportBuilderPortableReportFile({
    ...reportFile,
    reportDocument: {
        ...reportFile.reportDocument,
        blocks: [...reportFile.reportDocument.blocks, { id: "trend", kind: "chartBlock" }],
    },
}).code, "duplicateBlockId");
assert.equal(validateReportBuilderPortableReportFile({
    ...reportFile,
    reportDocument: {
        ...reportFile.reportDocument,
        layout: { items: [{ blockId: "missing" }] },
    },
}).code, "unresolvedLayoutBlock");
assert.equal(validateReportBuilderPortableReportFile({
    ...reportFile,
    reportDocument: {
        ...reportFile.reportDocument,
        tabs: [{ id: "overview", title: "Overview", blockIds: ["summary", "removedTrend"] }],
    },
}).code, "unresolvedLayoutBlock");
assert.equal(validateReportBuilderPortableReportFile({
    ...reportFile,
    reportDocument: {
        ...reportFile.reportDocument,
        blocks: [{ id: "trend", kind: "chartBlock", datasetRef: "missing" }],
        layout: { items: [{ blockId: "trend" }] },
        tabs: [{ id: "overview", title: "Overview", blockIds: ["trend"] }],
    },
}).code, "unresolvedDatasetRef");
assert.equal(validateReportBuilderPortableReportFile({
    ...reportFile,
    sourceSession: { token: "unsafe" },
}).code, "unsafePortableValue");

const reportBuilderSource = readFileSync(new URL("./ReportBuilder.jsx", import.meta.url), "utf8");
const portableSaveFlow = reportBuilderSource.slice(
    reportBuilderSource.indexOf("const saveReportFile = React.useCallback"),
    reportBuilderSource.indexOf("const saveCurrentReportToStore = React.useCallback"),
);
assert.match(portableSaveFlow, /buildReportBuilderSavedReportPayloadDownload\(payload\)/);
assert.doesNotMatch(portableSaveFlow, /reportStoreHandler\?\.(?:saveReport|updateReport)/);
assert.match(portableSaveFlow, /if \(!downloadDescriptor\)[\s\S]*Resolve the report metadata validation issues and try again\.[\s\S]*return;/);
assert.match(portableSaveFlow, /setTimeout\(\(\) => \{[\s\S]*anchor\.remove\(\);[\s\S]*URL\.revokeObjectURL\(url\);[\s\S]*\}, 1000\)/);
assert.match(portableSaveFlow, /not persisted until Save as report is explicitly used/);
assert.match(reportBuilderSource, /bundle\.payload\?\.sourceSession\?\.unsavedDraft !== true/);
assert.match(reportBuilderSource, /"Save as report"/);
assert.match(reportBuilderSource, /portableReportFile[\s\S]*setStoredReportArtifact\(null\);[\s\S]*setWorkspaceMode\("design"\)/);

console.log("reportBuilderPortableReportFile ✓ sanitizes and round-trips portable authored reports");
