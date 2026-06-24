const DEFAULT_STORAGE_KEYS = [
  "reportBuilder.state.demoReportBuilder.demoReportBuilderWindow",
  "reportBuilder.state.demoReportBuilder",
  "reportBuilder.chartPresets.demoReportBuilder.demoReportBuilderWindow",
  "reportBuilder.chartPresets.demoReportBuilder",
];

function normalizeString(value = "") {
  return String(value || "").trim();
}

export function buildPreviewBootstrapSteps({
  captureDownloads = false,
} = {}) {
  const setupExpression = captureDownloads
    ? "(() => { const close = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Close')); if (close) { close.click(); } window.__artifactDownloadCapture = { filename: '', payload: '', mimeType: '', payloadReady: false }; const originalCreate = URL.createObjectURL.bind(URL); URL.createObjectURL = (blob) => { window.__artifactDownloadCapture.mimeType = blob.type || ''; window.__artifactDownloadCapture.payload = ''; window.__artifactDownloadCapture.payloadReady = false; blob.text().then((text) => { window.__artifactDownloadCapture.payload = text; window.__artifactDownloadCapture.payloadReady = true; }); return originalCreate(blob); }; const originalClick = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function() { window.__artifactDownloadCapture.filename = this.download || ''; return originalClick.call(this); }; })()"
    : "(() => { const close = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Close')); if (close) { close.click(); } })()";
  return [
    {
      type: "goto",
      url: "/report-builder-preview.html",
    },
    {
      type: "waitForDomContains",
      text: "Semantic Report Builder Preview",
      timeoutMs: 60000,
    },
    {
      type: "clearLocalStorage",
      keys: DEFAULT_STORAGE_KEYS,
    },
    {
      type: "reload",
    },
    {
      type: "waitForDomContains",
      text: "Semantic binding: Ad Delivery • Entity: Line Delivery",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: setupExpression,
    },
  ];
}

export function buildSavedPayloadPreparationSteps({
  documentVersion = "11",
  draftTriggerText = "",
} = {}) {
  const normalizedDraftTriggerText = String(draftTriggerText || "").trim();
  if (!normalizedDraftTriggerText) {
    throw new Error("buildSavedPayloadPreparationSteps requires draftTriggerText.");
  }
  return [
    {
      type: "waitForEval",
      expression: `(() => Array.from(document.querySelectorAll('.forge-report-builder__measure-pill')).some((entry) => ((entry.innerText || entry.textContent || '').trim() === ${JSON.stringify(normalizedDraftTriggerText)})) )()`,
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__measure-pill",
      text: normalizedDraftTriggerText,
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Local Draft",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Save artifact')); return !!button && !button.disabled && button.getAttribute('aria-disabled') !== 'true'; })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Save artifact",
    },
    {
      type: "waitForDomContains",
      text: "Saved exploration artifact: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare report payload",
    },
    {
      type: "waitForDomContains",
      text: "Saved report payload: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "fillSelector",
      selector: "input[aria-label=\"Document version\"]",
      value: String(documentVersion),
    },
    {
      type: "waitForDomContains",
      text: `Using document version ${String(documentVersion)}.`,
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare list response",
    },
    {
      type: "waitForDomContains",
      text: "List ReportDocuments response:",
      timeoutMs: 60000,
    },
  ];
}

export function buildSelectedReportDocumentPreparationSteps({
  reportId = "",
  responseTitle = "",
} = {}) {
  return [
    {
      type: "selectSelector",
      selector: "select[aria-label=\"List response entry\"]",
      value: String(reportId),
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: `"reportId": "${String(reportId)}"`,
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: String(responseTitle),
      timeoutMs: 60000,
    },
  ];
}

export function buildSeededSavedPayloadCompileStatePatchSteps({
  reportId = "",
  compileState = null,
  expectedStatus = "",
  statusText = "",
  missingApiMessage = "patchSeededSavedReportPayload API not available.",
} = {}) {
  const normalizedReportId = normalizeString(reportId);
  const normalizedExpectedStatus = normalizeString(expectedStatus || compileState?.status);
  const normalizedStatusText = normalizeString(statusText);
  const normalizedMissingApiMessage = normalizeString(missingApiMessage) || "patchSeededSavedReportPayload API not available.";
  if (!normalizedReportId || !compileState || typeof compileState !== "object") {
    throw new Error("buildSeededSavedPayloadCompileStatePatchSteps requires reportId and compileState.");
  }
  if (!normalizedExpectedStatus) {
    throw new Error("buildSeededSavedPayloadCompileStatePatchSteps requires expectedStatus.");
  }
  return [
    {
      type: "eval",
      expression: `(() => { const api = window.__REPORT_BUILDER_PREVIEW__; if (!api || typeof api.patchSeededSavedReportPayload !== 'function') { return false; } const patched = api.patchSeededSavedReportPayload(${JSON.stringify(normalizedReportId)}, { compileState: ${JSON.stringify(compileState)} }); return !!patched && patched.compileState && patched.compileState.status === ${JSON.stringify(normalizedExpectedStatus)}; })()`,
    },
    ...(normalizedStatusText ? [{
      type: "waitForDomContains",
      text: normalizedStatusText,
      timeoutMs: 60000,
    }] : []),
  ];
}

export function buildSemanticValidationBehaviorInjectionSteps({
  match = null,
  delayMs = 1200,
  errorMessage = "",
  result = null,
  missingApiMessage = "replaceSemanticValidationBehaviors API not available.",
} = {}) {
  if (!match || typeof match !== "object") {
    throw new Error("buildSemanticValidationBehaviorInjectionSteps requires match.");
  }
  const normalizedMissingApiMessage = normalizeString(missingApiMessage) || "replaceSemanticValidationBehaviors API not available.";
  const normalizedDelayMs = Number(delayMs);
  if (!Number.isFinite(normalizedDelayMs) || normalizedDelayMs < 0) {
    throw new Error("buildSemanticValidationBehaviorInjectionSteps requires delayMs >= 0.");
  }
  if (!normalizeString(errorMessage) && (result == null || typeof result !== "object") && normalizedDelayMs === 0) {
    throw new Error("buildSemanticValidationBehaviorInjectionSteps requires errorMessage, result, or delayMs > 0.");
  }
  const payload = {
    match,
    delayMs: normalizedDelayMs,
    ...(normalizeString(errorMessage) ? { error: normalizeString(errorMessage) } : {}),
    ...(result && typeof result === "object" ? { result } : {}),
  };
  return {
    type: "eval",
    expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceSemanticValidationBehaviors !== 'function') { throw new Error(${JSON.stringify(normalizedMissingApiMessage)}); } return preview.replaceSemanticValidationBehaviors([${JSON.stringify(payload)}]); })()`,
  };
}

export function buildQueuedSemanticValidationBehaviorsStep({
  behaviors = [],
  clearExisting = true,
  missingApiMessage = "semantic validation queue APIs not available.",
} = {}) {
  const normalizedBehaviors = (Array.isArray(behaviors) ? behaviors : [behaviors])
    .filter((behavior) => behavior && typeof behavior === "object" && !Array.isArray(behavior))
    .map((behavior) => JSON.parse(JSON.stringify(behavior)));
  if (normalizedBehaviors.length === 0) {
    throw new Error("buildQueuedSemanticValidationBehaviorsStep requires behaviors.");
  }
  const normalizedMissingApiMessage = normalizeString(missingApiMessage) || "semantic validation queue APIs not available.";
  return {
    type: "eval",
    expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.queueSemanticValidationBehavior !== 'function'${clearExisting ? " || typeof preview.clearSemanticValidationBehaviors !== 'function'" : ""}) { throw new Error(${JSON.stringify(normalizedMissingApiMessage)}); } ${clearExisting ? "preview.clearSemanticValidationBehaviors();" : ""} const behaviors = ${JSON.stringify(normalizedBehaviors)}; behaviors.forEach((behavior) => preview.queueSemanticValidationBehavior(behavior)); return Array.isArray(preview.semanticValidationBehaviors) ? preview.semanticValidationBehaviors.length : 0; })()`,
  };
}

export function buildPreviewFetchBehaviorReplacementStep({
  behaviors = [],
  resetCounters = false,
  missingApiMessage = "replaceFetchBehaviors API not available.",
  missingResetMessage = "resetCounters API not available.",
} = {}) {
  const normalizedBehaviors = (Array.isArray(behaviors) ? behaviors : [behaviors])
    .filter((behavior) => behavior && typeof behavior === "object" && !Array.isArray(behavior))
    .map((behavior) => JSON.parse(JSON.stringify(behavior)));
  if (normalizedBehaviors.length === 0) {
    throw new Error("buildPreviewFetchBehaviorReplacementStep requires behaviors.");
  }
  const normalizedMissingApiMessage = normalizeString(missingApiMessage) || "replaceFetchBehaviors API not available.";
  const normalizedMissingResetMessage = normalizeString(missingResetMessage) || "resetCounters API not available.";
  return {
    type: "eval",
    expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceFetchBehaviors !== 'function'${resetCounters ? " || typeof preview.resetCounters !== 'function'" : ""}) { throw new Error(${JSON.stringify(resetCounters ? normalizedMissingResetMessage : normalizedMissingApiMessage)}); } ${resetCounters ? "preview.resetCounters();" : ""} return preview.replaceFetchBehaviors(${JSON.stringify(normalizedBehaviors)}) > 0; })()`,
  };
}

export function buildPreviewLifecycleBehaviorReplacementStep({
  behaviors = [],
  missingApiMessage = "replaceLifecycleBehaviors API not available.",
} = {}) {
  const normalizedBehaviors = (Array.isArray(behaviors) ? behaviors : [behaviors])
    .filter((behavior) => behavior && typeof behavior === "object" && !Array.isArray(behavior))
    .map((behavior) => JSON.parse(JSON.stringify(behavior)));
  if (normalizedBehaviors.length === 0) {
    throw new Error("buildPreviewLifecycleBehaviorReplacementStep requires behaviors.");
  }
  const normalizedMissingApiMessage = normalizeString(missingApiMessage) || "replaceLifecycleBehaviors API not available.";
  return {
    type: "eval",
    expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceLifecycleBehaviors !== 'function') { throw new Error(${JSON.stringify(normalizedMissingApiMessage)}); } return preview.replaceLifecycleBehaviors(${JSON.stringify(normalizedBehaviors)}) > 0; })()`,
  };
}

