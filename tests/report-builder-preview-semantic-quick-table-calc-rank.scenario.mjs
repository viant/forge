import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

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
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.applyQuickTableCalculation !== 'function') { throw new Error('applyQuickTableCalculation API not available.'); } const result = preview.applyQuickTableCalculation('reachRank'); return !!result?.valid && result?.field?.id === 'reachRank' && result?.prepared?.canApply === true; })()",
    },
    {
      type: "waitForDomContains",
      text: "Local Draft",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const keys = ['reportBuilder.state.demoReportBuilder.demoReportBuilderWindow', 'reportBuilder.state.demoReportBuilder']; return keys.some((key) => { const raw = window.localStorage.getItem(key); if (!raw) { return false; } try { const parsed = JSON.parse(raw); return Array.isArray(parsed?.localTableCalculations) && parsed.localTableCalculations.some((entry) => entry?.id === 'reachRank'); } catch (_) { return false; } }); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-builder__table th')).map((entry) => (entry.innerText || entry.textContent || '').trim().toLowerCase()); return headers.includes('reach rank') && headers.includes('market') && headers.includes('channel'); })()",
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
      type: "waitForDomContains",
      text: "Local Draft",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.(); return Array.isArray(state?.localTableCalculations) && state.localTableCalculations.some((entry) => entry?.id === 'reachRank'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-builder__table th')).map((entry) => (entry.innerText || entry.textContent || '').trim().toLowerCase()); return headers.includes('reach rank') && headers.includes('market') && headers.includes('channel'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-quick-table-calc-rank.png",
      fullPage: true,
    },
  ],
};
