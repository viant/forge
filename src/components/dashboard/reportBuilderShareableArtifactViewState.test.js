import assert from "node:assert/strict";

import { buildReportBuilderShareableArtifactViewState } from "./reportBuilderShareableArtifactViewState.js";

assert.deepEqual(buildReportBuilderShareableArtifactViewState({
    artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
    lifecycle: "published",
    shareableVersion: 8,
    ownerRef: "team://analytics",
    policyRef: "policy://reports/certified",
    shareableBadges: [
        { id: "certified", label: "Certified", tone: "success" },
        { id: "reviewed", label: "Reviewed", tone: "info" },
    ],
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
}), {
    shareableTitle: "Governance & Sharing",
    shareableText: "Published • Owner team://analytics • policy://reports/certified",
    shareableNotice: {
        level: "info",
        message: "Published artifact is governance-complete for immutable sharing and export.",
    },
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
    shareableRows: [
        {
            id: "artifactRef",
            label: "Artifact",
            value: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
        },
        {
            id: "version",
            label: "Version",
            value: "v8",
        },
        {
            id: "badges",
            label: "Badges",
            value: "Certified, Reviewed",
        },
        {
            id: "capabilities",
            label: "Capabilities",
            value: "Can View, Can Export",
        },
        {
            id: "grants",
            label: "Grants",
            value: "team://finance (viewer)",
        },
        {
            id: "availableActions",
            label: "Available actions",
            value: "View, Export",
        },
    ],
});

assert.deepEqual(buildReportBuilderShareableArtifactViewState({
    shareableMetaChips: ["archived"],
}), {
    shareableTitle: "Governance & Sharing",
    shareableMetaChips: ["archived"],
});

assert.deepEqual(buildReportBuilderShareableArtifactViewState({
    lifecycle: "published",
    shareableMetaChips: ["published"],
}), {
    shareableTitle: "Governance & Sharing",
    shareableText: "Published",
    shareableNotice: {
        level: "warning",
        message: "Published governance metadata is incomplete. 4 governance fields need attention.",
    },
    shareableMetaChips: ["published"],
    shareableDiagnostics: [
        {
            code: "shareableArtifactRefMissing",
            severity: "warning",
            message: "Published artifacts should declare a stable artifact ref.",
        },
        {
            code: "shareableVersionMissing",
            severity: "warning",
            message: "Published artifacts should expose an immutable shareable version.",
        },
        {
            code: "shareableOwnerMissing",
            severity: "warning",
            message: "Published artifacts should declare an owner ref.",
        },
        {
            code: "shareablePolicyMissing",
            severity: "warning",
            message: "Published artifacts should declare a policy ref.",
        },
    ],
});

assert.deepEqual(buildReportBuilderShareableArtifactViewState({
    lifecycle: "draft",
    ownerRef: "team://analytics",
    shareableCapabilities: {
        publish: true,
    },
    shareableMetaChips: ["draft", "Owner team://analytics"],
}), {
    shareableTitle: "Governance & Sharing",
    shareableText: "Draft • Owner team://analytics",
    shareableNotice: {
        level: "info",
        message: "Draft artifact metadata is ready for local review; publishing creates the immutable shared version.",
    },
    shareableMetaChips: ["draft", "Owner team://analytics", "Can Publish"],
    shareableRows: [
        {
            id: "capabilities",
            label: "Capabilities",
            value: "Can Publish",
        },
        {
            id: "availableActions",
            label: "Available actions",
            value: "Publish",
        },
    ],
});

assert.equal(buildReportBuilderShareableArtifactViewState(null), null);

console.log("reportBuilderShareableArtifactViewState ✓ normalizes generic governance and sharing sections for report surfaces");
