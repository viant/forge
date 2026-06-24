import assert from "node:assert/strict";

import {
    buildReportBuilderExportAuditEvent,
    buildReportBuilderLifecycleAuditEvent,
    buildReportBuilderViewCreationAuditEvent,
    recordReportBuilderExportAuditEvent,
    recordReportBuilderLifecycleAuditEvent,
    recordReportBuilderViewCreationAuditEvent,
    resolveReportBuilderAuditActorRef,
    resolveReportBuilderAuditHandler,
    resolveReportBuilderAuditMetadata,
} from "./reportBuilderAuditHandler.js";

const contextResolvedHandler = resolveReportBuilderAuditHandler({
    handlers: {
        reportAudit: {
            recordEvent() {},
        },
    },
});
assert.equal(typeof contextResolvedHandler?.recordEvent, "function");

const directResolvedHandler = resolveReportBuilderAuditHandler({
    runEvent() {},
});
assert.equal(typeof directResolvedHandler?.runEvent, "function");
assert.equal(resolveReportBuilderAuditHandler({ handlers: { reportAudit: {} } }), null);

assert.equal(resolveReportBuilderAuditActorRef({
    identity: {
        actorRef: "user://awitas",
    },
}), "user://awitas");

assert.deepEqual(resolveReportBuilderAuditMetadata({
    builderContext: {
        identity: {
            windowId: "metricWindowA",
            dataSourceRef: "capacityCube",
        },
    },
    container: {
        id: "reportBuilder1",
    },
}), {
    windowId: "metricWindowA",
    dataSourceRef: "capacityCube",
    containerId: "reportBuilder1",
});

assert.deepEqual(buildReportBuilderLifecycleAuditEvent({
    action: "share",
    artifactRef: "reportBuilder.savedView://rbview_capacity_q3",
    version: 7,
    metadata: {
        source: "reportBuilder.catalogEntry",
    },
}, {
    actorRef: "user://awitas",
    occurredAt: "2026-06-24T10:00:00.000Z",
    metadata: {
        windowId: "metricWindowA",
    },
}), {
    eventType: "report.share",
    artifactRef: "reportBuilder.savedView://rbview_capacity_q3",
    version: 7,
    actorRef: "user://awitas",
    occurredAt: "2026-06-24T10:00:00.000Z",
    metadata: {
        source: "reportBuilder.catalogEntry",
        windowId: "metricWindowA",
    },
});

assert.deepEqual(buildReportBuilderLifecycleAuditEvent({
    action: "publish",
    artifactRef: "reportBuilder.savedView://rbview_capacity_q3",
    version: 7,
    transition: {
        artifactRef: "reportBuilder.savedView://rbview_capacity_q3",
        from: "draft",
        to: "published",
    },
    metadata: {
        source: "reportBuilder",
    },
}, {
    actorRef: "user://awitas",
    occurredAt: "2026-06-24T10:05:00.000Z",
    metadata: {
        windowId: "metricWindowA",
    },
}), {
    eventType: "report.publish",
    artifactRef: "reportBuilder.savedView://rbview_capacity_q3",
    version: 7,
    actorRef: "user://awitas",
    occurredAt: "2026-06-24T10:05:00.000Z",
    metadata: {
        from: "draft",
        to: "published",
        source: "reportBuilder",
        windowId: "metricWindowA",
    },
});

assert.deepEqual(buildReportBuilderExportAuditEvent({
    source: {
        from: "savedPayload",
        artifactKind: "reportBuilder.savedReportPayload",
        artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
        documentVersion: 4,
    },
    target: {
        format: "pdf",
    },
}, {
    actorRef: "user://awitas",
    occurredAt: "2026-06-24T10:10:00.000Z",
    metadata: {
        windowId: "metricWindowA",
        triggerSource: "savedPayload",
    },
}), {
    eventType: "report.export",
    artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
    version: 4,
    actorRef: "user://awitas",
    occurredAt: "2026-06-24T10:10:00.000Z",
    metadata: {
        from: "savedPayload",
        artifactKind: "reportBuilder.savedReportPayload",
        format: "pdf",
        windowId: "metricWindowA",
        triggerSource: "savedPayload",
    },
});

