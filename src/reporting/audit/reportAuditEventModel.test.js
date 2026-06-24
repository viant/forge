import assert from "node:assert/strict";

import {
  buildReportAuditEvent,
  buildReportExportAuditEvent,
  buildReportRevokeAuditEvent,
  buildReportShareAuditEvent,
  buildReportViewCreationAuditEvent,
  buildShareableLifecycleAuditEvent,
  validateReportAuditEvent,
} from "./reportAuditEventModel.js";

assert.deepEqual(buildReportAuditEvent({
  eventType: "report.publish",
  artifactRef: "report://doc_123",
  version: 7,
  actorRef: "user://awitas",
  occurredAt: "2026-06-12T00:00:00Z",
  metadata: {
    workspace: "steward",
    source: "reportComposer",
  },
}), {
  eventType: "report.publish",
  artifactRef: "report://doc_123",
  version: 7,
  actorRef: "user://awitas",
  occurredAt: "2026-06-12T00:00:00Z",
  metadata: {
    workspace: "steward",
    source: "reportComposer",
  },
});

assert.deepEqual(validateReportAuditEvent({
  eventType: "report.publish",
  artifactRef: "report://doc_123",
  version: 7,
  actorRef: "user://awitas",
  occurredAt: "2026-06-12T00:00:00Z",
}), {
  valid: true,
  errors: [],
});

assert.deepEqual(validateReportAuditEvent({
  eventType: "report.unknown",
  artifactRef: "",
  version: 0,
  actorRef: "",
  occurredAt: "bad-date",
  metadata: [],
}), {
  valid: false,
  errors: [
    {
      path: "$.eventType",
      code: "invalid",
      message: "Unsupported report audit event type 'report.unknown'.",
    },
    {
      path: "$.artifactRef",
      code: "required",
      message: "Audit events require an artifactRef.",
    },
    {
      path: "$.version",
      code: "required",
      message: "Audit events require a positive version.",
    },
    {
      path: "$.actorRef",
      code: "required",
      message: "Audit events require an actorRef.",
    },
    {
      path: "$.occurredAt",
      code: "required",
      message: "Audit events require an ISO-8601 occurredAt timestamp.",
    },
    {
      path: "$.metadata",
      code: "invalid",
      message: "Audit event metadata must be an object.",
    },
  ],
});

assert.deepEqual(buildShareableLifecycleAuditEvent({
  artifactRef: "report://doc_123",
  from: "draft",
  to: "published",
  reason: "quarterly release",
}, {
  version: 7,
  actorRef: "user://awitas",
  occurredAt: "2026-06-12T00:00:00Z",
  metadata: {
    workspace: "steward",
  },
}), {
  eventType: "report.publish",
  artifactRef: "report://doc_123",
  version: 7,
  actorRef: "user://awitas",
  occurredAt: "2026-06-12T00:00:00Z",
  metadata: {
    from: "draft",
    to: "published",
    reason: "quarterly release",
    workspace: "steward",
  },
});

assert.deepEqual(buildReportShareAuditEvent({
  artifactRef: "report://doc_123",
  version: 7,
  actorRef: "user://awitas",
  principalRef: "team://analytics",
  role: "viewer",
  occurredAt: "2026-06-12T00:00:00Z",
}), {
  eventType: "report.share",
  artifactRef: "report://doc_123",
  version: 7,
  actorRef: "user://awitas",
  occurredAt: "2026-06-12T00:00:00Z",
  metadata: {
    principalRef: "team://analytics",
    role: "viewer",
  },
});

assert.deepEqual(buildReportRevokeAuditEvent({
  artifactRef: "report://doc_123",
  version: 7,
  actorRef: "user://awitas",
  principalRef: "team://analytics",
  role: "viewer",
  occurredAt: "2026-06-12T00:00:00Z",
}), {
  eventType: "report.revoke",
  artifactRef: "report://doc_123",
  version: 7,
  actorRef: "user://awitas",
  occurredAt: "2026-06-12T00:00:00Z",
  metadata: {
    principalRef: "team://analytics",
    role: "viewer",
  },
});

const savedViewExportRequest = {
  version: 1,
  kind: "reportExportRequest",
  target: {
    format: "pdf",
  },
  source: {
    from: "savedView",
    artifactKind: "reportBuilder.savedView",
    artifactRef: "reportBuilder.savedView://saved_view_capacity_q3",
    sourceArtifactId: "saved_view_capacity_q3",
    reportId: "capacityQ3",
    documentVersion: 8,
    title: "Capacity Q3 Saved View",
  },
};

assert.deepEqual(buildReportExportAuditEvent(savedViewExportRequest, {
  actorRef: "user://awitas",
  occurredAt: "2026-06-12T00:00:00Z",
  metadata: {
    workspace: "steward",
  },
}), {
  eventType: "report.export",
  artifactRef: "reportBuilder.savedView://saved_view_capacity_q3",
  version: 8,
  actorRef: "user://awitas",
  occurredAt: "2026-06-12T00:00:00Z",
  metadata: {
    from: "savedView",
    artifactKind: "reportBuilder.savedView",
    format: "pdf",
    workspace: "steward",
  },
});

assert.deepEqual(buildReportViewCreationAuditEvent({
  artifactRef: "reportBuilder.savedView://saved_view_capacity_q3",
  version: 8,
  actorRef: "user://awitas",
  baseArtifactRef: "report://capacityQ3",
  publishedSnapshotArtifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
  occurredAt: "2026-06-12T00:00:00Z",
}), {
  eventType: "report.view.create",
  artifactRef: "reportBuilder.savedView://saved_view_capacity_q3",
  version: 8,
  actorRef: "user://awitas",
  occurredAt: "2026-06-12T00:00:00Z",
  metadata: {
    baseArtifactRef: "report://capacityQ3",
    publishedSnapshotArtifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
  },
});

assert.equal(buildReportExportAuditEvent({
  source: {
    artifactRef: "dashboard.reportBuilder://performanceBuilder",
  },
}, {
  actorRef: "user://awitas",
  occurredAt: "2026-06-12T00:00:00Z",
}), null);

console.log("reportAuditEventModel ✓ builds generic publish/share/export/view audit payloads for governed reporting flows");
