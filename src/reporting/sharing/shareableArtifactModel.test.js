import assert from "node:assert/strict";

import { buildShareableArtifactSummary } from "./shareableArtifactModel.js";

const nestedSummary = buildShareableArtifactSummary({
  version: 1,
  kind: "reportBuilder.savedView",
  id: "saved_view_capacity_q3",
  documentVersion: 8,
  shareable: {
    lifecycle: "published",
    ownerRef: "team://analytics",
    policyRef: "policy://reports/certified",
    badges: [
      { id: "certified", label: "Certified", tone: "success" },
      { id: "reviewed", label: "Reviewed", tone: "info" },
    ],
    capabilities: {
      view: true,
      export: true,
      publish: false,
    },
    grants: [
      { principalRef: "team://finance", role: "viewer" },
    ],
  },
});

assert.deepEqual(nestedSummary, {
  artifactRef: "reportBuilder.savedView://saved_view_capacity_q3",
  lifecycle: "published",
  shareableVersion: 8,
  ownerRef: "team://analytics",
  policyRef: "policy://reports/certified",
  shareableNotice: {
    level: "info",
    message: "Published artifact is governance-complete for immutable sharing and export.",
  },
  shareableBadges: [
    { id: "certified", label: "Certified", tone: "success" },
    { id: "reviewed", label: "Reviewed", tone: "info" },
  ],
  shareableBadgeChips: ["Certified", "Reviewed"],
  shareableCapabilities: {
    view: true,
    export: true,
    publish: false,
  },
  shareableCapabilityChips: ["Can View", "Can Export"],
  shareableGrants: [
    { principalRef: "team://finance", role: "viewer" },
  ],
  shareableMetaChips: [
    "published",
    "v8",
    "Owner team://analytics",
    "policy://reports/certified",
    "Certified",
    "Reviewed",
    "Can View",
    "Can Export",
    "1 grant",
  ],
});

const directSummary = buildShareableArtifactSummary({
  kind: "reportBuilder.publishedSnapshot",
  source: {
    artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
  },
  documentVersion: 9,
  lifecycle: "archived",
  ownerRef: "team://performance",
  badges: [
    { id: "deprecated", label: "Deprecated", tone: "warning" },
  ],
});

assert.deepEqual(directSummary, {
  artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
  lifecycle: "archived",
  shareableVersion: 9,
  ownerRef: "team://performance",
  shareableNotice: {
    level: "warning",
    message: "Archived governance metadata is incomplete. 1 governance field needs attention.",
  },
  shareableBadges: [
    { id: "deprecated", label: "Deprecated", tone: "warning" },
  ],
  shareableBadgeChips: ["Deprecated"],
  shareableMetaChips: [
    "archived",
    "v9",
    "Owner team://performance",
    "Deprecated",
  ],
  shareableDiagnostics: [
    {
      code: "shareablePolicyMissing",
      severity: "warning",
      message: "Archived artifacts should declare a policy ref.",
    },
  ],
});

const nestedPrecedenceSummary = buildShareableArtifactSummary({
  version: 1,
  kind: "reportBuilder.savedView",
  id: "saved_view_nested_precedence",
  documentVersion: 5,
  lifecycle: "draft",
  ownerRef: "team://draft",
  shareable: {
    lifecycle: "published",
    ownerRef: "team://published",
  },
});

assert.deepEqual(nestedPrecedenceSummary.shareableMetaChips, [
  "published",
  "v5",
  "Owner team://published",
]);
assert.deepEqual(nestedPrecedenceSummary.shareableNotice, {
  level: "warning",
  message: "Published governance metadata is incomplete. 1 governance field needs attention.",
});

assert.equal(buildShareableArtifactSummary({
  version: 1,
  kind: "reportBuilder.savedReportPayload",
  payloadId: "rbreport_capacity_q3",
}), null);

assert.deepEqual(buildShareableArtifactSummary({
  lifecycle: "draft",
  ownerRef: "team://draft",
  kind: "reportBuilder.savedView",
  id: "saved_view_draft",
}), {
  artifactRef: "reportBuilder.savedView://saved_view_draft",
  lifecycle: "draft",
  ownerRef: "team://draft",
  shareableNotice: {
    level: "info",
    message: "Draft artifact metadata is ready for local review; publishing creates the immutable shared version.",
  },
  shareableMetaChips: [
    "draft",
    "Owner team://draft",
  ],
});

console.log("shareableArtifactModel ✓ normalizes generic shareable lifecycle, badge, capability, and grant metadata");