export function buildPreviewPatchBuilderStateStep({
  patch = null,
  missingApiMessage = "patchBuilderState API not available.",
} = {}) {
  const normalizedPatch = patch && typeof patch === "object" && !Array.isArray(patch)
    ? JSON.parse(JSON.stringify(patch))
    : null;
  if (!normalizedPatch) {
    throw new Error("buildPreviewPatchBuilderStateStep requires patch.");
  }
  const normalizedMissingApiMessage = normalizeString(missingApiMessage) || "patchBuilderState API not available.";
  return {
    type: "eval",
    expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderState !== 'function') { throw new Error(${JSON.stringify(normalizedMissingApiMessage)}); } return !!preview.patchBuilderState(${JSON.stringify(normalizedPatch)}); })()`,
  };
}

export function buildPreviewPatchBuilderConfigStep({
  patch = null,
  missingApiMessage = "patchBuilderConfig API not available.",
} = {}) {
  const normalizedPatch = patch && typeof patch === "object" && !Array.isArray(patch)
    ? JSON.parse(JSON.stringify(patch))
    : null;
  if (!normalizedPatch) {
    throw new Error("buildPreviewPatchBuilderConfigStep requires patch.");
  }
  const normalizedMissingApiMessage = normalizeString(missingApiMessage) || "patchBuilderConfig API not available.";
  return {
    type: "eval",
    expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderConfig !== 'function') { throw new Error(${JSON.stringify(normalizedMissingApiMessage)}); } return !!preview.patchBuilderConfig(${JSON.stringify(normalizedPatch)}); })()`,
  };
}

export function buildClearSemanticValidationBehaviorsStep({
  missingApiMessage = "clearSemanticValidationBehaviors API not available.",
} = {}) {
  const normalizedMissingApiMessage = normalizeString(missingApiMessage) || "clearSemanticValidationBehaviors API not available.";
  return {
    type: "eval",
    expression: `window.__REPORT_BUILDER_PREVIEW__ && window.__REPORT_BUILDER_PREVIEW__.clearSemanticValidationBehaviors && window.__REPORT_BUILDER_PREVIEW__.clearSemanticValidationBehaviors()`,
    missingApiMessage: normalizedMissingApiMessage,
  };
}

export function buildReopenedCompileDiagnosticsWaitSteps({
  status = "invalid",
  texts = [],
} = {}) {
  const normalizedStatus = normalizeString(status) || "invalid";
  const normalizedTexts = (Array.isArray(texts) ? texts : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  return [
    {
      type: "waitForDomContains",
      text: "Reopened compile diagnostics",
      timeoutMs: 60000,
    },
    ...normalizedTexts.map((text) => ({
      type: "waitForDomContains",
      text,
      timeoutMs: 60000,
    })),
    {
      type: "waitForEval",
      expression: `(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.(); return state?.reportDocumentReopenSession?.reopenedCompileState?.status === ${JSON.stringify(normalizedStatus)}; })()`,
      timeoutMs: 60000,
    },
  ];
}

export function buildDiscardDraftAndRequirePreviewOnlyRuntimeSteps({
  runtimePanelSelector = ".forge-report-runtime-chart-panel",
  localDraftText = "Local Draft",
} = {}) {
  const normalizedRuntimePanelSelector = normalizeString(runtimePanelSelector) || ".forge-report-runtime-chart-panel";
  const normalizedLocalDraftText = normalizeString(localDraftText) || "Local Draft";
  return [
    {
      type: "clickRole",
      role: "button",
      name: "Discard draft",
    },
    {
      type: "waitForDomContains",
      text: "Draft discarded.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `!((document.body?.innerText || document.body?.textContent || '').includes(${JSON.stringify(normalizedLocalDraftText)}))`,
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => { const panels = Array.from(document.querySelectorAll(${JSON.stringify(normalizedRuntimePanelSelector)})); return panels.length >= 1 && panels.every((entry) => !!entry.closest('.forge-report-builder__runtime-preview')); })()`,
      timeoutMs: 60000,
    },
  ];
}

export function buildReopenedHydratedSessionVerificationSteps({
  reportTitle = "",
  reportId = "",
  documentVersion = 0,
  includeSummaryNotice = false,
} = {}) {
  const normalizedReportTitle = normalizeString(reportTitle);
  const normalizedReportId = normalizeString(reportId);
  const normalizedDocumentVersion = Number(documentVersion || 0) || 0;
  if (!normalizedReportTitle || !normalizedReportId || normalizedDocumentVersion < 1) {
    throw new Error("buildReopenedHydratedSessionVerificationSteps requires reportTitle, reportId, and documentVersion.");
  }
  return [
    {
      type: "clickRole",
      role: "button",
      name: "Reopen in builder",
    },
    {
      type: "waitForDomContains",
      text: `Reopened ReportDocument ${normalizedReportTitle} for editing.`,
      timeoutMs: 60000,
    },
    ...(includeSummaryNotice ? [{
      type: "waitForDomContains",
      text: `Reopened ReportDocument: ${normalizedReportTitle}`,
      timeoutMs: 60000,
    }] : []),
    {
      type: "waitForEval",
      expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const session = preview && typeof preview.getHydratedReportDocumentSession === 'function' ? preview.getHydratedReportDocumentSession() : null; return !!session && session.reportId === ${JSON.stringify(normalizedReportId)} && session.title === ${JSON.stringify(normalizedReportTitle)} && session.documentVersion === ${normalizedDocumentVersion}; })()`,
      timeoutMs: 60000,
    },
  ];
}

export function buildDrillNavigationProviderRoutePresetSelectionSteps({
  breakdownField = "",
  targetRef = "",
} = {}) {
  const normalizedBreakdownField = normalizeString(breakdownField);
  const normalizedTargetRef = normalizeString(targetRef);
  if (!normalizedBreakdownField || !normalizedTargetRef) {
    throw new Error("buildDrillNavigationProviderRoutePresetSelectionSteps requires breakdownField and targetRef.");
  }
  return [
    {
      type: "eval",
      expression: `(() => { const drillPanel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Drill navigation')); if (!drillPanel) { throw new Error('Drill navigation panel not found.'); } const labels = Array.from(drillPanel.querySelectorAll('label')); const breakdownLabel = labels.find((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === 'Breakdown field')); const breakdownSelect = breakdownLabel?.querySelector('select'); if (!breakdownSelect) { throw new Error('Breakdown field select not found.'); } breakdownSelect.value = ${JSON.stringify(normalizedBreakdownField)}; breakdownSelect.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`,
    },
    {
      type: "waitForEval",
      expression: `(() => { const drillPanel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Drill navigation')); if (!drillPanel) { return false; } const labels = Array.from(drillPanel.querySelectorAll('label')); const routePresetLabel = labels.find((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === 'Route preset')); const routePreset = routePresetLabel?.querySelector('select'); if (!routePreset) { return false; } return Array.from(routePreset.options).some((option) => option.value === ${JSON.stringify(normalizedTargetRef)}); })()`,
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: `(() => { const drillPanel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Drill navigation')); if (!drillPanel) { throw new Error('Drill navigation panel not found.'); } const labels = Array.from(drillPanel.querySelectorAll('label')); const routePresetLabel = labels.find((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === 'Route preset')); const routePreset = routePresetLabel?.querySelector('select'); if (!routePreset) { throw new Error('Route preset select not found.'); } routePreset.value = ${JSON.stringify(normalizedTargetRef)}; routePreset.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`,
    },
  ];
}

