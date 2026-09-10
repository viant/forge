import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

import {
    invalidateHostedReportRestoredRuntime,
    resolveHostedReportRestoreRehydration,
} from "./reportBuilderRestoreRehydration.js";

const restoredMta = {
    hostAction: "restore",
    activationReady: true,
    canRunReport: true,
    reportIdentity: "advanced-reporting:19:400:false",
    lifecycleContextKey: "9f4853e9-ee0b-4f58-816a-431dcc915408::turn-7::advancedReportBuilder",
    requestFingerprint: JSON.stringify({action: "run", advertiserId: 100967, suiteId: 19, viewId: 400, trial: false}),
    authoredBlockCount: 9,
};

const decision = resolveHostedReportRestoreRehydration(restoredMta);
assert.equal(decision.type, "rehydrate");
assert.match(decision.key, /9f4853e9-ee0b-4f58-816a-431dcc915408/);
assert.match(decision.key, /advanced-reporting:19:400:false/);
assert.deepEqual(
    resolveHostedReportRestoreRehydration({...restoredMta, consumedKey: decision.key}),
    {type: "skip", key: decision.key},
    "one restored report identity issues exactly one datasource read per host context",
);
assert.equal(resolveHostedReportRestoreRehydration({...restoredMta, hostAction: "execute"}).type, "skip");
assert.equal(resolveHostedReportRestoreRehydration({...restoredMta, reportIdentity: ""}).type, "skip");
assert.equal(resolveHostedReportRestoreRehydration({...restoredMta, lifecycleContextKey: ""}).type, "skip");
assert.notEqual(
    resolveHostedReportRestoreRehydration({...restoredMta, lifecycleContextKey: "conversation-b::turn-7::advancedReportBuilder"}).key,
    decision.key,
    "the same report/request in another conversation receives an independent read key",
);

const signal = (value) => ({value, peek() { return this.value; }});
const input = signal({parameters: restoredMta.requestFingerprint, fetch: false});
const reportState = signal({reportDefinition: {fieldCatalog: {id: restoredMta.reportIdentity}}, reportDocumentBlocks: [{id: "mtaOverview"}]});
const originalInput = input.value;
const originalReportState = reportState.value;
const context = {signals: {
    input,
    collection: signal([{impressions: 991, conversions: 23}]),
    collectionInfo: signal({totalCount: 1}),
    metrics: signal({impressions: 991}),
    selection: signal({selected: {impressions: 991}, rowIndex: 0}),
    control: signal({loading: false, loaded: true, error: {message: "stale"}}),
    windowForm: reportState,
}};

invalidateHostedReportRestoredRuntime(context);
assert.deepEqual(context.signals.collection.value, []);
assert.deepEqual(context.signals.collectionInfo.value, {});
assert.deepEqual(context.signals.metrics.value, {});
assert.deepEqual(context.signals.selection.value, {selected: null, rowIndex: -1});
assert.deepEqual(context.signals.control.value, {loading: false, loaded: false, error: null, stale: true});
assert.equal(context.signals.input.value, originalInput, "request identity is not rewritten during invalidation");
assert.equal(context.signals.windowForm.value, originalReportState, "authored report identity/design state is not cleared");
assert.equal("token" in context.signals.input.value, false, "rehydration does not add OAuth to the report contract");

const reportBuilderSource = readFileSync(new URL("./ReportBuilder.jsx", import.meta.url), "utf8");
const rehydrationDecisionStart = reportBuilderSource.indexOf("const decision = resolveHostedReportRestoreRehydration({");
const nextAutoRunEffect = reportBuilderSource.indexOf("if (pendingReportWorkspaceRunRef.current) {", rehydrationDecisionStart);
assert.ok(rehydrationDecisionStart >= 0 && nextAutoRunEffect > rehydrationDecisionStart);
const rehydrationEffect = reportBuilderSource.slice(rehydrationDecisionStart, nextAutoRunEffect);
for (const required of [
    "hostAction: hostedExecuteOnOpenHostAction",
    "reportIdentity: hostedReportExecutionIdentity",
    "lifecycleContextKey: hostedReportLifecycleContextKey",
    "invalidateHostedReportRestoredRuntime(builderContext)",
    'origin: "restore"',
    "dispatchReportRequestSnapshot(invocationSnapshot",
    "forceFetch: true",
    "markManual: false",
]) {
    assert.ok(rehydrationEffect.includes(required), `restore rehydration effect missing ${required}`);
}
assert.equal(
    rehydrationEffect.includes("beginReportRunLifecycle") || rehydrationEffect.includes("beginAndDispatchReportRun"),
    false,
    "history rehydration must perform a current-principal datasource read without creating a durable run",
);
assert.equal(/oauth|token/i.test(rehydrationEffect), false, "OAuth remains an MCP connector header concern");

console.log("reportBuilderRestoreRehydration ✓ restored identity triggers one conversation-scoped read without leaking runtime rows");