assert.deepEqual(buildReportBuilderViewCreationAuditEvent({
    kind: "reportBuilder.savedView",
    savedViewId: "saved_view_capacity_q3",
    documentVersion: 8,
    savedViewOverlay: {
        publishedSnapshotRef: {
            artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
        },
    },
}, {
    action: "share",
    artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
    metadata: {
        source: "reportBuilder",
    },
}, {
    actorRef: "user://awitas",
    occurredAt: "2026-06-24T10:12:00.000Z",
    metadata: {
        windowId: "metricWindowA",
    },
}), {
    eventType: "report.view.create",
    artifactRef: "reportBuilder.savedView://saved_view_capacity_q3",
    version: 8,
    actorRef: "user://awitas",
    occurredAt: "2026-06-24T10:12:00.000Z",
    metadata: {
        baseArtifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
        publishedSnapshotArtifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
        source: "reportBuilder",
        windowId: "metricWindowA",
    },
});

assert.deepEqual(buildReportBuilderViewCreationAuditEvent({
    kind: "reportBuilder.publishedSnapshot",
    publishedSnapshotId: "published_snapshot_capacity_q3",
    documentVersion: 9,
}, {
    action: "publish",
    artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
    metadata: {
        source: "reportBuilder",
    },
}, {
    actorRef: "user://awitas",
    occurredAt: "2026-06-24T10:13:00.000Z",
}), {
    eventType: "report.view.create",
    artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
    version: 9,
    actorRef: "user://awitas",
    occurredAt: "2026-06-24T10:13:00.000Z",
    metadata: {
        baseArtifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
        source: "reportBuilder",
    },
});

assert.equal(buildReportBuilderViewCreationAuditEvent({
    kind: "reportBuilder.savedView",
    savedViewId: "saved_view_capacity_q3",
    documentVersion: 8,
}, {
    action: "share",
    artifactRef: "reportBuilder.savedView://saved_view_capacity_q3",
}, {
    actorRef: "user://awitas",
}), null);

assert.deepEqual(buildReportBuilderViewCreationAuditEvent({
    message: "Shared saved view created.",
    sharedArtifact: {
        kind: "reportBuilder.savedView",
        savedViewId: "saved_view_capacity_q3",
        documentVersion: 8,
        savedViewOverlay: {
            publishedSnapshotRef: {
                artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
            },
        },
    },
}, {
    action: "share",
    artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
    metadata: {
        source: "reportBuilder",
    },
}, {
    actorRef: "user://awitas",
    occurredAt: "2026-06-24T10:14:00.000Z",
}), {
    eventType: "report.view.create",
    artifactRef: "reportBuilder.savedView://saved_view_capacity_q3",
    version: 8,
    actorRef: "user://awitas",
    occurredAt: "2026-06-24T10:14:00.000Z",
    metadata: {
        baseArtifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
        publishedSnapshotArtifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
        source: "reportBuilder",
    },
});

const recordedEvents = [];
const lifecycleRecordState = await recordReportBuilderLifecycleAuditEvent({
    action: "share",
    artifactRef: "reportBuilder.savedView://rbview_capacity_q3",
    version: 7,
    metadata: {
        source: "reportBuilder.catalogEntry",
    },
}, {
    handler: {
        recordEvent(event) {
            recordedEvents.push(event);
        },
    },
    actorRef: "user://awitas",
    occurredAt: "2026-06-24T10:15:00.000Z",
    metadata: {
        windowId: "metricWindowA",
    },
});
assert.equal(lifecycleRecordState.recorded, true);
assert.equal(lifecycleRecordState.issue, "");
assert.equal(recordedEvents.length, 1);
assert.equal(recordedEvents[0].eventType, "report.share");

const createdEvents = [];
const viewCreationRecordState = await recordReportBuilderViewCreationAuditEvent({
    kind: "reportBuilder.savedView",
    savedViewId: "saved_view_capacity_q3",
    documentVersion: 8,
    savedViewOverlay: {
        publishedSnapshotRef: {
            artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
        },
    },
}, {
    action: "share",
    artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
}, {
    handler: {
        recordEvent(event) {
            createdEvents.push(event);
        },
    },
    actorRef: "user://awitas",
    occurredAt: "2026-06-24T10:16:00.000Z",
    metadata: {
        windowId: "metricWindowA",
    },
});
assert.equal(viewCreationRecordState.recorded, true);
assert.equal(createdEvents.length, 1);
assert.equal(createdEvents[0].eventType, "report.view.create");

assert.deepEqual(await recordReportBuilderExportAuditEvent({
    source: {
        from: "savedPayload",
        artifactKind: "reportBuilder.savedReportPayload",
        artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
        documentVersion: 4,
    },
    target: {
        format: "pdf",
    },
}, {
    handler: {
        runEvent() {},
    },
    actorRef: "",
}), {
    recorded: false,
    skipped: false,
    issue: "Report audit provider is configured without an actorRef.",
    event: null,
});

console.log("reportBuilderAuditHandler ✓ resolves builder audit handlers and emits normalized lifecycle, view-creation, and export audit events");