export function buildReopenedExportInspectionSteps({
  reopenedNoticeText = "",
  expectedFilename = "",
  exportTitle = "",
  bookmarkId = "",
  extraPayloadText = "",
} = {}) {
  return [
    {
      type: "waitForEval",
      expression: `(() => { const reopened = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes(${JSON.stringify(String(reopenedNoticeText))})); if (!reopened) { return false; } const text = reopened.innerText || reopened.textContent || ''; return text.includes('Review export') || text.includes('Inspect export'); })()`,
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: `(() => { const reopened = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes(${JSON.stringify(String(reopenedNoticeText))})); if (!reopened) { throw new Error('Reopened section not found.'); } const button = Array.from(reopened.querySelectorAll('button')).find((entry) => { const text = (entry.innerText || entry.textContent || '').trim(); return text === 'Inspect export' || text === 'Review export'; }); if (!button) { throw new Error('Inspect export button not found in reopened section.'); } button.click(); return true; })()`,
    },
    {
      type: "waitForEval",
      expression: `(() => { const summary = Array.from(document.querySelectorAll('[aria-label="Reopened export request summary"]')).find(Boolean); if (!summary) { return false; } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const pre = container?.querySelector('pre'); if (!pre) { return false; } const raw = pre.textContent || ''; try { const parsed = JSON.parse(raw); const reportPrint = parsed?.reportPrint || {}; return parsed?.kind === 'reportExportRequest' && reportPrint?.kind === 'reportPrint' && reportPrint?.title === ${JSON.stringify(String(exportTitle))} && raw.includes(${JSON.stringify(`"id": "${String(bookmarkId)}"` )}) && ${extraPayloadText ? `raw.includes(${JSON.stringify(String(extraPayloadText))})` : "true"}; } catch (_) { return false; } })()`,
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const summary = Array.from(document.querySelectorAll('[aria-label=\"Reopened export request summary\"]')).find(Boolean); if (!summary) { throw new Error('Reopened export request summary not found.'); } const container = summary.closest('.forge-report-builder__chart-inline-notice'); if (!container) { throw new Error('Reopened export request container not found.'); } const button = Array.from(container.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Download export request')); if (!button) { throw new Error('Download export request button not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: `window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === ${JSON.stringify(String(expectedFilename))} && window.__artifactDownloadCapture.payloadReady === true`,
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => { if (!window.__artifactDownloadCapture?.payloadReady) { return false; } const raw = window.__artifactDownloadCapture?.payload || ''; if (!window.__artifactDownloadCapture?.mimeType?.includes('application/json') || !raw) { return false; } try { const parsed = JSON.parse(raw); const reportPrint = parsed?.reportPrint || {}; return parsed?.kind === 'reportExportRequest' && reportPrint?.kind === 'reportPrint' && reportPrint?.title === ${JSON.stringify(String(exportTitle))} && raw.includes(${JSON.stringify(`"id": "${String(bookmarkId)}"` )}) && ${extraPayloadText ? `raw.includes(${JSON.stringify(String(extraPayloadText))})` : "true"}; } catch (_) { return false; } })()`,
      timeoutMs: 60000,
    },
  ];
}

export function buildImportedListEntryFixturePreparationSteps({
  fixtureModulePath = "",
  fixtureBuilderName = "",
  savedRecordProperty = "savedReportRecord",
  listResponseProperty = "listReportDocumentsResponse",
  savedRecordFilename = "saved-record.json",
  listResponseFilename = "list-response.json",
  savedRecordNoticeText = "Imported saved report record Capacity Audience Segment Index Q3. Reopen and export are ready.",
  listResponseNoticeText = "Imported listReportDocuments response with 1 entry.",
  listResponseSummaryText = "List ReportDocuments response: 1 entries",
  selectedEntryText = "Selected entry: Capacity Audience Segment Index Q3",
  captureDownloads = false,
} = {}) {
  const normalizedFixtureModulePath = normalizeString(fixtureModulePath);
  const normalizedFixtureBuilderName = normalizeString(fixtureBuilderName);
  if (!normalizedFixtureModulePath || !normalizedFixtureBuilderName) {
    throw new Error("buildImportedListEntryFixturePreparationSteps requires fixtureModulePath and fixtureBuilderName.");
  }
  return [
    ...buildPreviewBootstrapSteps({ captureDownloads }),
    {
      type: "eval",
      expression: `(() => { const input = document.querySelector('input[aria-label="Import report file"]'); if (!input) { throw new Error('import api unavailable'); } return import(${JSON.stringify(normalizedFixtureModulePath)}).then(({ ${normalizedFixtureBuilderName} }) => { const fixture = ${normalizedFixtureBuilderName}(); const file = new File([JSON.stringify(fixture.${savedRecordProperty}, null, 2)], ${JSON.stringify(String(savedRecordFilename))}, { type: 'application/json' }); const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true; }); })()`,
    },
    {
      type: "waitForDomContains",
      text: String(savedRecordNoticeText),
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: `(() => { const input = document.querySelector('input[aria-label="Import report file"]'); if (!input) { throw new Error('import api unavailable'); } return import(${JSON.stringify(normalizedFixtureModulePath)}).then(({ ${normalizedFixtureBuilderName} }) => { const fixture = ${normalizedFixtureBuilderName}(); const file = new File([JSON.stringify(fixture.${listResponseProperty}, null, 2)], ${JSON.stringify(String(listResponseFilename))}, { type: 'application/json' }); const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true; }); })()`,
    },
    {
      type: "waitForDomContains",
      text: String(listResponseNoticeText),
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: String(listResponseSummaryText),
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: String(selectedEntryText),
      timeoutMs: 60000,
    },
  ];
}

export function buildSelectedListEntryExportButtonStep({
  mode = "submit",
  sectionIncludes = "List ReportDocuments response:",
} = {}) {
  const normalizedMode = normalizeString(mode).toLowerCase();
  const matchExpression = normalizedMode === "inspect"
    ? "(text === 'Inspect export' || text === 'Review export' || (/^Inspect .*export$/.test(text)) || (/^Review .*export$/.test(text)))"
    : "(/^Export /.test(text) || /^Review .* export$/.test(text))";
  const missingMessage = normalizedMode === "inspect"
    ? "Selected list entry export button not found."
    : "Selected list entry export submit button not found.";
  return {
    type: "eval",
    expression: `(() => { const section = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes(${JSON.stringify(String(sectionIncludes))})); if (!section) { throw new Error('List response section not found.'); } const button = Array.from(section.querySelectorAll('button')).find((entry) => { const text = ((entry.innerText || entry.textContent || '').trim()); return ${matchExpression}; }); if (!button) { throw new Error(${JSON.stringify(missingMessage)}); } button.click(); return true; })()`,
  };
}

export function buildTitledCardButtonClickStep({
  title = "",
  buttonTexts = [],
  buttonTextPattern = "",
  missingButtonMessage = "Card button not found.",
} = {}) {
  const normalizedTitle = normalizeString(title);
  const normalizedButtonTexts = (Array.isArray(buttonTexts) ? buttonTexts : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  const normalizedButtonTextPattern = normalizeString(buttonTextPattern);
  if (!normalizedTitle) {
    throw new Error("buildTitledCardButtonClickStep requires title.");
  }
  if (normalizedButtonTexts.length === 0 && !normalizedButtonTextPattern) {
    throw new Error("buildTitledCardButtonClickStep requires buttonTexts or buttonTextPattern.");
  }
  const matchExpression = normalizedButtonTexts.length > 0
    ? normalizedButtonTexts.map((text) => `text === ${JSON.stringify(text)}`).join(" || ")
    : `new RegExp(${JSON.stringify(normalizedButtonTextPattern)}).test(text)`;
  return {
    type: "eval",
    expression: `(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => { const text = (entry.innerText || entry.textContent || '').trim(); const card = entry.parentElement?.parentElement || null; const title = (card?.firstElementChild?.innerText || card?.firstElementChild?.textContent || '').trim(); return (${matchExpression}) && title === ${JSON.stringify(normalizedTitle)}; }); if (!button) { throw new Error(${JSON.stringify(String(missingButtonMessage))}); } button.click(); return true; })()`,
  };
}

export function buildTemporaryDetailTargetMutationSteps({
  temporaryTargetRef = "",
  authoredTargetRef = "",
  fieldRef = "",
  actionLabel = "Show Channel details",
  title = "Temporary Channel detail",
  navigationMode = "hostRoute",
  parameterKey = "channel",
  parameterValue = "$value",
} = {}) {
  const normalizedTemporaryTargetRef = normalizeString(temporaryTargetRef);
  const normalizedAuthoredTargetRef = normalizeString(authoredTargetRef);
  const normalizedFieldRef = normalizeString(fieldRef);
  const normalizedActionLabel = normalizeString(actionLabel) || "Show Channel details";
  const normalizedTitle = normalizeString(title) || "Temporary Channel detail";
  const normalizedNavigationMode = normalizeString(navigationMode) || "hostRoute";
  const normalizedParameterKey = normalizeString(parameterKey) || "channel";
  const normalizedParameterValue = normalizeString(parameterValue) || "$value";
  if (!normalizedTemporaryTargetRef || !normalizedAuthoredTargetRef || !normalizedFieldRef) {
    throw new Error("buildTemporaryDetailTargetMutationSteps requires temporaryTargetRef, authoredTargetRef, and fieldRef.");
  }
  const temporaryActionID = `detail:${normalizedFieldRef}:${normalizedTemporaryTargetRef}`
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return [
    {
      type: "eval",
      expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderState !== 'function') { throw new Error('patchBuilderState API not available for mutation.'); } return !!preview.patchBuilderState({ drillMetadata: { detailTargets: [ { targetRef: ${JSON.stringify(normalizedTemporaryTargetRef)}, navigationMode: ${JSON.stringify(normalizedNavigationMode)}, title: ${JSON.stringify(normalizedTitle)}, parameters: { ${JSON.stringify(normalizedParameterKey)}: ${JSON.stringify(normalizedParameterValue)} } } ], fieldActions: [ { fieldRef: ${JSON.stringify(normalizedFieldRef)}, actions: [ { id: ${JSON.stringify(temporaryActionID)}, label: ${JSON.stringify(normalizedActionLabel)}, kind: 'detail', targetRef: ${JSON.stringify(normalizedTemporaryTargetRef)} } ] } ] } }); })()`,
    },
    {
      type: "waitForEval",
      expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview && typeof preview.getBuilderState === 'function' ? preview.getBuilderState() : null; const detailTargets = Array.isArray(state?.drillMetadata?.detailTargets) ? state.drillMetadata.detailTargets : []; const target = detailTargets.find((entry) => entry.targetRef === ${JSON.stringify(normalizedTemporaryTargetRef)}) || null; return !!target && target.navigationMode === ${JSON.stringify(normalizedNavigationMode)} && !detailTargets.some((entry) => entry.targetRef === ${JSON.stringify(normalizedAuthoredTargetRef)}); })()`,
      timeoutMs: 60000,
    },
  ];
}

export function buildAuthoredDetailTargetRestorationWaitStep({
  targetRef = "",
  fieldRef = "",
  navigationMode = "modal",
  parameters = {},
  requireFieldAction = false,
  absentDetailTargetRefs = [],
  absentFieldActionTargetRefs = [],
} = {}) {
  const normalizedTargetRef = normalizeString(targetRef);
  const normalizedFieldRef = normalizeString(fieldRef);
  const normalizedNavigationMode = normalizeString(navigationMode) || "modal";
  const normalizedAbsentDetailTargetRefs = (Array.isArray(absentDetailTargetRefs) ? absentDetailTargetRefs : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  const normalizedAbsentFieldActionTargetRefs = (Array.isArray(absentFieldActionTargetRefs) ? absentFieldActionTargetRefs : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  if (!normalizedTargetRef) {
    throw new Error("buildAuthoredDetailTargetRestorationWaitStep requires targetRef.");
  }
  if ((requireFieldAction || normalizedAbsentFieldActionTargetRefs.length > 0) && !normalizedFieldRef) {
    throw new Error("buildAuthoredDetailTargetRestorationWaitStep requires fieldRef when field-action validation is enabled.");
  }
  const parameterChecks = Object.entries(parameters || {})
    .map(([key, value]) => `target.parameters?.${normalizeString(key)} === ${JSON.stringify(String(value))}`)
    .filter(Boolean);
  const fieldActionChecks = (requireFieldAction || normalizedAbsentFieldActionTargetRefs.length > 0)
    ? [
      `const fieldAction = Array.isArray(state?.drillMetadata?.fieldActions) ? state.drillMetadata.fieldActions.find((entry) => entry.fieldRef === ${JSON.stringify(normalizedFieldRef)}) : null;`,
      ...(requireFieldAction ? [
        "if (!fieldAction) { return false; }",
        `if (!(Array.isArray(fieldAction.actions) && fieldAction.actions.some((entry) => entry.targetRef === ${JSON.stringify(normalizedTargetRef)}))) { return false; }`,
      ] : []),
      ...normalizedAbsentFieldActionTargetRefs.map((entry) => `if (fieldAction && Array.isArray(fieldAction.actions) && fieldAction.actions.some((action) => action.targetRef === ${JSON.stringify(entry)})) { return false; }`),
    ]
    : [];
  return {
    type: "waitForEval",
    expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview && typeof preview.getBuilderState === 'function' ? preview.getBuilderState() : null; const detailTargets = Array.isArray(state?.drillMetadata?.detailTargets) ? state.drillMetadata.detailTargets : []; const target = detailTargets.find((entry) => entry.targetRef === ${JSON.stringify(normalizedTargetRef)}) || null; if (!target || target.navigationMode !== ${JSON.stringify(normalizedNavigationMode)}) { return false; } ${parameterChecks.map((check) => `if (!(${check})) { return false; }`).join(" ")} ${normalizedAbsentDetailTargetRefs.map((entry) => `if (detailTargets.some((detailTarget) => detailTarget.targetRef === ${JSON.stringify(entry)})) { return false; }`).join(" ")} ${fieldActionChecks.join(" ")} return true; })()`,
    timeoutMs: 60000,
  };
}

