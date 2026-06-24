import assert from "node:assert/strict";

import {
    buildReportBuilderLifecycleActionRequest,
    buildReportBuilderLifecycleActionState,
    resolveReportBuilderLifecycleHandler,
} from "./reportBuilderLifecycleActionState.js";

const resolvedHandler = resolveReportBuilderLifecycleHandler({
    transitionArtifact() {},
    shareArtifact() {},
});
assert.equal(typeof resolvedHandler?.transitionArtifact, "function");
assert.equal(typeof resolvedHandler?.shareArtifact, "function");

assert.deepEqual(buildReportBuilderLifecycleActionState({
    artifactRef: "report://doc_123",
    lifecycle: "draft",
    shareableVersion: 7,
    shareableCapabilities: {
        view: true,
        share: true,
        publish: false,
        export: true,
    },
}, {
    handler: resolvedHandler,
}), {
    actions: [
        {
            id: "share",
            label: "Share",
            disabled: false,
            disabledReason: "",
            busy: false,
        },
        {
            id: "publish",
            label: "Publish",
            disabled: true,
            disabledReason: "Publish capability is not granted for this artifact.",
            busy: false,
        },
    ],
});

assert.deepEqual(buildReportBuilderLifecycleActionState({
    artifactRef: "report://doc_456",
    lifecycle: "published",
    shareableVersion: 9,
    shareableCapabilities: {
        share: false,
        archive: true,
    },
}, {
    handler: {
        transitionArtifact() {},
    },
    busyActionId: "archive",
}), {
    actions: [
        {
            id: "share",
            label: "Share",
            disabled: true,
            disabledReason: "Share capability is not granted for this artifact.",
            busy: false,
        },
        {
            id: "archive",
            label: "Archive...",
            disabled: true,
            disabledReason: "",
            busy: true,
        },
    ],
});

assert.deepEqual(buildReportBuilderLifecycleActionRequest("publish", {
    artifactRef: "report://doc_123",
    lifecycle: "draft",
    shareableVersion: 7,
}, {
    metadata: {
        source: "reportBuilder",
    },
}), {
    action: "publish",
    artifactRef: "report://doc_123",
    version: 7,
    lifecycle: "draft",
    transition: {
        artifactRef: "report://doc_123",
        from: "draft",
        to: "published",
    },
    metadata: {
        source: "reportBuilder",
    },
});

assert.deepEqual(buildReportBuilderLifecycleActionRequest("share", {
    artifactRef: "report://doc_123",
    lifecycle: "draft",
    shareableVersion: 7,
}, {
    metadata: {
        source: "reportBuilder",
    },
}), {
    action: "share",
    artifactRef: "report://doc_123",
    version: 7,
    lifecycle: "draft",
    metadata: {
        source: "reportBuilder",
    },
});

assert.equal(buildReportBuilderLifecycleActionRequest("publish", {
    artifactRef: "",
    lifecycle: "draft",
}), null);

console.log("reportBuilderLifecycleActionState ✓ derives provider-driven lifecycle and share actions for report artifacts");
