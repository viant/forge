import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
    bindReportRunInvocation,
    captureReportRunDispatchSnapshot,
    captureReportRunSettlementEvent,
    resolveHostedReportAutoExportDecision,
    settleReportRunInvocation,
} from "./reportBuilderRunPersistence.js";
import { resolveReportBuilderExportSubmission } from "./reportBuilderExportSubmission.js";

const snapshot = captureReportRunDispatchSnapshot({
    request: { orderId: 2676946 },
    readiness: { canRun: true },
    materialization: {
        reportDocument: {
            title: "Hosted report",
            layout: { items: [{ blockId: "summary", span: 12 }] },
        },
    },
});
let activeRun = bindReportRunInvocation({
    runId: "persisted-run-1",
    reportRunId: "persisted-run-1",
    durable: true,
    status: "running",
}, snapshot);
let completedRunSignal = null;
let submittedRunKey = "";
const runKey = `hosted-report-1::${snapshot.materializationFingerprint}::1::pdf`;
let runSubmissions = 0;
let legacySubmissions = 0;
const reportExportHandler = {
    async submitRun(input) {
        runSubmissions += 1;
        assert.equal(input.reportRunId, "persisted-run-1");
        return { jobId: "run-job-1" };
    },
    async submitRequest() {
        legacySubmissions += 1;
        return { jobId: "legacy-job-1" };
    },
};

async function submitHostedPdfIfReady() {
    const decision = resolveHostedReportAutoExportDecision({
        format: "pdf",
        runKey,
        submittedRunKey,
        activeRun,
        completedRunSignal,
        currentFingerprint: snapshot.fingerprint,
        currentMaterializationFingerprint: snapshot.materializationFingerprint,
    });
    if (!decision) {
        return null;
    }
    submittedRunKey = decision.runKey;
    const submission = resolveReportBuilderExportSubmission({
        request: { target: { format: "pdf" } },
        sourceKind: "draft",
        conversationId: "conversation-1",
        reportExportHandler,
        runReference: decision.runReference,
        requireRunReference: decision.requireRunReference,
    });
    assert.equal(submission?.mode, "run");
    return submission.execute();
}

assert.equal(await submitHostedPdfIfReady(), null);
assert.equal(runSubmissions, 0);
assert.equal(legacySubmissions, 0, "pending persistence must not fall back to request export");
assert.equal(submittedRunKey, "", "a pending durable run must not latch auto-export");

let releaseCompletion;
const completionBarrier = new Promise((resolve) => {
    releaseCompletion = resolve;
});
const settlementEvent = captureReportRunSettlementEvent(activeRun, {
    runId: activeRun.invocation.runId,
    fingerprint: activeRun.invocation.fingerprint,
    materializationFingerprint: activeRun.invocation.materializationFingerprint,
    currentFingerprint: snapshot.fingerprint,
    currentMaterializationFingerprint: snapshot.materializationFingerprint,
    dispatchFingerprint: `${snapshot.fingerprint}::fetch`,
    status: "succeeded",
});
const pendingSettlement = settleReportRunInvocation(activeRun, settlementEvent, {
    complete: async (run) => {
        await completionBarrier;
        return { ...run, status: "completed" };
    },
});

await Promise.resolve();
assert.equal(await submitHostedPdfIfReady(), null);
assert.equal(runSubmissions, 0);
assert.equal(legacySubmissions, 0, "auto-export must stay idle while persistence is in flight");

releaseCompletion();
activeRun = (await pendingSettlement).run;
assert.equal(await submitHostedPdfIfReady(), null);
assert.equal(runSubmissions, 0, "completion must be published through the exact lifecycle signal first");
completedRunSignal = {
    runId: activeRun.runId,
    reportRunId: activeRun.reportRunId,
    fingerprint: activeRun.invocation.fingerprint,
    requestFingerprint: activeRun.invocation.requestFingerprint,
    materializationFingerprint: activeRun.invocation.materializationFingerprint,
};

await submitHostedPdfIfReady();
await submitHostedPdfIfReady();
assert.equal(runSubmissions, 1, "durable completion should submit exactly one export-from-run PDF");
assert.equal(legacySubmissions, 0);

const staleSignalDecision = resolveHostedReportAutoExportDecision({
    format: "pdf",
    runKey: "hosted-report-2::pdf",
    activeRun: {
        ...activeRun,
        runId: "persisted-run-2",
        reportRunId: "persisted-run-2",
        invocation: {
            runId: "persisted-run-2",
            fingerprint: snapshot.fingerprint,
            requestFingerprint: snapshot.requestFingerprint,
            materializationFingerprint: snapshot.materializationFingerprint,
        },
    },
    completedRunSignal,
    currentFingerprint: snapshot.fingerprint,
    currentMaterializationFingerprint: snapshot.materializationFingerprint,
});
assert.equal(staleSignalDecision, null, "a stale completed signal must not export a superseded run");

const staleMaterializationDecision = resolveHostedReportAutoExportDecision({
    format: "pdf",
    runKey: "hosted-report-3::pdf",
    activeRun,
    completedRunSignal,
    currentFingerprint: snapshot.requestFingerprint,
    currentMaterializationFingerprint: `${snapshot.materializationFingerprint}::changed-layout`,
});
assert.equal(staleMaterializationDecision, null, "hosted PDF must reject a completed run for an old materialization");

const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
    "utf8",
);
assert.match(
    source,
    /activeRunEventRef\.current = settled;[\s\S]*setCompletedDurableRunSignal\(completedRunReference/,
    "the completion signal must be published only after durable settlement",
);
assert.match(
    source,
    /resolveHostedReportAutoExportDecision\(\{[\s\S]*completedRunSignal: completedDurableRunSignal,[\s\S]*currentMaterializationFingerprint: currentReportMaterializationFingerprint,[\s\S]*if \(!decision\) \{[\s\S]*exportOnCompleteRunKeyRef\.current = decision\.runKey;[\s\S]*requireRunReference: true/,
    "hosted auto-export must wait without latching and then submit its exact run",
);

console.log("reportBuilderHostedAutoExport ✓ waits for exact durable completion, rejects stale signals, and never falls back");