export function buildRuntimeDetailTargetResolutionSteps({
  runtimeScopeSelector = "",
  actionSelector = ".forge-report-runtime-table-panel .forge-dashboard-row-action",
  actionText = "",
  resolvedText = "Resolved detail target",
  hostIntentSelector = ".forge-report-runtime-host-intent",
  expectedTexts = [],
  forbiddenTexts = [],
} = {}) {
  const normalizedRuntimeScopeSelector = normalizeString(runtimeScopeSelector);
  const normalizedActionSelector = normalizeString(actionSelector) || ".forge-report-runtime-table-panel .forge-dashboard-row-action";
  const normalizedActionText = normalizeString(actionText);
  const normalizedResolvedText = normalizeString(resolvedText) || "Resolved detail target";
  const normalizedHostIntentSelector = normalizeString(hostIntentSelector) || ".forge-report-runtime-host-intent";
  const normalizedExpectedTexts = (Array.isArray(expectedTexts) ? expectedTexts : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  const normalizedForbiddenTexts = (Array.isArray(forbiddenTexts) ? forbiddenTexts : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  if (!normalizedActionText) {
    throw new Error("buildRuntimeDetailTargetResolutionSteps requires actionText.");
  }
  if (normalizedExpectedTexts.length === 0) {
    throw new Error("buildRuntimeDetailTargetResolutionSteps requires expectedTexts.");
  }
  const fullActionSelector = normalizedRuntimeScopeSelector
    ? `${normalizedRuntimeScopeSelector} ${normalizedActionSelector}`
    : normalizedActionSelector;
  const fullHostIntentSelector = normalizedRuntimeScopeSelector
    ? `${normalizedRuntimeScopeSelector} ${normalizedHostIntentSelector}`
    : normalizedHostIntentSelector;
  const runtimeTextExpression = normalizedRuntimeScopeSelector
    ? `document.querySelector(${JSON.stringify(normalizedRuntimeScopeSelector)})?.innerText || ''`
    : "document.body?.innerText || document.body?.textContent || ''";
  return [
    {
      type: "waitForEval",
      expression: `document.querySelectorAll(${JSON.stringify(fullActionSelector)}).length >= 1`,
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: fullActionSelector,
      text: normalizedActionText,
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: normalizedResolvedText,
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => { const panel = document.querySelector(${JSON.stringify(fullHostIntentSelector)}); const runtimeText = ${runtimeTextExpression}; const text = panel?.innerText || panel?.textContent || ''; return ${normalizedExpectedTexts.map((entry) => `text.includes(${JSON.stringify(entry)})`).join(" && ")}${normalizedForbiddenTexts.length > 0 ? ` && ${normalizedForbiddenTexts.map((entry) => `!runtimeText.includes(${JSON.stringify(entry)})`).join(" && ")}` : ""}; })()`,
      timeoutMs: 60000,
    },
  ];
}

export function buildRuntimeChartDetailTargetResolutionSteps({
  runtimeScopeSelector = "",
  chartPanelSelector = ".forge-report-runtime-chart-panel",
  markSelector = ".recharts-bar-rectangle",
  actionSelector = ".forge-report-runtime-chart-action",
  actionText = "",
  selectedValueTexts = [],
  resolvedText = "Resolved detail target",
  hostIntentSelector = ".forge-report-runtime-host-intent",
  expectedTexts = [],
  forbiddenTexts = [],
} = {}) {
  const normalizedRuntimeScopeSelector = normalizeString(runtimeScopeSelector);
  const normalizedChartPanelSelector = normalizeString(chartPanelSelector) || ".forge-report-runtime-chart-panel";
  const normalizedMarkSelector = normalizeString(markSelector) || ".recharts-bar-rectangle";
  const normalizedActionSelector = normalizeString(actionSelector) || ".forge-report-runtime-chart-action";
  const normalizedActionText = normalizeString(actionText);
  const normalizedSelectedValueTexts = (Array.isArray(selectedValueTexts) ? selectedValueTexts : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  const normalizedResolvedText = normalizeString(resolvedText) || "Resolved detail target";
  const normalizedHostIntentSelector = normalizeString(hostIntentSelector) || ".forge-report-runtime-host-intent";
  const normalizedExpectedTexts = (Array.isArray(expectedTexts) ? expectedTexts : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  const normalizedForbiddenTexts = (Array.isArray(forbiddenTexts) ? forbiddenTexts : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  if (!normalizedActionText) {
    throw new Error("buildRuntimeChartDetailTargetResolutionSteps requires actionText.");
  }
  if (normalizedSelectedValueTexts.length === 0) {
    throw new Error("buildRuntimeChartDetailTargetResolutionSteps requires selectedValueTexts.");
  }
  if (normalizedExpectedTexts.length === 0) {
    throw new Error("buildRuntimeChartDetailTargetResolutionSteps requires expectedTexts.");
  }
  const fullChartPanelSelector = normalizedRuntimeScopeSelector
    ? `${normalizedRuntimeScopeSelector} ${normalizedChartPanelSelector}`
    : normalizedChartPanelSelector;
  const fullMarkSelector = `${fullChartPanelSelector} ${normalizedMarkSelector}`;
  const fullActionSelector = normalizedRuntimeScopeSelector
    ? `${normalizedRuntimeScopeSelector} ${normalizedActionSelector}`
    : normalizedActionSelector;
  const fullHostIntentSelector = normalizedRuntimeScopeSelector
    ? `${normalizedRuntimeScopeSelector} ${normalizedHostIntentSelector}`
    : normalizedHostIntentSelector;
  const runtimeTextExpression = normalizedRuntimeScopeSelector
    ? `document.querySelector(${JSON.stringify(normalizedRuntimeScopeSelector)})?.innerText || ''`
    : "document.body?.innerText || document.body?.textContent || ''";
  return [
    {
      type: "waitForEval",
      expression: `(() => { const panel = document.querySelector(${JSON.stringify(fullChartPanelSelector)}); return !!panel && panel.querySelectorAll(${JSON.stringify(normalizedMarkSelector)}).length >= 1; })()`,
      timeoutMs: 60000,
    },
    {
      type: "clickSelector",
      selector: fullMarkSelector,
      index: 0,
    },
    {
      type: "waitForEval",
      expression: `(() => { const panel = document.querySelector(${JSON.stringify(fullChartPanelSelector)}); const text = panel?.innerText || panel?.textContent || ''; return ${normalizedSelectedValueTexts.map((entry) => `text.includes(${JSON.stringify(entry)})`).join(" && ")} && text.includes(${JSON.stringify(normalizedActionText)}); })()`,
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: fullActionSelector,
      text: normalizedActionText,
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: normalizedResolvedText,
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => { const panel = document.querySelector(${JSON.stringify(fullHostIntentSelector)}); const runtimeText = ${runtimeTextExpression}; const text = panel?.innerText || panel?.textContent || ''; return ${normalizedExpectedTexts.map((entry) => `text.includes(${JSON.stringify(entry)})`).join(" && ")}${normalizedForbiddenTexts.length > 0 ? ` && ${normalizedForbiddenTexts.map((entry) => `!runtimeText.includes(${JSON.stringify(entry)})`).join(" && ")}` : ""}; })()`,
      timeoutMs: 60000,
    },
  ];
}

export function buildRuntimeChartDetailTargetFailureSteps({
  runtimeScopeSelector = "",
  chartPanelSelector = ".forge-report-runtime-chart-panel",
  actionSelector = ".forge-report-runtime-chart-action",
  actionText = "",
  selectedValueTexts = [],
  diagnosticsText = "Runtime Diagnostics",
  hostIntentSelector = ".forge-report-runtime-host-intent",
  failureTargetRef = "",
  failureMessage = "Detail target resolution failed.",
  resolvedText = "Resolved detail target",
} = {}) {
  const normalizedRuntimeScopeSelector = normalizeString(runtimeScopeSelector);
  const normalizedChartPanelSelector = normalizeString(chartPanelSelector) || ".forge-report-runtime-chart-panel";
  const normalizedActionSelector = normalizeString(actionSelector) || ".forge-report-runtime-chart-action";
  const normalizedActionText = normalizeString(actionText);
  const normalizedSelectedValueTexts = (Array.isArray(selectedValueTexts) ? selectedValueTexts : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  const normalizedDiagnosticsText = normalizeString(diagnosticsText) || "Runtime Diagnostics";
  const normalizedHostIntentSelector = normalizeString(hostIntentSelector) || ".forge-report-runtime-host-intent";
  const normalizedFailureTargetRef = normalizeString(failureTargetRef);
  const normalizedFailureMessage = normalizeString(failureMessage) || "Detail target resolution failed.";
  const normalizedResolvedText = normalizeString(resolvedText) || "Resolved detail target";
  if (!normalizedActionText || !normalizedFailureTargetRef) {
    throw new Error("buildRuntimeChartDetailTargetFailureSteps requires actionText and failureTargetRef.");
  }
  if (normalizedSelectedValueTexts.length === 0) {
    throw new Error("buildRuntimeChartDetailTargetFailureSteps requires selectedValueTexts.");
  }
  const fullChartPanelSelector = normalizedRuntimeScopeSelector
    ? `${normalizedRuntimeScopeSelector} ${normalizedChartPanelSelector}`
    : normalizedChartPanelSelector;
  const fullActionSelector = normalizedRuntimeScopeSelector
    ? `${normalizedRuntimeScopeSelector} ${normalizedActionSelector}`
    : normalizedActionSelector;
  const fullHostIntentSelector = normalizedRuntimeScopeSelector
    ? `${normalizedRuntimeScopeSelector} ${normalizedHostIntentSelector}`
    : normalizedHostIntentSelector;
  const runtimeRootExpression = normalizedRuntimeScopeSelector
    ? `document.querySelector(${JSON.stringify(normalizedRuntimeScopeSelector)})`
    : "document.body";
  return [
    {
      type: "waitForEval",
      expression: `(() => { const panel = document.querySelector(${JSON.stringify(fullChartPanelSelector)}); const text = panel?.innerText || panel?.textContent || ''; return ${normalizedSelectedValueTexts.map((entry) => `text.includes(${JSON.stringify(entry)})`).join(" && ")} && text.includes(${JSON.stringify(normalizedActionText)}); })()`,
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: fullActionSelector,
      text: normalizedActionText,
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: normalizedDiagnosticsText,
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `document.querySelector(${JSON.stringify(fullHostIntentSelector)}) == null`,
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => { const panel = ${runtimeRootExpression}; const chartPanel = document.querySelector(${JSON.stringify(fullChartPanelSelector)}); const text = panel?.innerText || panel?.textContent || ''; return !!chartPanel && text.includes(${JSON.stringify(`Failed to resolve detail target ${normalizedFailureTargetRef}. ${normalizedFailureMessage}`)}) && !text.includes(${JSON.stringify(normalizedResolvedText)}); })()`,
      timeoutMs: 60000,
    },
  ];
}

export function buildRuntimeHostIntentDismissSteps({
  runtimeScopeSelector = "",
  buttonText = "Dismiss intent",
  missingButtonMessage = "Runtime dismiss intent button not found.",
  hostIntentSelector = ".forge-report-runtime-host-intent",
} = {}) {
  const normalizedRuntimeScopeSelector = normalizeString(runtimeScopeSelector);
  const normalizedButtonText = normalizeString(buttonText) || "Dismiss intent";
  const normalizedMissingButtonMessage = normalizeString(missingButtonMessage) || "Runtime dismiss intent button not found.";
  const normalizedHostIntentSelector = normalizeString(hostIntentSelector) || ".forge-report-runtime-host-intent";
  const fullHostIntentSelector = normalizedRuntimeScopeSelector
    ? `${normalizedRuntimeScopeSelector} ${normalizedHostIntentSelector}`
    : normalizedHostIntentSelector;
  return [
    {
      type: "eval",
      expression: `(() => { const button = Array.from(document.querySelectorAll(${JSON.stringify(normalizedRuntimeScopeSelector ? `${normalizedRuntimeScopeSelector} button` : "button")})).find((entry) => ((entry.innerText || entry.textContent || '').trim() === ${JSON.stringify(normalizedButtonText)})); if (!button) { throw new Error(${JSON.stringify(normalizedMissingButtonMessage)}); } button.click(); return true; })()`,
    },
    {
      type: "waitForEval",
      expression: `document.querySelector(${JSON.stringify(fullHostIntentSelector)}) == null`,
      timeoutMs: 60000,
    },
  ];
}

export function buildStandaloneRuntimeChartDetailTargetResolutionSteps({
  excludedRuntimeScopeSelector = ".forge-report-builder__runtime-preview",
  chartPanelSelector = ".forge-report-runtime-chart-panel",
  markSelector = ".recharts-bar-rectangle",
  actionSelector = ".forge-report-runtime-chart-action",
  actionText = "",
  selectedValueTexts = [],
  hostIntentSelector = ".forge-report-runtime-host-intent",
  expectedTexts = [],
  forbiddenTexts = [],
  missingMarkMessage = "Standalone runtime chart mark not found.",
  missingActionMessage = "Standalone runtime chart action not found.",
} = {}) {
  const normalizedExcludedRuntimeScopeSelector = normalizeString(excludedRuntimeScopeSelector) || ".forge-report-builder__runtime-preview";
  const normalizedChartPanelSelector = normalizeString(chartPanelSelector) || ".forge-report-runtime-chart-panel";
  const normalizedMarkSelector = normalizeString(markSelector) || ".recharts-bar-rectangle";
  const normalizedActionSelector = normalizeString(actionSelector) || ".forge-report-runtime-chart-action";
  const normalizedActionText = normalizeString(actionText);
  const normalizedSelectedValueTexts = (Array.isArray(selectedValueTexts) ? selectedValueTexts : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  const normalizedHostIntentSelector = normalizeString(hostIntentSelector) || ".forge-report-runtime-host-intent";
  const normalizedExpectedTexts = (Array.isArray(expectedTexts) ? expectedTexts : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  const normalizedForbiddenTexts = (Array.isArray(forbiddenTexts) ? forbiddenTexts : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  const normalizedMissingMarkMessage = normalizeString(missingMarkMessage) || "Standalone runtime chart mark not found.";
  const normalizedMissingActionMessage = normalizeString(missingActionMessage) || "Standalone runtime chart action not found.";
  if (!normalizedActionText) {
    throw new Error("buildStandaloneRuntimeChartDetailTargetResolutionSteps requires actionText.");
  }
  if (normalizedSelectedValueTexts.length === 0) {
    throw new Error("buildStandaloneRuntimeChartDetailTargetResolutionSteps requires selectedValueTexts.");
  }
  if (normalizedExpectedTexts.length === 0) {
    throw new Error("buildStandaloneRuntimeChartDetailTargetResolutionSteps requires expectedTexts.");
  }
  return [
    {
      type: "waitForEval",
      expression: `(() => { const panels = Array.from(document.querySelectorAll(${JSON.stringify(normalizedChartPanelSelector)})).filter((entry) => !entry.closest(${JSON.stringify(normalizedExcludedRuntimeScopeSelector)})); return panels.length >= 1 && panels.some((entry) => entry.querySelectorAll(${JSON.stringify(normalizedMarkSelector)}).length >= 1); })()`,
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: `(() => { const panel = Array.from(document.querySelectorAll(${JSON.stringify(normalizedChartPanelSelector)})).find((entry) => !entry.closest(${JSON.stringify(normalizedExcludedRuntimeScopeSelector)})); const mark = panel?.querySelector(${JSON.stringify(normalizedMarkSelector)}); if (!mark) { throw new Error(${JSON.stringify(normalizedMissingMarkMessage)}); } mark.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()`,
    },
    {
      type: "waitForEval",
      expression: `(() => { const panel = Array.from(document.querySelectorAll(${JSON.stringify(normalizedChartPanelSelector)})).find((entry) => !entry.closest(${JSON.stringify(normalizedExcludedRuntimeScopeSelector)})); const text = panel?.innerText || panel?.textContent || ''; return ${normalizedSelectedValueTexts.map((entry) => `text.includes(${JSON.stringify(entry)})`).join(" && ")} && text.includes(${JSON.stringify(normalizedActionText)}); })()`,
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: `(() => { const panel = Array.from(document.querySelectorAll(${JSON.stringify(normalizedChartPanelSelector)})).find((entry) => !entry.closest(${JSON.stringify(normalizedExcludedRuntimeScopeSelector)})); const button = Array.from(panel?.querySelectorAll(${JSON.stringify(normalizedActionSelector)}) || []).find((entry) => ((entry.innerText || entry.textContent || '').trim() === ${JSON.stringify(normalizedActionText)})); if (!button) { throw new Error(${JSON.stringify(normalizedMissingActionMessage)}); } button.click(); return true; })()`,
    },
    {
      type: "waitForEval",
      expression: `(() => { const panel = Array.from(document.querySelectorAll(${JSON.stringify(normalizedHostIntentSelector)})).find((entry) => !entry.closest(${JSON.stringify(normalizedExcludedRuntimeScopeSelector)})); const text = panel?.innerText || panel?.textContent || ''; return ${normalizedExpectedTexts.map((entry) => `text.includes(${JSON.stringify(entry)})`).join(" && ")}${normalizedForbiddenTexts.length > 0 ? ` && ${normalizedForbiddenTexts.map((entry) => `!text.includes(${JSON.stringify(entry)})`).join(" && ")}` : ""}; })()`,
      timeoutMs: 60000,
    },
  ];
}

export function buildDetailTargetBehaviorInjectionSteps({
  targetRef = "",
  errorMessage = "Detail target resolution failed.",
  missingApiMessage = "replaceDetailTargetBehaviors API not available.",
  expectedBehaviorCount = 1,
} = {}) {
  const normalizedTargetRef = normalizeString(targetRef);
  const normalizedErrorMessage = normalizeString(errorMessage) || "Detail target resolution failed.";
  const normalizedMissingApiMessage = normalizeString(missingApiMessage) || "replaceDetailTargetBehaviors API not available.";
  const normalizedExpectedBehaviorCount = Number(expectedBehaviorCount);
  if (!normalizedTargetRef) {
    throw new Error("buildDetailTargetBehaviorInjectionSteps requires targetRef.");
  }
  if (!Number.isFinite(normalizedExpectedBehaviorCount) || normalizedExpectedBehaviorCount < 0) {
    throw new Error("buildDetailTargetBehaviorInjectionSteps requires expectedBehaviorCount >= 0.");
  }
  return [
    {
      type: "eval",
      expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceDetailTargetBehaviors !== 'function') { throw new Error(${JSON.stringify(normalizedMissingApiMessage)}); } return preview.replaceDetailTargetBehaviors([{ match: { targetRef: ${JSON.stringify(normalizedTargetRef)} }, error: ${JSON.stringify(normalizedErrorMessage)} }]); })()`,
    },
    {
      type: "waitForEval",
      expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && Array.isArray(preview.detailTargetBehaviors) && preview.detailTargetBehaviors.length === ${normalizedExpectedBehaviorCount}; })()`,
      timeoutMs: 60000,
    },
  ];
}

export function buildDetailTargetBehaviorNullResultSteps({
  targetRef = "",
  missingApiMessage = "replaceDetailTargetBehaviors API not available.",
  expectedBehaviorCount = 1,
} = {}) {
  const normalizedTargetRef = normalizeString(targetRef);
  const normalizedMissingApiMessage = normalizeString(missingApiMessage) || "replaceDetailTargetBehaviors API not available.";
  const normalizedExpectedBehaviorCount = Number(expectedBehaviorCount);
  if (!normalizedTargetRef) {
    throw new Error("buildDetailTargetBehaviorNullResultSteps requires targetRef.");
  }
  if (!Number.isFinite(normalizedExpectedBehaviorCount) || normalizedExpectedBehaviorCount < 0) {
    throw new Error("buildDetailTargetBehaviorNullResultSteps requires expectedBehaviorCount >= 0.");
  }
  return [
    {
      type: "eval",
      expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceDetailTargetBehaviors !== 'function') { throw new Error(${JSON.stringify(normalizedMissingApiMessage)}); } return preview.replaceDetailTargetBehaviors([{ match: { targetRef: ${JSON.stringify(normalizedTargetRef)} }, result: { detailTarget: null } }]); })()`,
    },
    {
      type: "waitForEval",
      expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && Array.isArray(preview.detailTargetBehaviors) && preview.detailTargetBehaviors.length === ${normalizedExpectedBehaviorCount}; })()`,
      timeoutMs: 60000,
    },
  ];
}

export function buildClearDetailTargetBehaviorsSteps({
  missingApiMessage = "clearDetailTargetBehaviors API not available.",
} = {}) {
  const normalizedMissingApiMessage = normalizeString(missingApiMessage) || "clearDetailTargetBehaviors API not available.";
  return [
    {
      type: "eval",
      expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.clearDetailTargetBehaviors !== 'function') { throw new Error(${JSON.stringify(normalizedMissingApiMessage)}); } preview.clearDetailTargetBehaviors(); return true; })()`,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && Array.isArray(preview.detailTargetBehaviors) && preview.detailTargetBehaviors.length === 0; })()",
      timeoutMs: 60000,
    },
  ];
}

