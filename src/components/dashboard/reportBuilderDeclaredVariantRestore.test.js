import assert from "node:assert/strict";
import { buildHydratedReportBuilderDocument } from "./reportBuilderHydratedReportDocument.js";

// Production observed v1 source identity predates the declared shared host.
const ref = "metricsCubeBuilder";
const dataSourceRef = "metrics_ad_cube_report";
const config = {
    dimensions: [{ id: "channelId", key: "channelId", label: "Channel" }],
    measures: [{ id: "impressions", key: "impressions", label: "Impressions" }],
    result: { viewModes: ["table"] },
};
const container = {
    id: "reportBuilder",
    dataSourceRef,
    dashboard: {
        reportBuilderRef: ref,
        reportBuilders: { [ref]: { dataSourceRef, reportBuilder: config } },
    },
};
const identity = {
    containerId: "reportBuilder",
    stateKey: "reportBuilder:metricsCubeBuilder",
    dataSourceRef,
};
const response = {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: { reportId: ref },
    documentVersion: 1,
    document: {
        version: 1,
        kind: "reportDocument",
        id: ref,
        schemaVersion: 1,
        title: "Performance Metrics",
        blocks: [
            {
                id: "primary",
                kind: "reportBuilderBlock",
                source: {
                    kind: "dashboard.reportBuilder",
                    containerId: ref,
                    stateKey: ref,
                    dataSourceRef,
                },
                config,
                state: {
                    selectedDimensions: ["channelId"],
                    selectedMeasures: ["impressions"],
                    primaryMeasure: "impressions",
                    viewMode: "table",
                },
            },
        ],
    },
};
const restore = (value) =>
    buildHydratedReportBuilderDocument(value, {
        container,
        builderIdentity: identity,
    });
const accepted = restore(response);
assert.equal(
    accepted.valid,
    true,
    `declared legacy builder source was rejected: ${accepted.code}`,
);
assert.deepEqual(accepted.state.selectedMeasures, ["impressions"]);
for (const changes of [
    { containerId: "differentBuilder" },
    { dataSourceRef: "foreign_source" },
    { kind: "dashboard.table" },
    { stateKey: "metricsCubeBuilder:foreignVariant" },
    { stateKey: "foreignState" },
]) {
    const foreign = structuredClone(response);
    Object.assign(foreign.document.blocks[0].source, changes);
    assert.equal(
        restore(foreign).valid,
        false,
        `foreign source accepted: ${JSON.stringify(changes)}`,
    );
}
const undeclared = {
    ...container,
    dashboard: { reportBuilderRef: "differentBuilder" },
};
assert.equal(
    buildHydratedReportBuilderDocument(response, {
        container: undeclared,
        builderIdentity: identity,
    }).valid,
    false,
);
const wrongTarget = { ...identity, stateKey: "reportBuilder:differentBuilder" };
assert.equal(
    buildHydratedReportBuilderDocument(response, {
        container,
        builderIdentity: wrongTarget,
    }).valid,
    false,
);
console.log("declared shared report builder legacy restore passed");
