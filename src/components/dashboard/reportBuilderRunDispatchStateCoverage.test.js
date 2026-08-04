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
assert.equal(
  runReportSource.includes('const runReport = React.useCallback(({ origin = "manual" } = {}) => {')
    && runReportSource.includes("return existingPendingRun.promise")
    && runReportSource.includes("resolvePendingReportRunExecutionAction(existingPendingRun, {")
    && runReportSource.includes('if (pendingAction === "reuse")')
    && runReportSource.includes('if (pendingAction === "supersede")')
    && runReportSource.includes("const deferRunUntilCurrentMaterialization")
    && runReportSource.includes("createPendingReportRunExecution({")
    && runReportSource.includes("pendingReportWorkspaceRunRef.current = pendingRun")
    && runReportSource.includes("if (designWorkspaceMode) {")
    && runReportSource.includes("setWorkspaceMode(\"report\");")
    && runReportSource.includes("if (!isRunDispatchMaterializationCurrent(invocationSnapshot))")
    && runReportSource.includes("invocationSnapshot.requestFingerprint,")
    && runReportSource.includes("invocationSnapshot.materializationFingerprint,")
    && runReportSource.includes("if (pendingRun.requestFingerprint")
    && runReportSource.includes("pendingRun.requestFingerprint !== invocationSnapshot.requestFingerprint")
    && runReportSource.includes("if (pendingRun.materializationFingerprint")
    && runReportSource.includes("pendingRun.materializationFingerprint !== invocationSnapshot.materializationFingerprint")
    && runReportSource.includes("settlePendingReportRunExecution(pendingReportWorkspaceRunRef, pendingRun")
    && runReportSource.includes("if (!isRunDispatchMaterializationCurrent(invocationSnapshot))")
    && runReportSource.includes("pendingRun.started = true;")
    && runReportSource.includes("executeCapturedReportRun(invocationSnapshot, pendingRun.origin)"),
  true,
  "Repeated exact clicks share one promise, while R1-to-R2, Design Preview, and export-ref waits retain exact request ownership.",
);
const designBranch = runReportSource.slice(
  runReportSource.indexOf("if (designWorkspaceMode) {"),
  runReportSource.indexOf("const invocationSnapshot", runReportSource.indexOf("if (designWorkspaceMode) {")),
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
  captureSource.includes("resolveReportRunDispatchMaterialization(")
    && captureSource.includes("currentReportDispatchMaterializationRef.current")
    && captureSource.includes("materialization: dispatchMaterialization?.materialization || null")
    && captureSource.includes("materializedExportRequest,")
    && captureSource.includes("request: materializedExportRequest")
    && captureSource.includes("runtimeRequest: request")
    && captureSource.includes("source: {")
    && captureSource.includes("context: reportEventContext"),
  true,
  "The invocation snapshot must capture only the exact request-tagged materialization and immutable event/source metadata before Begin.",
);
assert.equal(
  source.includes("currentReportDispatchMaterializationRef.current = {")
    && source.includes("dispatchReady: true,")
    && source.includes("terminalMaterializationFresh: currentTerminalMaterializationFresh,")
    && source.includes("runtimePreviewRowsState.freshResultRequestKey === runtimePreviewRequestKey")
    && source.includes("resolveReportRuntimePreviewDatasetResultFreshness({")
    && source.includes("requestFingerprint: currentRequestFingerprint,")
    && source.includes("materializationFingerprint: currentReportMaterializationFingerprint,")
    && source.includes("materializedExportRequest: draftExportRequest,")
    && source.includes("matchesReportRunDispatchMaterializationSnapshot("),
  true,
  "Dispatch may begin from an exact request-tagged render, but stale retained authored rows must remain a non-terminal provisional materialization.",
);
assert.equal(
  source.includes("bindReportRunTerminalMaterialization(activeRun, terminalSnapshot, {")
    && source.includes("trustedConversationId: reportEventContext.conversationId")
    && source.includes("terminalRequest: terminalSnapshot.materializedExportRequest")
    && source.includes("terminalRequest = terminalSnapshot.materializedExportRequest"),
  true,
  "A fresh terminal request may replace only the same running invocation's terminal fingerprint under the trusted conversation.",
);

