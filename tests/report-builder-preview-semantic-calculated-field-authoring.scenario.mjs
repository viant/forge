import {
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildSelectedReportDocumentPreparationSteps,
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
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderState !== 'function') { throw new Error('Preview patchBuilderState API not available.'); } const nextState = preview.patchBuilderState({ selectedDimensions: ['eventDate', 'channelV2'], selectedMeasures: ['avails'], primaryMeasure: 'avails', viewMode: 'table', chartSpec: null, orderField: 'avails', orderDir: 'desc' }); return !!nextState && Array.isArray(nextState.selectedDimensions) && nextState.selectedDimensions.includes('channelV2') && nextState.viewMode === 'table'; })()",
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.applyLocalCalculatedField !== 'function') { throw new Error('applyLocalCalculatedField API not available.'); } const result = preview.applyLocalCalculatedField({ draft: { id: 'ctvAvails', label: 'CTV Avails', expr: \"if(channelV2 = 'CTV', avails, null)\" } }); return !!result?.valid && result?.field?.id === 'ctvAvails'; })()",
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-builder__measure-pill')).some((node) => (node.innerText || node.textContent || '').includes('CTV Avails'))",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Local Draft",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const keys = ['reportBuilder.state.demoReportBuilder.demoReportBuilderWindow', 'reportBuilder.state.demoReportBuilder']; return keys.some((key) => { const raw = window.localStorage.getItem(key); if (!raw) { return false; } try { const parsed = JSON.parse(raw); return Array.isArray(parsed?.localCalculatedFields) && parsed.localCalculatedFields.some((entry) => entry?.id === 'ctvAvails' && entry?.expr === \"if(channelV2 = 'CTV', avails, null)\"); } catch (_) { return false; } }); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-builder__table th')).map((entry) => (entry.innerText || entry.textContent || '').trim().toLowerCase()); return headers.includes('ctv avails'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.querySelector('.forge-report-runtime-table-panel')?.innerText || document.querySelector('.forge-report-runtime-table-panel')?.textContent || ''; return text.includes('CTV Avails') && text.includes('34,300'); })()",
      timeoutMs: 60000,
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
      type: "waitForEval",
      expression: "(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.(); return Array.isArray(state?.localCalculatedFields) && state.localCalculatedFields.some((entry) => entry?.id === 'ctvAvails' && entry?.expr === \"if(channelV2 = 'CTV', avails, null)\"); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Local Draft",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-builder__table th')).map((entry) => (entry.innerText || entry.textContent || '').trim().toLowerCase()); return headers.includes('ctv avails'); })()",
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
      text: "\"localCalculatedFields\": [",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"id\": \"ctvAvails\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"expr\": \"if(channelV2 = 'CTV', avails, null)\"",
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
    ...buildSelectedReportDocumentPreparationSteps({
      reportId: "demoReportBuilder",
      responseTitle: "Get ReportDocument response: Report Builder Demo",
    }),
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"getReportDocumentResponse\"",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect get response",
    },
    {
      type: "waitForEval",
      expression: "!!document.querySelector('[aria-label=\"Get ReportDocument response summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('[aria-label=\"Get ReportDocument response summary\"]'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('\"kind\": \"getReportDocumentResponse\"') && text.includes('\"id\": \"ctvAvails\"') && text.includes('\"expr\": \"if(channelV2 = \\'CTV\\', avails, null)\"'); })()",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Report Builder Demo",
      reportId: "demoReportBuilder",
      documentVersion: 11,
    }),
    {
      type: "waitForEval",
      expression: "(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.(); return Array.isArray(state?.localCalculatedFields) && state.localCalculatedFields.some((entry) => entry?.id === 'ctvAvails' && entry?.expr === \"if(channelV2 = 'CTV', avails, null)\"); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-builder__table th')).map((entry) => (entry.innerText || entry.textContent || '').trim().toLowerCase()); return headers.includes('ctv avails'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview, .forge-report-runtime-table-panel')).find((node) => node && node.offsetParent !== null); const text = root?.innerText || root?.textContent || ''; return text.includes('CTV Avails') && text.includes('34,300'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-calculated-field-authoring.png",
      fullPage: true,
    },
  ],
};
