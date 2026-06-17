const DEFAULT_STORAGE_KEYS = [
  "reportBuilder.state.demoReportBuilder.demoReportBuilderWindow",
  "reportBuilder.state.demoReportBuilder",
  "reportBuilder.chartPresets.demoReportBuilder.demoReportBuilderWindow",
  "reportBuilder.chartPresets.demoReportBuilder",
];

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
      expression: `window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === ${JSON.stringify(String(expectedFilename))}`,
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => { const raw = window.__artifactDownloadCapture?.payload || ''; if (!window.__artifactDownloadCapture?.mimeType?.includes('application/json') || !raw) { return false; } try { const parsed = JSON.parse(raw); const reportPrint = parsed?.reportPrint || {}; return parsed?.kind === 'reportExportRequest' && reportPrint?.kind === 'reportPrint' && reportPrint?.title === ${JSON.stringify(String(exportTitle))} && raw.includes(${JSON.stringify(`"id": "${String(bookmarkId)}"` )}) && ${extraPayloadText ? `raw.includes(${JSON.stringify(String(extraPayloadText))})` : "true"}; } catch (_) { return false; } })()`,
      timeoutMs: 60000,
    },
  ];
}
