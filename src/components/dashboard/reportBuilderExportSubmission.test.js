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

const currentCalls = [];
const selection = {version: 1, containerId: "builder", state: {selectedMeasures: ["count"]}};
const controller = new AbortController();
const currentSubmission = resolveReportBuilderExportSubmission({
    request: {target: {format: "xlsx", tableBlockId: "details"}, reportSpec: {rows: ["untrusted"]}, reportFill: {}},
    builderSelection: selection,
    signal: controller.signal,
    reportExportHandler: {exportCurrent: async (...args) => currentCalls.push(args)},
});
assert.equal(currentSubmission.mode, "current");
assert.deepEqual(currentSubmission.input, {builder: selection, format: "xlsx", tableBlockId: "details"});
selection.state.selectedMeasures.push("later");
assert.deepEqual(currentSubmission.input.builder.state.selectedMeasures, ["count"]);
await currentSubmission.execute();
assert.equal(currentCalls[0][1].signal, controller.signal);
assert.equal("request" in currentCalls[0][0], false);
assert.equal(resolveReportBuilderExportSubmission({
    request: {target: {format: "pdf"}}, builderSelection: selection, requireRunReference: true,
    reportExportHandler: {exportCurrent: () => assert.fail("cannot substitute a current draft for an exact historical run")},
}), null);
let captures = 0;
const historical = resolveReportBuilderExportSubmission({
    request: {target: {format: "pdf"}}, runReference: {reportRunId: "exact-completed"}, requireRunReference: true,
    builderSelection: () => { captures++; throw new Error("historical export must not inspect current state"); },
    reportExportHandler: {exportCurrent: () => assert.fail("current export cannot replace exact history"), submitRun: async input => input},
});
assert.equal(historical.mode, "run");
assert.equal((await historical.execute()).reportRunId, "exact-completed");
assert.equal(captures, 0);
const tables={details:{filter:"East",sort:{key:"count",direction:"desc"}}};
const presented=resolveReportBuilderExportSubmission({request:{target:{format:"xlsx"},reportSpec:{rows:["not sent"]}},builderSelection:{version:1,containerId:"builder",state:{}},windowParameters:()=>({AdvertiserId:[42],Trial:false}),tablePresentations:tables,reportExportHandler:{exportCurrent:async input=>input}});
tables.details.filter="later";
assert.deepEqual((await presented.execute()).tablePresentations,{details:{filter:"East",sort:{key:"count",direction:"desc"}}});
assert.deepEqual(presented.input.parameters,{AdvertiserId:[42],Trial:false});
assert.equal("reportSpec" in presented.input,false);
console.log("reportBuilderExportSubmission ✓ current builder handoff excludes client render artifacts and preserves cancellation");
