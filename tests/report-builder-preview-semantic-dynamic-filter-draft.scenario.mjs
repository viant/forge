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
      expression: "(() => { const api = window.__REPORT_BUILDER_PREVIEW__; if (!api || typeof api.patchBuilderConfig !== 'function') { throw new Error('patchBuilderConfig API not available.'); } const next = api.patchBuilderConfig({ dynamicFilterGroups: [{ id: 'scopeRules', label: 'Scope Rules', addLabel: 'Add scope rule', filters: [{ id: 'scopeValue', label: 'Scope value', manualEntry: true, manualPlaceholder: 'National' }] }], pinnedDynamicGroupIds: [] }); return Array.isArray(next?.dynamicFilterGroups) && next.dynamicFilterGroups.some((group) => group?.id === 'scopeRules'); })()",
    },
    {
      type: "clickSelectorContains",
      selector: "button",
      text: "Filters & Controls",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const editor = document.querySelector('[data-testid=\"report-builder-runtime-filter-editor\"]'); const text = editor?.innerText || editor?.textContent || ''; return !!editor && text.includes('Scope Rules') && !document.querySelector('.forge-report-builder__overlay-shell'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Scope Rules • available",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const editor = document.querySelector('[data-testid=\"report-builder-runtime-filter-editor\"]'); const text = editor?.innerText || editor?.textContent || ''; return !!editor && text.includes('Add scope rule'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; const keys = ['reportBuilder.state.demoReportBuilder.demoReportBuilderWindow', 'reportBuilder.state.demoReportBuilder']; return !text.includes('Local Draft') && keys.some((key) => { const raw = window.localStorage.getItem(key); if (!raw) { return false; } try { const parsed = JSON.parse(raw); return !parsed?.explorationSession && Array.isArray(parsed?.dynamicGroups?.scopeRules) && parsed.dynamicGroups.scopeRules.length === 1; } catch (_) { return false; } }); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => !!document.querySelector('input[placeholder=\"National\"]'))()",
      timeoutMs: 60000,
    },
    {
      type: "fillSelector",
      selector: "input[placeholder=\"National\"]",
      value: "Regional",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Add value",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Local Draft",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const keys = ['reportBuilder.state.demoReportBuilder.demoReportBuilderWindow', 'reportBuilder.state.demoReportBuilder']; return keys.some((key) => { const raw = window.localStorage.getItem(key); if (!raw) { return false; } try { const parsed = JSON.parse(raw); const rows = parsed?.dynamicGroups?.scopeRules || []; return parsed?.explorationSession?.dirty === true && rows.length === 1 && Array.isArray(rows[0]?.selections) && rows[0].selections.some((entry) => entry?.value === 'Regional' && entry?.label === 'Regional'); } catch (_) { return false; } }); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-dynamic-filter-draft.png",
      fullPage: true,
    },
  ],
};
