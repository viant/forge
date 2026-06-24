import assert from "node:assert/strict";

import {
    buildReportBuilderSharedArtifactInventoryNotice,
    mergeReportBuilderSharedArtifactInventoryRecord,
    normalizeReportBuilderSharedArtifactInventory,
    resolveReportBuilderSharedArtifactInventoryRecord,
    resolveReportBuilderSharedArtifactHandler,
} from "./reportBuilderSharedArtifactInventory.js";

const handler = resolveReportBuilderSharedArtifactHandler({
    listArtifacts() {},
    getArtifact() {},
});
assert.equal(typeof handler?.listArtifacts, "function");
assert.equal(typeof handler?.getArtifact, "function");
assert.equal(resolveReportBuilderSharedArtifactHandler({}), null);

assert.equal(normalizeReportBuilderSharedArtifactInventory({
    artifacts: [
        {
            artifactId: "shared-1",
            kind: "reportBuilder.savedView",
            sourceArtifactId: "saved_view_capacity_q3",
            reportId: "capacityQ3",
            documentVersion: 8,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Saved View",
            },
        },
        {
            artifactId: "shared-2",
            kind: "reportBuilder.publishedSnapshot",
            sourceArtifactId: "published_snapshot_capacity_q3",
            reportId: "capacityQ3",
            documentVersion: 9,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Snapshot",
            },
        },
    ],
}).length, 2);

const normalizedInventory = normalizeReportBuilderSharedArtifactInventory({
    artifacts: [
        {
            artifactId: "shared-1",
            kind: "reportBuilder.savedView",
            sourceArtifactId: "saved_view_capacity_q3",
            reportId: "capacityQ3",
            documentVersion: 8,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Saved View",
            },
        },
    ],
});

assert.equal(
    resolveReportBuilderSharedArtifactInventoryRecord(normalizedInventory, {
        reportRef: { reportId: "capacityQ3" },
        source: {
            kind: "reportBuilder.savedView",
            reportId: "capacityQ3",
            sourceArtifactId: "saved_view_capacity_q3",
        },
    })?.artifactId,
    "shared-1",
);

assert.equal(
    mergeReportBuilderSharedArtifactInventoryRecord(normalizedInventory, {
        artifactId: "shared-1",
        kind: "reportBuilder.savedView",
        sourceArtifactId: "saved_view_capacity_q3",
        reportId: "capacityQ3",
        documentVersion: 8,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityQ3",
            title: "Capacity Q3 Saved View Refreshed",
        },
        reportSpec: {
            version: 1,
            kind: "reportSpec",
            blocks: [{ id: "primaryTable" }],
            datasets: [{ id: "primary" }],
        },
    })[0]?.document?.title,
    "Capacity Q3 Saved View Refreshed",
);

assert.deepEqual(buildReportBuilderSharedArtifactInventoryNotice({
    recordCount: 2,
}), {
    level: "info",
    message: "2 shared reporting artifacts available from the backend inventory.",
});

assert.deepEqual(buildReportBuilderSharedArtifactInventoryNotice({
    loading: true,
}), {
    level: "info",
    message: "Loading shared artifact inventory.",
});

console.log("reportBuilderSharedArtifactInventory ✓ resolves shared-artifact handlers and normalizes backend inventory records");
