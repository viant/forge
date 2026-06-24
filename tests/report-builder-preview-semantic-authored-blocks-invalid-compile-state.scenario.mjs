import {
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.applyAuthoredDocumentBlock !== 'function') { throw new Error('applyAuthoredDocumentBlock API not available.'); } const result = preview.applyAuthoredDocumentBlock({ kind: 'kpiBlock', seed: { id: 'headlineKpi', title: 'Reach KPI' } }); return !!result?.valid; })()",
    },
    {
      type: "waitForDomContains",
      text: "Reach KPI",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const group = Array.from(document.querySelectorAll('.forge-report-builder__measure-pill-group')).find((node) => ((node.innerText || node.textContent || '').includes('Available Impressions'))); const toggle = group?.querySelector('.forge-report-builder__selector-box'); if (!toggle) { throw new Error('Available Impressions toggle not found.'); } toggle.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.(); return Array.isArray(state?.selectedMeasures) && !state.selectedMeasures.includes('avails') && Array.isArray(state?.reportDocumentBlocks) && state.reportDocumentBlocks.some((block) => block?.id === 'headlineKpi'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.beginStandaloneDraft !== 'function') { throw new Error('beginStandaloneDraft API not available.'); } return !!preview.beginStandaloneDraft({ sourceLabel: 'the current result state', patch: { __scenarioDraft: true } }); })()",
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
      type: "waitForDomContains",
      text: "Resolve authored block validation issues before preparing writable ReportDocument payloads.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Headline KPI references unavailable KPI value field 'avails'.",
      timeoutMs: 60000,
    },
    {
      type: "fillSelector",
      selector: "input[aria-label=\"Document version\"]",
      value: "11",
    },
    {
      type: "waitForDomContains",
      text: "Using document version 11.",
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
    {
      type: "selectSelector",
      selector: "select[aria-label=\"List response entry\"]",
      value: "demoReportBuilder",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Selected entry compile warning:",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Headline KPI references unavailable KPI value field 'avails'.",
      timeoutMs: 60000,
    },
    {
      type: "fillSelector",
      selector: "input[aria-label=\"Expected version\"]",
      value: "7",
    },
    {
      type: "waitForDomContains",
      text: "Using expected version 7.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((node) => ((node.innerText || node.textContent || '').trim() === 'Prepare create payload')); return !!button && (button.disabled === true || button.getAttribute('aria-disabled') === 'true'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((node) => ((node.innerText || node.textContent || '').trim() === 'Prepare update payload')); return !!button && (button.disabled === true || button.getAttribute('aria-disabled') === 'true'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument request: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"reportId\": \"demoReportBuilder\"",
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect get request",
    },
    {
      type: "waitForEval",
      expression: "!!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"demoReportBuilder\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Open selected response",
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"Get ReportDocument response summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Persisted compile warning:",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Headline KPI references unavailable KPI value field 'avails'.",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Report Builder Demo",
      reportId: "demoReportBuilder",
      documentVersion: 11,
    }),
    {
      type: "waitForDomContains",
      text: "Reopened compile warning:",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Headline KPI references unavailable KPI value field 'avails'.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const session = window.__REPORT_BUILDER_PREVIEW__?.getHydratedReportDocumentSession?.(); const diagnostic = session?.reopenedCompileState?.diagnostics?.[0]; return session?.reportId === 'demoReportBuilder' && session?.reopenedCompileState?.status === 'invalid' && diagnostic?.code === 'documentBlockValueFieldUnavailable' && diagnostic?.blockId === 'headlineKpi'; })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Edit authored block headlineKpi",
    },
    {
      type: "waitForDomContains",
      text: "Edit KPI Block",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-authored-blocks-invalid-compile-state.png",
      fullPage: true,
    },
  ],
};