const mountedLifecycleStart = source.indexOf("reportBuilderMountedRef.current = true;");
const mountedLifecycleEnd = source.indexOf("}, []);", mountedLifecycleStart);
const mountedLifecycleSource = source.slice(mountedLifecycleStart, mountedLifecycleEnd);
assert.equal(
  mountedLifecycleSource.includes("reportBuilderMountedRef.current = false;")
    && mountedLifecycleSource.includes("const pendingRun = pendingReportWorkspaceRunRef.current;")
    && mountedLifecycleSource.includes("settlePendingReportRunExecution(")
    && mountedLifecycleSource.includes("buildCancelledReportRunResult()"),
  true,
  "Unmount must settle the one deferred Run promise with the deterministic non-throwing cancellation result.",
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
const generationCheckIndex = beginSource.indexOf("if (runInvocationGenerationRef.current !== generation)");
const activeRunAssignmentIndex = beginSource.indexOf("activeRunEventRef.current = nextRun;");
const synchronousBoundCallbackIndex = beginSource.indexOf("onRunBound?.(nextRun)", activeRunAssignmentIndex);
const capabilitySignalIndex = beginSource.indexOf("setReportRunDurableCapabilitySignal({", activeRunAssignmentIndex);
const beginResponseIndex = beginSource.indexOf("const beginResponse = await reportRunHandler.begin(");
const normalizedBeginIndex = beginSource.indexOf(
  "const beginResult = normalizeReportRunBeginResult(beginResponse);",
  beginResponseIndex,
);
const unmountedBeginCleanupIndex = beginSource.indexOf(
  "return cancelUnmountedReportRunBegin(",
  normalizedBeginIndex,
);
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
  beginSource.includes("if (!reportBuilderMountedRef.current) {")
    && beginResponseIndex >= 0
    && normalizedBeginIndex > beginResponseIndex
    && unmountedBeginCleanupIndex > normalizedBeginIndex
    && beginSource.includes("beginResult,\n                            invocationSnapshot,")
    && beginSource.includes("{ uiRunRequestId },")
    && beginSource.includes("nextRun = bindReportRunInvocation(nextRun, invocationSnapshot)"),
  true,
  "Unmount must stop a queued Begin and CAS-fail an enabled post-Begin durable identity before React state, emit, or dispatch.",
);
assert.equal(
  source.includes("reportBuilderMountedRef.current\n                    ? dispatchReportRequestSnapshot(")
    && source.includes("const settleReportRunLifecycle = React.useCallback((settlementEvent = null) => {\n        const activeRun = activeRunEventRef.current;\n        if (!reportBuilderMountedRef.current)"),
  true,
  "Datasource dispatch and terminal lifecycle scheduling must both stop after unmount.",
);

assert.equal(
  source.includes("const autoRunAction = resolveReportBuilderSurfaceAutoRunAction({")
    && source.includes("hostedExecuteOnOpen,")
    && source.includes("if (!hostedExecuteOnOpen)"),
  true,
  "Hosted execute-on-open must exclusively own automatic dispatch while generic surface auto-run remains non-hosted.",
);
assert.equal(
  source.includes("const hostedReportExecutionIdentity = resolveHostedReportExecutionIdentity(container, state)")
    && source.includes("const executeIdentity = hostedReportExecutionIdentity")
    && source.includes("const hostedRunExecutionIdentity = hostedReportExecutionIdentity")
    && source.includes("hasExecutionIdentity: !!hostedRunExecutionIdentity")
    && source.includes("if (!executeIdentity || authoredBlockCount === 0)")
    && source.includes("const exportIdentity = hostedReportExecutionIdentity")
    && source.includes("if (!exportIdentity)"),
  true,
  "Hosted initialization, dedicated execution, and export must share and independently require the activation-resolved identity.",
);
assert.equal(
  beginSource.includes("const activeRunOrigin = String(")
    && beginSource.includes("activeStatus: activeRun?.status")
    && beginSource.includes("requestedOrigin: invocationOrigin")
    && beginSource.includes("buildReportRunBeginDeduplicationKey(invocationSnapshot")
    && beginSource.includes("buildReportRunPendingBeginDeduplicationKey(invocationSnapshot")
    && source.includes("const reportRunPendingBeginScopeKey = React.useId()")
    && beginSource.includes("scopeKey: reportRunPendingBeginScopeKey")
    && beginSource.includes("resolveReportRunBeginReuseDecision({")
    && beginSource.includes('beginReuseDecision === "active"')
    && beginSource.includes('beginReuseDecision === "pending"')
    && beginSource.includes("beginDeduplicationKey,")
    && beginSource.includes("beginPendingDeduplicationKey: pendingBeginDeduplicationKey")
    && beginSource.includes("activeBeginDeduplicationKey,")
    && beginSource.includes("pendingBeginDeduplicationKey: beginRunPromiseRef.current?.key"),
  true,
  "Manual and prompt invocations must not reuse or coalesce across terminal, origin, source, or conversation identity.",
);
assert.equal(
  beginSource.includes("let durableBeginDisabled = false")
    && beginSource.includes("durableBeginDisabled = true")
    && beginSource.includes("resolveReportRunDisabledLegacyFallback(supersededActiveRun")
    && beginSource.includes("retainCurrent: retainLegacyOnDisabled")
    && beginSource.includes("invocationSnapshot")
    && beginSource.includes("origin: invocationOrigin")
    && beginSource.includes("retainedDisabledLegacyRun = true")
    && beginSource.includes('durableCapability: durableBeginDisabled ? "disabled" : "unknown"')
    && beginSource.includes("setReportRunDurableCapabilitySignal({")
    && beginSource.includes("durableCapability: nextRun.durableCapability"),
  true,
  "An explicit disabled durable Begin outcome must be retained on the active legacy run and exposed to hosted settlement ownership.",
);
assert.equal(
  generationCheckIndex >= 0
    && activeRunAssignmentIndex > generationCheckIndex
    && synchronousBoundCallbackIndex > activeRunAssignmentIndex
    && capabilitySignalIndex > synchronousBoundCallbackIndex
    && beginSource.includes("try {")
    && beginSource.includes("onRunBound?.(nextRun)")
    && beginSource.includes("The bound run remains authoritative even if hosted attempt bookkeeping fails."),
  true,
  "Hosted attempt binding must run synchronously after the generation-checked active swap and before capability state can schedule a render.",
);

