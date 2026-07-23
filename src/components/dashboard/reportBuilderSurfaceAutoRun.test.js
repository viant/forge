import assert from "node:assert/strict";

import {
    buildReportBuilderSurfaceAutoRunKey,
    resolveReportBuilderSurfaceAutoRunAction,
    shouldAutoRunReportBuilderSurface,
} from "./reportBuilderSurfaceAutoRun.js";

assert.equal(
    buildReportBuilderSurfaceAutoRunKey({
        workspaceMode: "report",
        requestFingerprint: '{"filters":{"dateRange":"2026-06-19:2026-06-25"}}',
    }),
    'report::{"filters":{"dateRange":"2026-06-19:2026-06-25"}}',
);
assert.equal(
    buildReportBuilderSurfaceAutoRunKey({
        workspaceMode: "preview",
        requestFingerprint: "",
    }),
    "",
);

assert.equal(
    shouldAutoRunReportBuilderSurface({
        workspaceMode: "report",
        requestFingerprint: '{"q":1}',
        canRunReport: true,
        currentRequestShouldFetch: true,
        loading: false,
        error: null,
        hasRows: false,
        hasCompletedCurrentRun: false,
    }),
    true,
);
assert.equal(
    shouldAutoRunReportBuilderSurface({
        workspaceMode: "report",
        requestFingerprint: '{"q":1}',
        deferForPrefill: true,
        canRunReport: true,
        currentRequestShouldFetch: true,
    }),
    false,
);
assert.equal(
    shouldAutoRunReportBuilderSurface({
        workspaceMode: "design",
        requestFingerprint: '{"q":1}',
        canRunReport: true,
        currentRequestShouldFetch: true,
    }),
    false,
);
assert.equal(
    shouldAutoRunReportBuilderSurface({
        workspaceMode: "preview",
        requestFingerprint: '{"q":1}',
        canRunReport: true,
        currentRequestShouldFetch: true,
        hasRows: true,
    }),
    false,
);
assert.equal(
    shouldAutoRunReportBuilderSurface({
        workspaceMode: "report",
        requestFingerprint: '{"q":1}',
        canRunReport: true,
        currentRequestShouldFetch: true,
        hasCompletedCurrentRun: true,
    }),
    false,
);
assert.equal(
    shouldAutoRunReportBuilderSurface({
        workspaceMode: "report",
        requestFingerprint: '{"q":1}',
        canRunReport: true,
        currentRequestShouldFetch: true,
        error: new Error("failed"),
    }),
    false,
);

assert.deepEqual(
    resolveReportBuilderSurfaceAutoRunAction({
        workspaceMode: "report",
        requestFingerprint: '{"q":1}',
        canRunReport: true,
        currentRequestShouldFetch: true,
        hasRows: true,
        hasCompletedCurrentRun: false,
        autoRunKey: 'report::{"q":1}',
        consumedAutoRunKey: "",
        currentRequestDispatchFingerprint: '{"q":1}::fetch',
        requestDispatchFingerprint: '{"q":1}::fetch',
    }),
    {
        type: "promote",
        autoRunKey: 'report::{"q":1}',
    },
);
assert.deepEqual(
    resolveReportBuilderSurfaceAutoRunAction({
        workspaceMode: "report",
        requestFingerprint: '{"q":1}',
        canRunReport: true,
        currentRequestShouldFetch: true,
        autoRunKey: 'report::{"q":1}',
        consumedAutoRunKey: "",
        currentRequestDispatchFingerprint: '{"q":1}::fetch',
        requestDispatchFingerprint: "",
    }),
    {
        type: "dispatch",
        autoRunKey: 'report::{"q":1}',
    },
);
assert.deepEqual(
    resolveReportBuilderSurfaceAutoRunAction({
        workspaceMode: "preview",
        requestFingerprint: '{"q":1}',
        canRunReport: true,
        currentRequestShouldFetch: true,
        autoRunKey: 'preview::{"q":1}',
        consumedAutoRunKey: "",
        currentRequestDispatchFingerprint: '{"q":1}::fetch',
        requestDispatchFingerprint: '{"q":1}::fetch',
    }),
    {
        type: "dispatch",
        autoRunKey: 'preview::{"q":1}',
    },
);
assert.deepEqual(
    resolveReportBuilderSurfaceAutoRunAction({
        workspaceMode: "preview",
        requestFingerprint: '{"q":1}',
        deferForPrefill: true,
        canRunReport: true,
        currentRequestShouldFetch: true,
        autoRunKey: 'preview::{"q":1}',
        consumedAutoRunKey: "",
        currentRequestDispatchFingerprint: '{"q":1}::fetch',
        requestDispatchFingerprint: "",
    }),
    {
        type: "skip",
    },
);
assert.deepEqual(
    resolveReportBuilderSurfaceAutoRunAction({
        workspaceMode: "report",
        requestFingerprint: '{"q":1}',
        canRunReport: true,
        currentRequestShouldFetch: true,
        autoRunKey: 'report::{"q":1}',
        consumedAutoRunKey: 'report::{"q":1}',
        currentRequestDispatchFingerprint: '{"q":1}::fetch',
        requestDispatchFingerprint: "",
    }),
    {
        type: "skip",
    },
);

console.log("reportBuilderSurfaceAutoRun ✓ only auto-runs report surfaces when a reload needs a real result refresh");
