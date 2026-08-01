import assert from "node:assert/strict";

import { resolveReportBuilderExportSubmission } from "./reportBuilderExportSubmission.js";

const runCalls = [];
const legacyCalls = [];
const runSubmission = resolveReportBuilderExportSubmission({
    request: {
        target: { format: "pdf" },
        reportSpec: { browserPayload: "must-not-cross-boundary" },
    },
    sourceKind: "draft",
    conversationId: "conversation-1",
    runReference: { reportRunId: "run-completed-1", reportRunRevision: 99 },
    reportExportHandler: {
        submitRun: async (input) => {
            runCalls.push(input);
            return { jobId: "job-run-1" };
        },
        submitRequest: async (input) => {
            legacyCalls.push(input);
            return { jobId: "job-legacy-1" };
        },
    },
});
assert.equal(runSubmission.mode, "run");
assert.deepEqual(runSubmission.input, {
    reportRunId: "run-completed-1",
    format: "pdf",
    conversationId: "conversation-1",
    source: "draft",
});
assert.equal("request" in runSubmission.input, false);
assert.equal("reportRunRevision" in runSubmission.input, false);
await runSubmission.execute();
assert.deepEqual(runCalls, [runSubmission.input]);
assert.equal(legacyCalls.length, 0);

assert.equal(resolveReportBuilderExportSubmission({
    request: { target: { format: "pdf" } },
    runReference: { reportRunId: "run-completed-1" },
    reportExportHandler: {
        submitRequest: async () => ({ jobId: "must-not-fallback" }),
    },
}), null, "an exact durable PDF must not fall back when submitRun is unavailable");

assert.equal(resolveReportBuilderExportSubmission({
    request: { target: { format: "pdf" } },
    requireRunReference: true,
    reportExportHandler: {
        submitRequest: async () => ({ jobId: "must-wait" }),
    },
}), null, "strict auto-export must wait for its exact completed run");

const legacyPdfSubmission = resolveReportBuilderExportSubmission({
    request: { target: { format: "pdf" }, reportSpec: { version: 1 } },
    reportExportHandler: {
        submitRequest: async (input) => input,
    },
});
assert.equal(legacyPdfSubmission.mode, "legacy", "legacy PDF remains request-based without a durable run");

const xlsxSubmission = resolveReportBuilderExportSubmission({
    request: { target: { format: "xlsx" }, reportSpec: { version: 1 } },
    runReference: { reportRunId: "run-completed-1" },
    reportExportHandler: {
        submitRun: async () => assert.fail("XLSX must not use export-from-run"),
        submitRequest: async (input) => input,
    },
});
assert.equal(xlsxSubmission.mode, "legacy");
assert.equal(xlsxSubmission.input.request.target.format, "xlsx");

console.log("reportBuilderExportSubmission ✓ normalizes export-from-run, enforces exact PDF references, and preserves legacy/XLSX paths");
