import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);
const exportConfigsSource = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/reportBuilderExportExecutionConfigs.js"),
  "utf8",
);

assert.match(
  source,
  /const executeCapturedReportRun = React\.useCallback\([\s\S]*beginAndDispatchReportRun\(invocationSnapshot,[\s\S]*beginReportRunLifecycle\(\{ origin, invocationSnapshot: snapshot \}\)[\s\S]*dispatchReportRequestSnapshot\(/,
  "Manual and prompt runs should share one captured snapshot for durable Begin and datasource dispatch.",
);

const runReportStart = source.indexOf("const runReport = React.useCallback");
const settlementStart = source.indexOf("const settleReportRunLifecycle", runReportStart);
const runReportSource = source.slice(runReportStart, settlementStart);
assert.equal(runReportStart >= 0 && settlementStart > runReportStart, true);
assert.match(
  runReportSource,
  /if \(designWorkspaceMode\) \{[\s\S]*pendingReportWorkspaceRunRef\.current = \{[\s\S]*setWorkspaceMode\("report"\);[\s\S]*return pendingRunPromise;[\s\S]*useEffect\(\(\) => \{[\s\S]*if \(designWorkspaceMode \|\| !pendingRun \|\| pendingRun\.started\)[\s\S]*const invocationSnapshot = captureRunDispatchSnapshot\([\s\S]*executeCapturedReportRun\(invocationSnapshot, pendingRun\.origin\)/,
  "Design Preview must commit report mode before capturing the durable materialization.",
);
const designBranch = runReportSource.slice(
  runReportSource.indexOf("if (designWorkspaceMode) {"),
  runReportSource.indexOf("return executeCapturedReportRun", runReportSource.indexOf("if (designWorkspaceMode) {")),
);
assert.equal(
  designBranch.includes("captureRunDispatchSnapshot"),
  false,
  "The pre-transition design branch must not capture a presentation-specific materialization.",
);
assert.match(
  source,
  /useEffect\(\(\) => \{\s*if \(pendingReportWorkspaceRunRef\.current\) \{\s*return;\s*\}\s*const autoRunAction = resolveReportBuilderSurfaceAutoRunAction/,
  "The authored auto-run effect must not race the deferred design Preview invocation.",
);

const captureStart = source.indexOf("const captureRunDispatchSnapshot = React.useCallback");
const captureEnd = source.indexOf("const dispatchReportRequestSnapshot", captureStart);
const captureSource = source.slice(captureStart, captureEnd);
assert.equal(captureStart >= 0 && captureEnd > captureStart, true);
assert.equal(
  captureSource.includes("materialization: currentReportMaterializationRef.current")
    && captureSource.includes("materializedExportRequest: currentReportEventRequestRef.current")
    && captureSource.includes("request: currentReportEventRequestRef.current")
    && captureSource.includes("runtimeRequest: request")
    && captureSource.includes("source: {")
    && captureSource.includes("context: reportEventContext"),
  true,
  "The invocation snapshot must capture exact materialization and immutable event/source metadata before Begin.",
);

const emitStart = source.indexOf("const emitRunLifecycleEvent = React.useCallback");
const emitEnd = source.indexOf("const beginReportRunLifecycle", emitStart);
const emitSource = source.slice(emitStart, emitEnd);
assert.equal(
  !emitSource.includes("currentReportEventIdentityRef")
    && !emitSource.includes("currentReportEventRequestRef")
    && !emitSource.includes("currentReportEventRuntimeRequestRef")
    && emitSource.includes("const source = metadata?.source")
    && emitSource.includes("const eventMetadata = metadata?.event"),
  true,
  "Lifecycle events must be built only from the run-captured metadata.",
);

const beginStart = source.indexOf("const beginReportRunLifecycle = React.useCallback");
const beginEnd = source.indexOf("const runReport = React.useCallback", beginStart);
const beginSource = source.slice(beginStart, beginEnd);
assert.equal(
  !beginSource.includes("currentReportEventIdentityRef")
    && !beginSource.includes("currentReportEventRequestRef")
    && beginSource.includes("conversationId: invocationEventContext.conversationId")
    && beginSource.includes("sourceKind: invocationSource.sourceKind")
    && beginSource.includes("const durableRunEligible = !!reportRunHandler")
    && beginSource.includes("canPersistReportRunInvocation(invocationSnapshot)")
    && beginSource.includes("if (durableRunEligible) {")
    && beginSource.includes("if (!nextRun) {")
    && beginSource.includes("durable: false")
    && beginSource.includes("nextRun.invocation?.metadata"),
  true,
  "Async Begin must require exact artifacts and retain invocation metadata instead of re-reading render refs.",
);

assert.equal(
  (source.match(/beginAndDispatchReportRun\(invocationSnapshot,/g) || []).length,
  3,
  "Manual/prompt, authored auto-dispatch, and execute-on-open should share snapshot-preserving dispatch.",
);

assert.match(
  source,
  /beginAndPromoteReportRun\(invocationSnapshot,[\s\S]*dispatchReportRequestSnapshot\([\s\S]*promote: \(snapshot\) => \{[\s\S]*lastManualRunFingerprintRef\.current = snapshot\.fingerprint;/,
  "Authored promotion should dispatch durable runs and preserve legacy no-refetch promotion.",
);

assert.equal(
  source.includes("requestedParams: invocationSnapshot.request")
    && source.includes("effectiveParams: invocationSnapshot.request")
    && source.includes("currentReportMaterializationFingerprintRef.current === materializationFingerprint"),
  true,
  "Durable Begin and settlement should use the immutable request and exact materialization identities.",
);

assert.equal(
  source.includes("dispatchReportRequest(currentBuilderStateRef.current || state, { forceFetch: true, markManual: true });"),
  false,
  "No asynchronous Begin continuation may re-read mutable builder state before dispatch.",
);

const registeredActionsStart = source.indexOf("registerReportWindowActions(windowId, {");
const registeredActionsEnd = source.indexOf("save: saveCurrentReportToStore,", registeredActionsStart);
const registeredActions = source.slice(registeredActionsStart, registeredActionsEnd);
assert.equal(registeredActionsStart >= 0 && registeredActionsEnd > registeredActionsStart, true);
assert.equal(
  registeredActions.includes('const begun = await runReport({ origin: "prompt" });'),
  true,
  "Prompt-triggered execution should enter the same durable lifecycle as the UI Run action.",
);

assert.equal(
  source.includes("completedRunEventKeyRef.current === eventKey")
    && source.includes("settleRunPromiseRef.current?.key === eventKey"),
  true,
  "Duplicate terminal observations should reuse one settlement.",
);
assert.match(
  source,
  /completeAndActivateReportRun\([\s\S]*shouldActivate: isStillCurrent[\s\S]*emitRunLifecycleEvent\("report\.run",/,
  "Persistence and current-run activation must precede the durable completion event.",
);
assert.equal(
  source.includes("reportRunId: nextRun.durable ? nextRun.reportRunId : \"\"")
    && source.includes("revision: nextRun.durable ? nextRun.revision : null")
    && source.includes("reportRunId: settled.durable ? settled.reportRunId : \"\"")
    && source.includes("status: settled.durable ? settled.status : status")
    && source.includes("}, settled.invocation?.metadata);")
    && source.includes("}, failedRun.invocation?.metadata);"),
  true,
  "Durable terminal events should add authoritative identity and retain the run-captured metadata.",
);

const draftConfigStart = exportConfigsSource.indexOf("draft: {");
const importedConfigStart = exportConfigsSource.indexOf("importedStandalone: {");
assert.equal(draftConfigStart >= 0 && importedConfigStart > draftConfigStart, true);
assert.equal(
  exportConfigsSource.slice(draftConfigStart, importedConfigStart).includes("resolveRunReference"),
  true,
  "Only the live draft PDF config should receive the completed durable-run resolver.",
);
assert.equal(
  exportConfigsSource.slice(importedConfigStart).includes("resolveRunReference"),
  false,
  "Imported, saved, reopened, and selected-entry exports should retain request-based behavior.",
);
assert.equal(
  source.includes("resolveRunReference: resolveDraftRunReference")
    && source.includes("materializationFingerprint: currentReportMaterializationFingerprintRef.current")
    && !/draftXlsxExportExecution[\s\S]{0,700}resolveRunReference/.test(source),
  true,
  "Durable export-from-run must not broaden the dedicated XLSX execution path.",
);
