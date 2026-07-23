import assert from "node:assert/strict";

import {
    buildReportBuilderEventFilters,
    buildReportBuilderExportEventDetail,
    buildReportBuilderRunEvent,
    emitReportBuilderUIEvent,
    normalizeReportBuilderLifecycleSourceKind,
    resolveReportBuilderEventHandler,
} from "./reportBuilderUIEvents.js";

const request = {
    target: { format: "pdf" },
    source: { title: "Inventory Brief", reportId: "inventory", artifactRef: "report://inventory" },
    reportSpec: {
        scope: {
            params: [
                { id: "orderId", value: 2680567 },
                { id: "dateRange", value: { start: "2026-07-01", end: "2026-07-07" } },
            ],
        },
        refinements: [{ id: "channel", values: ["CTV"] }],
    },
};

assert.deepEqual(buildReportBuilderEventFilters(request), {
    orderId: 2680567,
    dateRange: { start: "2026-07-01", end: "2026-07-07" },
    channel: ["CTV"],
});
assert.deepEqual(buildReportBuilderExportEventDetail({
    request,
    sourceKind: "preset",
    job: { jobId: "job-1", artifactId: "artifact-1", status: "succeeded" },
    artifact: { artifactId: "artifact-1", sourceURL: "scratchpad://localhost/export.pdf" },
}), {
    reportName: "Inventory Brief",
    reportId: "inventory",
    artifactRef: "report://inventory",
    sourceKind: "preset",
    format: "pdf",
    filters: {
        orderId: 2680567,
        dateRange: { start: "2026-07-01", end: "2026-07-07" },
        channel: ["CTV"],
    },
    jobId: "job-1",
    artifactId: "artifact-1",
    targetUrl: "scratchpad://localhost/export.pdf",
});

assert.equal(normalizeReportBuilderLifecycleSourceKind("savedView"), "report");
assert.equal(normalizeReportBuilderLifecycleSourceKind("draft"), "inline");
assert.equal(normalizeReportBuilderLifecycleSourceKind("preset"), "preset");
assert.equal(buildReportBuilderExportEventDetail({
    request: {
        ...request,
        source: { ...request.source, from: "savedView" },
    },
    sourceKind: "runtime",
}).sourceKind, "report");
assert.equal(buildReportBuilderExportEventDetail({
    request: {
        ...request,
        source: { ...request.source, from: "preset" },
    },
    sourceKind: "report",
}).sourceKind, "report");

assert.deepEqual(buildReportBuilderExportEventDetail({
    request,
    sourceKind: "preset",
    runtimeRequest: {
        filters: {
            orderIds: [2659519],
        },
    },
    reportId: "performance_delivery_command_center",
    reportName: "Performance Delivery Command Center",
    job: { jobId: "job-2", artifactId: "artifact-2", format: "pdf" },
}), {
    reportName: "Performance Delivery Command Center",
    reportId: "performance_delivery_command_center",
    artifactRef: "report://inventory",
    sourceKind: "preset",
    format: "pdf",
    filters: {
        orderId: 2680567,
        dateRange: { start: "2026-07-01", end: "2026-07-07" },
        channel: ["CTV"],
        orderIds: [2659519],
    },
    jobId: "job-2",
    artifactId: "artifact-2",
});

assert.deepEqual(buildReportBuilderRunEvent({
    kind: "report.run",
    request,
    sourceKind: "preset",
    runId: "run-1",
    status: "succeeded",
    rowCount: 7,
}), {
    kind: "report.run",
    detail: {
        reportName: "Inventory Brief",
        reportId: "inventory",
        artifactRef: "report://inventory",
        sourceKind: "preset",
        format: "pdf",
        filters: {
            orderId: 2680567,
            dateRange: { start: "2026-07-01", end: "2026-07-07" },
            channel: ["CTV"],
        },
        runId: "run-1",
        status: "succeeded",
        rowCount: 7,
    },
});

assert.deepEqual(buildReportBuilderRunEvent({
    kind: "report.run_start",
    request,
    runtimeRequest: {
        filters: {
            orderIds: [2659519],
            From: "2026-07-16",
            To: "2026-07-22",
        },
    },
    reportId: "performance_delivery_command_center",
    reportName: "Performance Delivery Command Center",
    sourceKind: "preset",
    runId: "run-2",
}), {
    kind: "report.run_start",
    detail: {
        reportName: "Performance Delivery Command Center",
        reportId: "performance_delivery_command_center",
        artifactRef: "report://inventory",
        sourceKind: "preset",
        format: "pdf",
        filters: {
            orderId: 2680567,
            dateRange: { start: "2026-07-01", end: "2026-07-07" },
            channel: ["CTV"],
            orderIds: [2659519],
            From: "2026-07-16",
            To: "2026-07-22",
        },
        runId: "run-2",
    },
});

const events = [];
const handler = resolveReportBuilderEventHandler({ handlers: { reportEvents: { emit: async (event) => events.push(event) } } });
assert.equal(await emitReportBuilderUIEvent(handler, { kind: "report.export_start" }), true);
assert.deepEqual(events, [{ kind: "report.export_start" }]);
assert.equal(await emitReportBuilderUIEvent({ emit: async () => { throw new Error("offline"); } }, {}), false);

console.log("reportBuilderUIEvents ✓ safe report lifecycle event payloads remain host-neutral");