export function buildRuntimeChartActionSelectionSteps({
  runtimeScopeSelector = "",
  chartPanelSelector = ".forge-report-runtime-chart-panel",
  markSelector = ".recharts-bar-rectangle",
  actionSelector = ".forge-report-runtime-chart-action",
  actionText = "",
  selectedValueTexts = [],
  clickMarkIndex = 0,
} = {}) {
  const normalizedRuntimeScopeSelector = normalizeString(runtimeScopeSelector);
  const normalizedChartPanelSelector = normalizeString(chartPanelSelector) || ".forge-report-runtime-chart-panel";
  const normalizedMarkSelector = normalizeString(markSelector) || ".recharts-bar-rectangle";
  const normalizedActionSelector = normalizeString(actionSelector) || ".forge-report-runtime-chart-action";
  const normalizedActionText = normalizeString(actionText);
  const normalizedSelectedValueTexts = (Array.isArray(selectedValueTexts) ? selectedValueTexts : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  const normalizedClickMarkIndex = Number(clickMarkIndex);
  if (!normalizedActionText) {
    throw new Error("buildRuntimeChartActionSelectionSteps requires actionText.");
  }
  if (normalizedSelectedValueTexts.length === 0) {
    throw new Error("buildRuntimeChartActionSelectionSteps requires selectedValueTexts.");
  }
  const fullChartPanelSelector = normalizedRuntimeScopeSelector
    ? `${normalizedRuntimeScopeSelector} ${normalizedChartPanelSelector}`
    : normalizedChartPanelSelector;
  const fullMarkSelector = `${fullChartPanelSelector} ${normalizedMarkSelector}`;
  const fullActionSelector = normalizedRuntimeScopeSelector
    ? `${normalizedRuntimeScopeSelector} ${normalizedActionSelector}`
    : normalizedActionSelector;
  return [
    {
      type: "waitForEval",
      expression: `document.querySelectorAll(${JSON.stringify(fullMarkSelector)}).length >= 2`,
      timeoutMs: 60000,
    },
    {
      type: "clickSelector",
      selector: fullMarkSelector,
      index: Number.isFinite(normalizedClickMarkIndex) ? normalizedClickMarkIndex : 0,
    },
    {
      type: "waitForEval",
      expression: `(() => { const panel = document.querySelector(${JSON.stringify(fullChartPanelSelector)}); const text = panel?.innerText || panel?.textContent || ''; return ${normalizedSelectedValueTexts.map((entry) => `text.includes(${JSON.stringify(entry)})`).join(" && ")} && text.includes(${JSON.stringify(normalizedActionText)}); })()`,
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: fullActionSelector,
      text: normalizedActionText,
      index: 0,
    },
  ];
}

export function buildChartQueryBaselineResetSteps({
  baselineKey = "",
  queryType = "chartQuery",
  missingResetMessage = "resetCounters API not available.",
} = {}) {
  const normalizedBaselineKey = normalizeString(baselineKey);
  const normalizedQueryType = normalizeString(queryType) || "chartQuery";
  const normalizedMissingResetMessage = normalizeString(missingResetMessage) || "resetCounters API not available.";
  if (!normalizedBaselineKey) {
    throw new Error("buildChartQueryBaselineResetSteps requires baselineKey.");
  }
  return [
    {
      type: "eval",
      expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.resetCounters !== 'function') { throw new Error(${JSON.stringify(normalizedMissingResetMessage)}); } preview.resetCounters(); preview[${JSON.stringify(normalizedBaselineKey)}] = { startCount: preview.fetchEventHistory.filter((entry) => entry.type === ${JSON.stringify(normalizedQueryType)} && entry.phase === 'start').length, successCount: preview.fetchEventHistory.filter((entry) => entry.type === ${JSON.stringify(normalizedQueryType)} && entry.phase === 'success').length, requestCount: preview.fetchRequestHistory.filter((entry) => entry.type === ${JSON.stringify(normalizedQueryType)}).length }; return true; })()`,
    },
    {
      type: "waitForEval",
      expression: `(() => { const baseline = window.__REPORT_BUILDER_PREVIEW__?.[${JSON.stringify(normalizedBaselineKey)}]; return !!baseline && baseline.startCount === 0 && baseline.successCount === 0 && baseline.requestCount === 0; })()`,
      timeoutMs: 60000,
    },
  ];
}

export function buildChartQueryBaselineStableWaitStep({
  baselineKey = "",
  queryType = "chartQuery",
} = {}) {
  const normalizedBaselineKey = normalizeString(baselineKey);
  const normalizedQueryType = normalizeString(queryType) || "chartQuery";
  if (!normalizedBaselineKey) {
    throw new Error("buildChartQueryBaselineStableWaitStep requires baselineKey.");
  }
  return {
    type: "waitForEval",
    expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = preview?.[${JSON.stringify(normalizedBaselineKey)}]; if (!preview || !baseline) { return false; } const startCount = preview.fetchEventHistory.filter((entry) => entry.type === ${JSON.stringify(normalizedQueryType)} && entry.phase === 'start').length; const successCount = preview.fetchEventHistory.filter((entry) => entry.type === ${JSON.stringify(normalizedQueryType)} && entry.phase === 'success').length; const requestCount = preview.fetchRequestHistory.filter((entry) => entry.type === ${JSON.stringify(normalizedQueryType)}).length; return startCount === baseline.startCount && successCount === baseline.successCount && requestCount === baseline.requestCount; })()`,
    timeoutMs: 60000,
  };
}

