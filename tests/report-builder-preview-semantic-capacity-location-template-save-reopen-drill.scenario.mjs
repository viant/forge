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
      type: "clickRole",
      role: "button",
      name: "Apply template",
    },
    {
      type: "clickSelectorContains",
      selector: ".bp6-menu-item",
      text: "Capacity Location Brief",
    },
    {
      type: "waitForDomContains",
      text: "Capacity Location Brief applied.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Seeded from template: Capacity Location Brief",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Fork from here",
    },
    {
      type: "waitForDomContains",
      text: "Exploration Session.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Save artifact",
    },
    {
      type: "waitForDomContains",
      text: "Saved exploration artifact: Capacity Location Brief",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare report payload",
    },
    {
      type: "waitForDomContains",
      text: "Saved report payload: Capacity Location Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Template: Capacity Location Brief",
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
      text: "List ReportDocuments response: 7 entries",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Location Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Selected entry: Capacity Location Brief') && text.includes('Template: Capacity Location Brief'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Location Brief",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Hide list response",
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Get ReportDocument response: Capacity Location Brief') && text.includes('Template: Capacity Location Brief'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Reopen in builder')); if (!button) { throw new Error('Reopen in builder button not found.'); } button.click(); })()",
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument Capacity Location Brief for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Capacity Location Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.(); return state?.reportDocumentTemplateId === 'capacity_location_brief' && state?.reportDocumentTemplateLabel === 'Capacity Location Brief' && Array.isArray(state?.reportDocumentLayout?.items) && state.reportDocumentLayout.items.some((item) => item?.blockId === 'narrativeIntro' && item?.size === 'half') && state.reportDocumentLayout.items.some((item) => item?.blockId === 'headlineKpi' && item?.size === 'half'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceStandaloneRuntimeInteraction !== 'function') { return false; } return !!preview.replaceStandaloneRuntimeInteraction({ refinements: [{ op: 'drill', field: 'country', values: ['US'], sourceBlockId: 'primaryTable', label: 'Drill to Region = US' }], drillTransitions: [{ refinementId: 'drill:country:primaryTable', sourceField: 'country', nextFieldRef: 'region', sourceBlockId: 'primaryTable' }], hostIntent: null, detailDiagnostic: null }); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview?.getBuilderState?.(); const interaction = state?.reportDocumentReopenSession?.runtimePreviewInteraction; return !!interaction && interaction.hostIntent === null && interaction.detailDiagnostic === null && Array.isArray(interaction.refinements) && interaction.refinements.some((entry) => entry.field === 'country' && Array.isArray(entry.values) && entry.values[0] === 'US') && Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'region'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const interaction = preview?.getStandaloneRuntimeInteraction?.(); return !!interaction && interaction.hostIntent === null && interaction.detailDiagnostic === null && Array.isArray(interaction.refinements) && interaction.refinements.some((entry) => entry.field === 'country' && Array.isArray(entry.values) && entry.values[0] === 'US') && Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'region'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview .forge-report-runtime-refinement-chip')).some((node) => (node.innerText || node.textContent || '').includes('Drill to Region ='))",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const interaction = preview?.getStandaloneRuntimeInteraction?.(); if (!interaction) { return false; } const headers = document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-table-panel')?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); const hierarchyLabels = ['Market', 'Region', 'Metro Area']; const activeLabels = hierarchyLabels.filter((label) => labels.includes(label)); return labels.includes('Region') && activeLabels.length === 1 && Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'region'); })()",
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
      text: "Reopened ReportDocument: Capacity Location Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview?.getBuilderState?.(); const interaction = preview?.getStandaloneRuntimeInteraction?.(); if (!interaction) { return false; } const headers = document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-table-panel')?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); const hierarchyLabels = ['Market', 'Region', 'Metro Area']; const activeLabels = hierarchyLabels.filter((label) => labels.includes(label)); return Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'region') && Array.isArray(interaction.refinements) && interaction.refinements.some((entry) => entry.field === 'country' && Array.isArray(entry.values) && entry.values[0] === 'US') && state?.reportDocumentTemplateLabel === 'Capacity Location Brief' && labels.includes('Region') && activeLabels.length === 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.advanceStandaloneRuntimeInteraction !== 'function') { return false; } return !!preview.advanceStandaloneRuntimeInteraction((current = null) => { if (!current || !Array.isArray(current.refinements) || !current.refinements.some((entry) => entry.field === 'country' && Array.isArray(entry.values) && entry.values[0] === 'US') || !Array.isArray(current.drillTransitions) || !current.drillTransitions.some((entry) => entry.nextFieldRef === 'region')) { return null; } return { ...current, refinements: [...current.refinements, { op: 'drill', field: 'region', values: ['West'], sourceBlockId: 'primaryTable', label: 'Drill to Metro Area = West' }], drillTransitions: [...current.drillTransitions, { refinementId: 'drill:region:primaryTable', sourceField: 'region', nextFieldRef: 'metrocode', sourceBlockId: 'primaryTable' }], hostIntent: null, detailDiagnostic: null }; }); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview?.getBuilderState?.(); const interaction = state?.reportDocumentReopenSession?.runtimePreviewInteraction; if (!interaction || interaction.hostIntent !== null || interaction.detailDiagnostic !== null || !Array.isArray(interaction.drillTransitions) || !Array.isArray(interaction.refinements)) { return false; } const regionIndex = interaction.drillTransitions.findIndex((entry) => entry.nextFieldRef === 'region'); const metroIndex = interaction.drillTransitions.findIndex((entry) => entry.nextFieldRef === 'metrocode'); return regionIndex >= 0 && metroIndex === regionIndex + 1 && interaction.refinements.some((entry) => entry.field === 'region' && Array.isArray(entry.values) && entry.values[0] === 'West') && interaction.refinements.some((entry) => entry.field === 'country' && Array.isArray(entry.values) && entry.values[0] === 'US'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const interaction = preview?.getStandaloneRuntimeInteraction?.(); if (!interaction || interaction.hostIntent !== null || interaction.detailDiagnostic !== null || !Array.isArray(interaction.drillTransitions) || !Array.isArray(interaction.refinements)) { return false; } const regionIndex = interaction.drillTransitions.findIndex((entry) => entry.nextFieldRef === 'region'); const metroIndex = interaction.drillTransitions.findIndex((entry) => entry.nextFieldRef === 'metrocode'); return regionIndex >= 0 && metroIndex === regionIndex + 1 && interaction.refinements.some((entry) => entry.field === 'region' && Array.isArray(entry.values) && entry.values[0] === 'West') && interaction.refinements.some((entry) => entry.field === 'country' && Array.isArray(entry.values) && entry.values[0] === 'US'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-table-panel')?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); const hierarchyLabels = ['Market', 'Region', 'Metro Area']; const activeLabels = hierarchyLabels.filter((label) => labels.includes(label)); return labels.includes('Metro Area') && !labels.includes('Region') && activeLabels.length === 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-capacity-location-template-save-reopen-drill.png",
      fullPage: true,
    },
  ],
};
