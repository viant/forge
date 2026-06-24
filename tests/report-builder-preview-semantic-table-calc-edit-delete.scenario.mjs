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
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderState !== 'function') { throw new Error('Preview patchBuilderState API not available.'); } const nextState = preview.patchBuilderState({ selectedDimensions: ['eventDate', 'channelV2'], selectedMeasures: ['avails'], primaryMeasure: 'avails', viewMode: 'table', chartSpec: null, orderField: 'avails', orderDir: 'desc' }); return !!nextState && Array.isArray(nextState.selectedDimensions) && nextState.selectedDimensions.includes('channelV2') && nextState.viewMode === 'table'; })()",
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.applyLocalTableCalculationDraft !== 'function') { throw new Error('applyLocalTableCalculationDraft API not available.'); } const result = preview.applyLocalTableCalculationDraft({ draft: { id: 'runningAvails', label: 'Running Avails', functionId: 'runningTotal', sourceField: 'avails', orderByField: 'eventDate', orderDir: 'asc', partitionBy: ['channelV2'] } }); return !!result?.valid && result?.field?.id === 'runningAvails' && result?.prepared?.canApply === true; })()",
    },
    {
      type: "waitForDomContains",
      text: "Local Draft",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.applyLocalTableCalculationDraft !== 'function') { throw new Error('applyLocalTableCalculationDraft API not available.'); } const result = preview.applyLocalTableCalculationDraft({ editingId: 'runningAvails', draft: { id: 'runningAvails', label: 'Running Avails Edited', functionId: 'runningTotal', sourceField: 'avails', orderByField: 'eventDate', orderDir: 'asc', partitionBy: ['channelV2'] } }); return !!result?.valid && result?.field?.id === 'runningAvails'; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-builder__table th')).map((entry) => (entry.innerText || entry.textContent || '').trim().toLowerCase()); return headers.includes('running avails edited'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const keys = ['reportBuilder.state.demoReportBuilder.demoReportBuilderWindow', 'reportBuilder.state.demoReportBuilder']; return keys.some((key) => { const raw = window.localStorage.getItem(key); if (!raw) { return false; } try { const parsed = JSON.parse(raw); return Array.isArray(parsed?.localTableCalculations) && parsed.localTableCalculations.some((entry) => entry?.id === 'runningAvails' && entry?.label === 'Running Avails Edited'); } catch (_) { return false; } }); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.removeLocalTableCalculation !== 'function') { throw new Error('removeLocalTableCalculation API not available.'); } const result = preview.removeLocalTableCalculation('runningAvails'); return !!result && Array.isArray(result.localTableCalculations) && !result.localTableCalculations.some((entry) => entry?.id === 'runningAvails'); })()",
    },
    {
      type: "waitForDomContains",
      text: "Local Draft",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-builder__table th')).map((entry) => (entry.innerText || entry.textContent || '').trim().toLowerCase()); return !headers.includes('running avails edited'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const keys = ['reportBuilder.state.demoReportBuilder.demoReportBuilderWindow', 'reportBuilder.state.demoReportBuilder']; return keys.every((key) => { const raw = window.localStorage.getItem(key); if (!raw) { return true; } try { const parsed = JSON.parse(raw); return !Array.isArray(parsed?.localTableCalculations) || !parsed.localTableCalculations.some((entry) => entry?.id === 'runningAvails'); } catch (_) { return false; } }); })()",
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
      expression: "(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.(); return !Array.isArray(state?.localTableCalculations) || !state.localTableCalculations.some((entry) => entry?.id === 'runningAvails'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-builder__table th')).map((entry) => (entry.innerText || entry.textContent || '').trim().toLowerCase()); return !headers.includes('running avails edited'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-table-calc-edit-delete.png",
      fullPage: true,
    },
  ],
};