export function buildRuntimeDetailTargetFailureSteps({
  runtimeScopeSelector = "",
  surfaceSelector = ".forge-report-runtime-table-panel",
  actionSelector = ".forge-dashboard-row-action",
  actionText = "",
  actionIndex = 0,
  diagnosticsText = "Runtime Diagnostics",
  hostIntentSelector = ".forge-report-runtime-host-intent",
  failureTargetRef = "",
  failureMessage = "Detail target resolution failed.",
  resolvedText = "Resolved detail target",
} = {}) {
  const normalizedRuntimeScopeSelector = normalizeString(runtimeScopeSelector);
  const normalizedSurfaceSelector = normalizeString(surfaceSelector) || ".forge-report-runtime-table-panel";
  const normalizedActionSelector = normalizeString(actionSelector) || ".forge-dashboard-row-action";
  const normalizedActionText = normalizeString(actionText);
  const normalizedActionIndex = Number(actionIndex);
  const normalizedDiagnosticsText = normalizeString(diagnosticsText) || "Runtime Diagnostics";
  const normalizedHostIntentSelector = normalizeString(hostIntentSelector) || ".forge-report-runtime-host-intent";
  const normalizedFailureTargetRef = normalizeString(failureTargetRef);
  const normalizedFailureMessage = normalizeString(failureMessage) || "Detail target resolution failed.";
  const normalizedResolvedText = normalizeString(resolvedText) || "Resolved detail target";
  if (!normalizedActionText || !normalizedFailureTargetRef) {
    throw new Error("buildRuntimeDetailTargetFailureSteps requires actionText and failureTargetRef.");
  }
  const fullSurfaceSelector = normalizedRuntimeScopeSelector
    ? `${normalizedRuntimeScopeSelector} ${normalizedSurfaceSelector}`
    : normalizedSurfaceSelector;
  const fullActionSelector = normalizedRuntimeScopeSelector
    ? `${fullSurfaceSelector} ${normalizedActionSelector}`
    : `${normalizedSurfaceSelector} ${normalizedActionSelector}`;
  const fullHostIntentSelector = normalizedRuntimeScopeSelector
    ? `${normalizedRuntimeScopeSelector} ${normalizedHostIntentSelector}`
    : normalizedHostIntentSelector;
  const runtimeRootExpression = normalizedRuntimeScopeSelector
    ? `document.querySelector(${JSON.stringify(normalizedRuntimeScopeSelector)})`
    : "document.body";
  return [
    {
      type: "waitForEval",
      expression: `document.querySelectorAll(${JSON.stringify(fullActionSelector)}).length >= 1`,
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: fullActionSelector,
      text: normalizedActionText,
      index: Number.isFinite(normalizedActionIndex) ? normalizedActionIndex : 0,
    },
    {
      type: "waitForDomContains",
      text: normalizedDiagnosticsText,
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `document.querySelector(${JSON.stringify(fullHostIntentSelector)}) == null`,
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => { const panel = ${runtimeRootExpression}; const surface = document.querySelector(${JSON.stringify(fullSurfaceSelector)}); const text = panel?.innerText || panel?.textContent || ''; return !!surface && text.includes(${JSON.stringify(`Failed to resolve detail target ${normalizedFailureTargetRef}. ${normalizedFailureMessage}`)}) && !text.includes(${JSON.stringify(normalizedResolvedText)}); })()`,
      timeoutMs: 60000,
    },
  ];
}

export function buildRuntimeResolvedDetailTargetWaitSteps({
  runtimeScopeSelector = "",
  hostIntentSelector = ".forge-report-runtime-host-intent",
  resolvedText = "Resolved detail target",
  expectedTexts = [],
  forbiddenTexts = [],
  requireHostIntent = false,
} = {}) {
  const normalizedRuntimeScopeSelector = normalizeString(runtimeScopeSelector);
  const normalizedHostIntentSelector = normalizeString(hostIntentSelector) || ".forge-report-runtime-host-intent";
  const normalizedResolvedText = normalizeString(resolvedText) || "Resolved detail target";
  const normalizedExpectedTexts = (Array.isArray(expectedTexts) ? expectedTexts : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  const normalizedForbiddenTexts = (Array.isArray(forbiddenTexts) ? forbiddenTexts : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  if (normalizedExpectedTexts.length === 0) {
    throw new Error("buildRuntimeResolvedDetailTargetWaitSteps requires expectedTexts.");
  }
  const runtimeRootExpression = normalizedRuntimeScopeSelector
    ? `document.querySelector(${JSON.stringify(normalizedRuntimeScopeSelector)})`
    : "document.body";
  const fullHostIntentSelector = normalizedRuntimeScopeSelector
    ? `${normalizedRuntimeScopeSelector} ${normalizedHostIntentSelector}`
    : normalizedHostIntentSelector;
  return [
    {
      type: "waitForEval",
      expression: `(() => { const panel = ${runtimeRootExpression}; const text = panel?.innerText || panel?.textContent || ''; return text.includes(${JSON.stringify(normalizedResolvedText)}) && ${normalizedExpectedTexts.map((entry) => `text.includes(${JSON.stringify(entry)})`).join(" && ")}${normalizedForbiddenTexts.length > 0 ? ` && ${normalizedForbiddenTexts.map((entry) => `!text.includes(${JSON.stringify(entry)})`).join(" && ")}` : ""}; })()`,
      timeoutMs: 60000,
    },
    ...(requireHostIntent ? [{
      type: "waitForEval",
      expression: `document.querySelector(${JSON.stringify(fullHostIntentSelector)}) != null`,
      timeoutMs: 60000,
    }] : []),
  ];
}

export function buildSectionButtonClickStep({
  sectionIncludes = "",
  sectionSelector = "div",
  buttonTexts = [],
  buttonTextPattern = "",
  missingSectionMessage = "Section not found.",
  missingButtonMessage = "Section button not found.",
} = {}) {
  const normalizedSectionIncludes = normalizeString(sectionIncludes);
  const normalizedSectionSelector = normalizeString(sectionSelector) || "div";
  const normalizedButtonTexts = (Array.isArray(buttonTexts) ? buttonTexts : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  const normalizedButtonTextPattern = normalizeString(buttonTextPattern);
  if (!normalizedSectionIncludes) {
    throw new Error("buildSectionButtonClickStep requires sectionIncludes.");
  }
  if (normalizedButtonTexts.length === 0 && !normalizedButtonTextPattern) {
    throw new Error("buildSectionButtonClickStep requires buttonTexts or buttonTextPattern.");
  }
  const matchExpression = normalizedButtonTexts.length > 0
    ? normalizedButtonTexts.map((text) => `text === ${JSON.stringify(text)}`).join(" || ")
    : `new RegExp(${JSON.stringify(normalizedButtonTextPattern)}).test(text)`;
  return {
    type: "eval",
    expression: `(() => { const section = Array.from(document.querySelectorAll(${JSON.stringify(normalizedSectionSelector)})).find((entry) => ((entry.innerText || entry.textContent || '')).includes(${JSON.stringify(normalizedSectionIncludes)})); if (!section) { throw new Error(${JSON.stringify(String(missingSectionMessage))}); } const button = Array.from(section.querySelectorAll('button')).find((entry) => { const text = (entry.innerText || entry.textContent || '').trim(); return ${matchExpression}; }); if (!button) { throw new Error(${JSON.stringify(String(missingButtonMessage))}); } button.click(); return true; })()`,
  };
}

export function buildAriaSectionButtonClickStep({
  ariaLabel = "",
  buttonTexts = [],
  buttonTextPattern = "",
  missingSectionMessage = "Section not found.",
  missingButtonMessage = "Section button not found.",
} = {}) {
  const normalizedAriaLabel = normalizeString(ariaLabel);
  const normalizedButtonTexts = (Array.isArray(buttonTexts) ? buttonTexts : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  const normalizedButtonTextPattern = normalizeString(buttonTextPattern);
  if (!normalizedAriaLabel) {
    throw new Error("buildAriaSectionButtonClickStep requires ariaLabel.");
  }
  if (normalizedButtonTexts.length === 0 && !normalizedButtonTextPattern) {
    throw new Error("buildAriaSectionButtonClickStep requires buttonTexts or buttonTextPattern.");
  }
  const matchExpression = normalizedButtonTexts.length > 0
    ? normalizedButtonTexts.map((text) => `text === ${JSON.stringify(text)}`).join(" || ")
    : `new RegExp(${JSON.stringify(normalizedButtonTextPattern)}).test(text)`;
  return {
    type: "eval",
    expression: `(() => { const section = document.querySelector(${JSON.stringify(`section[aria-label="${normalizedAriaLabel}"]`)}); if (!section) { throw new Error(${JSON.stringify(String(missingSectionMessage))}); } const button = Array.from(section.querySelectorAll('button')).find((entry) => { const text = (entry.innerText || entry.textContent || '').trim(); return ${matchExpression}; }); if (!button) { throw new Error(${JSON.stringify(String(missingButtonMessage))}); } button.click(); return true; })()`,
  };
}

export function buildImportedFixtureArtifactSteps({
  fixtureModulePath = "",
  fixtureBuilderName = "",
  fixtureValueExpression = "fixture",
  filename = "artifact.json",
  importedNoticeText = "",
  captureDownloads = false,
} = {}) {
  const normalizedFixtureModulePath = normalizeString(fixtureModulePath);
  const normalizedFixtureBuilderName = normalizeString(fixtureBuilderName);
  const normalizedFixtureValueExpression = normalizeString(fixtureValueExpression);
  if (!normalizedFixtureModulePath || !normalizedFixtureBuilderName || !normalizedFixtureValueExpression) {
    throw new Error("buildImportedFixtureArtifactSteps requires fixtureModulePath, fixtureBuilderName, and fixtureValueExpression.");
  }
  return [
    ...buildPreviewBootstrapSteps({ captureDownloads }),
    {
      type: "eval",
      expression: `(() => { const input = document.querySelector('input[aria-label="Import report file"]'); if (!input) { throw new Error('import api unavailable'); } return import(${JSON.stringify(normalizedFixtureModulePath)}).then(({ ${normalizedFixtureBuilderName} }) => { const fixture = ${normalizedFixtureBuilderName}(); const payload = ${normalizedFixtureValueExpression}; if (!payload) { throw new Error('fixture payload not found'); } const file = new File([JSON.stringify(payload, null, 2)], ${JSON.stringify(String(filename))}, { type: 'application/json' }); const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true; }); })()`,
    },
    {
      type: "waitForDomContains",
      text: String(importedNoticeText),
      timeoutMs: 60000,
    },
  ];
}

export function buildSeededSavedPayloadArtifactImportSteps({
  reportId = "",
  artifactExpression = "payload",
  filename = "artifact.json",
  missingArtifactMessage = "seeded artifact not found",
  importedNoticeText = "",
  captureDownloads = false,
} = {}) {
  const normalizedArtifactExpression = normalizeString(artifactExpression);
  const normalizedReportId = normalizeString(reportId);
  if (!normalizedArtifactExpression) {
    throw new Error("buildSeededSavedPayloadArtifactImportSteps requires artifactExpression.");
  }
  return [
    ...buildPreviewBootstrapSteps({ captureDownloads }),
    {
      type: "eval",
      expression: `(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const input = document.querySelector('input[aria-label="Import report file"]'); if (!preview || typeof preview.getSeededSavedReportPayloads !== 'function' || !input) { throw new Error('import api unavailable'); } const payloads = preview.getSeededSavedReportPayloads(); const target = payloads.find((entry) => (entry?.savedReportPayload?.reportDocument?.id || entry?.reportId) === ${JSON.stringify(normalizedReportId)}); if (!target) { throw new Error(${JSON.stringify(normalizedReportId ? `seeded saved report payload '${normalizedReportId}' not found` : "seeded saved report payload not found")}); } const record = target; const payload = target?.savedReportPayload || target; const artifact = ${normalizedArtifactExpression}; if (!artifact) { throw new Error(${JSON.stringify(String(missingArtifactMessage))}); } const file = new File([JSON.stringify(artifact, null, 2)], ${JSON.stringify(String(filename))}, { type: 'application/json' }); const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`,
    },
    ...(normalizeString(importedNoticeText) ? [{
      type: "waitForDomContains",
      text: String(importedNoticeText),
      timeoutMs: 60000,
    }] : []),
  ];
}

export function buildInlineArtifactImportSteps({
  artifactExpression = "",
  filename = "artifact.json",
  importedNoticeText = "",
  captureDownloads = false,
} = {}) {
  const normalizedArtifactExpression = normalizeString(artifactExpression);
  if (!normalizedArtifactExpression) {
    throw new Error("buildInlineArtifactImportSteps requires artifactExpression.");
  }
  return [
    ...buildPreviewBootstrapSteps({ captureDownloads }),
    {
      type: "eval",
      expression: `(() => { const input = document.querySelector('input[aria-label="Import report file"]'); if (!input) { throw new Error('import api unavailable'); } const artifact = ${normalizedArtifactExpression}; if (!artifact) { throw new Error('inline artifact not found'); } const file = new File([JSON.stringify(artifact, null, 2)], ${JSON.stringify(String(filename))}, { type: 'application/json' }); const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`,
    },
    ...(normalizeString(importedNoticeText) ? [{
      type: "waitForDomContains",
      text: String(importedNoticeText),
      timeoutMs: 60000,
    }] : []),
  ];
}

export function buildAudienceSemanticBindingWaitStep({
  extraText = "",
} = {}) {
  const extraCheck = normalizeString(extraText)
    ? ` && text.includes(${JSON.stringify(normalizeString(extraText))})`
    : "";
  return {
    type: "waitForEval",
    expression: `(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Measures Audience Index') && text.includes('Parameters Date Range, Audience Segment') && text.includes('Date Range • Channels • Audience Segment')${extraCheck}; })()`,
    timeoutMs: 60000,
  };
}

export function buildAudienceDefinitionRefWaitSteps({
  extraTexts = [],
} = {}) {
  return [
    ...((Array.isArray(extraTexts) ? extraTexts : []).map((text) => ({
      type: "waitForDomContains",
      text: String(text),
      timeoutMs: 60000,
    }))),
    {
      type: "waitForDomContains",
      text: "\"definitionRef\": \"harmonizer://feature/user.segment.index\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"definitionRef\": \"harmonizer://feature/user.segment\"",
      timeoutMs: 60000,
    },
  ];
}

export function buildAudienceArtifactInspectionSteps({
  summaryTexts = [],
  semanticExtraText = "",
  inspectActionStep = null,
  inspectResultTexts = [],
  includeDefinitionRefs = true,
} = {}) {
  const steps = [
    ...((Array.isArray(summaryTexts) ? summaryTexts : []).map((text) => ({
      type: "waitForDomContains",
      text: String(text),
      timeoutMs: 60000,
    }))),
    buildAudienceSemanticBindingWaitStep({ extraText: semanticExtraText }),
  ];
  if (inspectActionStep && typeof inspectActionStep === "object" && !Array.isArray(inspectActionStep)) {
    steps.push(inspectActionStep);
  }
  if (includeDefinitionRefs) {
    steps.push(
      ...buildAudienceDefinitionRefWaitSteps({
        extraTexts: Array.isArray(inspectResultTexts) ? inspectResultTexts : [],
      }),
    );
    return steps;
  }
  steps.push(
    ...((Array.isArray(inspectResultTexts) ? inspectResultTexts : []).map((text) => ({
      type: "waitForDomContains",
      text: String(text),
      timeoutMs: 60000,
    }))),
  );
  return steps;
}

export function buildAudienceReopenVerificationSteps({
  reportTitle = "Capacity Audience Segment Index Q3",
} = {}) {
  const normalizedReportTitle = normalizeString(reportTitle) || "Capacity Audience Segment Index Q3";
  return [
    {
      type: "clickRole",
      role: "button",
      name: "Reopen in builder",
    },
    {
      type: "waitForDomContains",
      text: `Reopened ReportDocument ${normalizedReportTitle} for editing.`,
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: `Reopened ReportDocument: ${normalizedReportTitle}`,
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Semantic binding: Ad Delivery • Entity: Line Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedMeasures) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures[0] === 'audienceIndex' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'country' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.staticFilters?.audienceSegmentFilter) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().staticFilters.audienceSegmentFilter.includes('Young Adults') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.orderField === 'audienceIndex' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'table'",
      timeoutMs: 60000,
    },
  ];
}
