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
      expression: "(() => { const api = window.__REPORT_BUILDER_PREVIEW__; if (!api || typeof api.patchBuilderState !== 'function') { throw new Error('patchBuilderState API not available.'); } const next = api.patchBuilderState({ pageSize: 4, page: 1 }); return next?.pageSize === 4 && next?.page === 1; })()",
    },
    {
      type: "waitForDomContains",
      text: "4 PAGE ROWS",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__measure-pill",
      text: "Reach Rate",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Local Draft.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-builder__table th')).map((entry) => (entry.innerText || entry.textContent || '').trim().toLowerCase()); return headers.includes('reach rate'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const keys = ['reportBuilder.state.demoReportBuilder.demoReportBuilderWindow', 'reportBuilder.state.demoReportBuilder']; for (const key of keys) { const raw = window.localStorage.getItem(key); if (!raw) { continue; } try { const parsed = JSON.parse(raw); const session = parsed?.explorationSession; if (session?.dirty === true) { window.__paginationActiveDraftBaseline = { sessionId: session.sessionId, historyLength: Array.isArray(session.history) ? session.history.length : 0, historyIndex: session.historyIndex, storageKey: key }; return true; } } catch (_) {} } return false; })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Next",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.page === 2)()",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Page 2",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const baseline = window.__paginationActiveDraftBaseline; if (!baseline) { return false; } const text = document.body?.innerText || document.body?.textContent || ''; const firstCell = document.querySelector('.forge-report-builder__table tbody tr td'); const firstValue = (firstCell?.innerText || firstCell?.textContent || '').trim(); const raw = window.localStorage.getItem(baseline.storageKey); if (!raw) { return false; } try { const parsed = JSON.parse(raw); const session = parsed?.explorationSession; return !!session && session.sessionId === baseline.sessionId && (Array.isArray(session.history) ? session.history.length : 0) === baseline.historyLength && session.historyIndex === baseline.historyIndex && session.dirty === true && parsed.page === 2 && firstValue.includes('May 3, 2026') && text.includes('Local Draft.'); } catch (_) { return false; } })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-pagination-active-draft.png",
      fullPage: true,
    },
  ],
};