assert.equal(
  (source.match(/beginAndDispatchReportRun\(invocationSnapshot,/g) || []).length,
  3,
  "Manual/prompt, authored auto-dispatch, and execute-on-open should share snapshot-preserving dispatch.",
);
assert.equal(
  source.includes("resolvePostBeginDispatch: (snapshot) =>")
    && source.includes("return resolveHostedReportRunPostBeginDispatch(")
    && source.includes("activeRunEventRef.current,")
    && source.includes("currentInvocationSnapshot,")
    && source.includes("currentFingerprint: currentRequestFingerprintValueRef.current")
    && source.includes("dispatchFingerprint: requestFingerprintRef.current")
    && source.includes("ownedRunId: hostedRunInitializationOwnedRunIdRef.current")
    && source.includes("adopt: (snapshot) => adoptHostedReportRunCurrentDispatch(snapshot"),
  true,
  "Hosted execute-on-open must adopt an authorized current dispatch that advances while durable Begin is pending.",
);
assert.equal(
  source.includes("reuseCurrent: true")
    && source.includes("onRunBound: (boundRun) =>")
    && source.includes("hostedRunInitializationOwnedRunIdRef.current = normalizeString("),
  true,
  "Hosted execute-on-open must synchronously latch the exact run it began before renderer materialization can advance.",
);
assert.equal(
  source.includes("const executeRunKey = [\n            hostedReportLifecycleContextKey,")
    && source.includes("const activeRunContextKey = buildHostedReportLifecycleContextKey(")
    && source.includes("activeRunContextKey === hostedReportLifecycleContextKey")
    && source.includes("hostedReportLifecycleContextChangedRef.current"),
  true,
  "Hosted execute-on-open must rerun once for a new mounted host context while retaining same-context de-duplication.",
);
assert.equal(
  source.includes("const hostedExecuteOnOpenHostAction = resolveHostedExecuteOnOpenHostAction({")
    && source.includes("if (hostedExecuteOnOpenHostAction !== \"execute\") {")
    && source.includes("builderContext?.windowState || context?.windowState || null"),
  true,
  "Hosted execute-on-open must dispatch only for an explicitly fresh host open, never a restored historical window.",
);
const hostedPostBeginDispatchStart = source.indexOf("resolvePostBeginDispatch: (snapshot) =>");
const hostedPostBeginAdoptStart = source.indexOf("adopt: (snapshot) =>", hostedPostBeginDispatchStart);
const hostedPostBeginDispatchEnd = source.indexOf("dispatch: (snapshot) =>", hostedPostBeginAdoptStart);
const hostedPostBeginAdoptSource = source.slice(
  hostedPostBeginAdoptStart,
  hostedPostBeginDispatchEnd,
);
assert.equal(
  hostedPostBeginAdoptSource.includes("adoptHostedReportRunCurrentDispatch(snapshot")
    && hostedPostBeginAdoptSource.includes("lastManualRunFingerprintRef.current = fingerprint")
    && !hostedPostBeginAdoptSource.includes("setManualRunSequence"),
  true,
  "Adopting an already-fresh hosted dispatch must not invalidate rows or dataset request keys with a manual run sequence change.",
);

assert.match(
  source,
  /beginAndPromoteReportRun\(invocationSnapshot,[\s\S]*dispatchReportRequestSnapshot\([\s\S]*promote: \(snapshot\) => \{[\s\S]*lastManualRunFingerprintRef\.current = snapshot\.fingerprint;/,
  "Authored promotion should dispatch durable runs and preserve legacy no-refetch promotion.",
);

assert.equal(
  source.includes("requestedParams: invocationSnapshot.request")
    && source.includes("effectiveParams: invocationSnapshot.request")
    && source.includes("matchesReportRunSettlementCurrency(activeRun, settlementEvent, {")
    && source.includes("currentMaterializationFingerprint: currentReportMaterializationFingerprintRef.current")
    && source.includes("shouldSettle: () => reportBuilderMountedRef.current")
    && source.includes("&& (settlementEvent?.superseded === true || isStillCurrent())"),
  true,
  "Durable Begin and pre-persist settlement should use immutable request and target-aware materialization identities.",
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
  source.includes("const settleRunPromiseRef = useRef(null);")
    && source.includes("buildReportRunSettlementEventKey(activeRun, settlementEvent)")
    && source.includes("executeReportRunSettlementPromiseLifecycle({")
    && source.includes("completedEventKey: completedRunEventKeyRef.current")
    && source.includes("pendingSettlementRef: settleRunPromiseRef"),
  true,
  "Duplicate terminal observations should route one stable React ref through target-aware per-key promise reuse.",
);
assert.equal(
  source.includes("shouldDeferReportRunSupersedeForInitialization(activeRun, currentInvocationSnapshot")
    && source.includes("hostedRunInitializationReadiness.deferSupersede")
    && source.includes("matchesHostedReportRunInitializationFailure(")
    && source.includes("allowDurableFailureWithInvocationDrift: hostedRunInitializationFailureOwned")
    && source.includes("hostedInitializationFailureSnapshot: hostedRunInitializationFailureSnapshot")
    && source.includes("settleTransitionLatch(null)")
    && source.includes("settleTransitionLatch(settledRun)"),
  true,
  "Hosted supersede deferral and retry latching must be driven by the pure exact-identity lifecycle decisions.",
);
const settlementLifecycleSource = source.slice(
  source.indexOf("const settleReportRunLifecycle"),
  source.indexOf("const completedRunConversationSelectionKey"),
);
const supersedeCurrencyGuardIndex = settlementLifecycleSource.indexOf(
  "if (!isStillCurrent())",
);
const conversationApplicationGuardIndex = settlementLifecycleSource.indexOf(
  "if (!isSettlementApplicationCurrent())",
);
const settledRunApplicationIndex = settlementLifecycleSource.indexOf(
  "activeRunEventRef.current = settled;",
  conversationApplicationGuardIndex,
);
const settledRunEmitIndex = settlementLifecycleSource.indexOf(
  'emitRunLifecycleEvent("report.run",',
  settledRunApplicationIndex,
);
assert.equal(
  settlementLifecycleSource.includes("matchesReportRunSettlementApplicationCurrency(")
    && settlementLifecycleSource.includes("trustedConversationId,")
    && settlementLifecycleSource.includes(
      "currentTrustedConversationId: trustedReportRunConversationIdRef.current",
    )
    && settlementLifecycleSource.includes("shouldActivate: isSettlementApplicationCurrent")
    && supersedeCurrencyGuardIndex >= 0
    && conversationApplicationGuardIndex > supersedeCurrencyGuardIndex
    && settledRunApplicationIndex > conversationApplicationGuardIndex
    && settledRunEmitIndex > settledRunApplicationIndex,
  true,
  "Activation, local success application, and emission must require the same exact run and trusted conversation currency.",
);
const completedSelectionSource = source.slice(
  source.indexOf("const completedRunConversationSelectionKey"),
  source.indexOf("const hasRows", source.indexOf("const completedRunConversationSelectionKey")),
);
assert.equal(
  completedSelectionSource.includes("buildCompletedReportRunConversationSelectionKey(selected, { trustedConversationId })")
    && completedSelectionSource.includes("!== completedRunConversationSelectionKey")
    && completedSelectionSource.includes("reportBuilderMountedRef.current")
    && completedSelectionSource.includes("trustedReportRunConversationIdRef.current === trustedConversationId")
    && completedSelectionSource.includes("activeRunEventRef.current,")
    && completedSelectionSource.includes(") === completedRunConversationSelectionKey")
    && completedSelectionSource.includes("isCurrent,"),
  true,
  "Manual null-conversation adoption remains reachable only for the exact selected run in the current trusted conversation.",
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
