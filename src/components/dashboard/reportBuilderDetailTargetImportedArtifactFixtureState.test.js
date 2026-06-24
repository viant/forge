import assert from "node:assert/strict";

import { buildReportBuilderDetailTargetImportedArtifactFixtureState } from "./reportBuilderDetailTargetImportedArtifactFixtureState.js";

const fixture = buildReportBuilderDetailTargetImportedArtifactFixtureState();

assert.equal(fixture.savedReportPayload.reportDocument.id, "importedDetailTargetModalDemo");
assert.equal(fixture.savedReportRecord.documentVersion, 24);
assert.equal(fixture.savedReportRecord.savedReportPayload.kind, "reportBuilder.savedReportPayload");
assert.equal(fixture.savedViewArtifact.kind, "reportBuilder.savedView");
assert.equal(fixture.savedViewArtifact.documentVersion, 24);
assert.equal(fixture.publishedSnapshotArtifact.kind, "reportBuilder.publishedSnapshot");
assert.equal(fixture.publishedSnapshotArtifact.documentVersion, 25);
assert.equal(fixture.getReportDocumentResponse.documentVersion, 24);
assert.equal(fixture.listReportDocumentsResponse.kind, "listReportDocumentsResponse");
assert.equal(fixture.listReportDocumentsResponse.entries.length, 1);
assert.equal(fixture.listReportDocumentsResponse.entries[0].reportRef.reportId, "importedDetailTargetModalDemo");
assert.deepEqual(fixture.getReportDocumentResponse.reportSpec.drillMetadata.detailTargets, [
    {
        targetRef: "target://example/performance/channel-detail-modal",
        navigationMode: "modal",
        title: "Archived Channel detail",
        description: "Open the archived channel detail route.",
        parameters: {
            channel: "$value",
            eventDate: "$row.eventDate",
            source: "archived",
        },
    },
]);
assert.deepEqual(fixture.savedViewArtifact.reportSpec.drillMetadata.detailTargets, fixture.getReportDocumentResponse.reportSpec.drillMetadata.detailTargets);
assert.deepEqual(fixture.publishedSnapshotArtifact.reportSpec.drillMetadata.detailTargets, fixture.getReportDocumentResponse.reportSpec.drillMetadata.detailTargets);

console.log("reportBuilderDetailTargetImportedArtifactFixtureState ✓ builds imported saved-record, shared-artifact, and get-response fixtures with authored detail-target mappings");
