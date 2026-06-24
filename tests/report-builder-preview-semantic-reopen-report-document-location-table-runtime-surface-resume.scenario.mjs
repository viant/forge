import {
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildSavedPayloadPreparationSteps,
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
      type: "waitForEval",
      expression: "!((document.body?.innerText || document.body?.textContent || '').includes('Local Draft'))",
      timeoutMs: 2000,
    },
    {
      type: "assertDomNotContains",
      text: "Local Draft",
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-builder__measure-pill')).some((entry) => ((entry.innerText || entry.textContent || '').trim().includes('Reach Rate')))",
      timeoutMs: 60000,
    },
    ...buildSavedPayloadPreparationSteps({
      documentVersion: "11",
      draftTriggerText: "Reach Rate",
    }),
    {
      type: "waitForDomContains",
      text: "List ReportDocuments response: 7 entries",
      timeoutMs: 60000,
    },
    {
      type: "selectSelector",
      selector: "select[aria-label=\"List response entry\"]",
      value: "capacityLocationQ3",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Location Q3",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"capacityLocationQ3\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Location Q3",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Location Q3",
      reportId: "capacityLocationQ3",
      documentVersion: 11,
      includeSummaryNotice: true,
    }),
    {
      type: "waitForDomContains",
      text: "Template: Capacity Location Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Runtime Diagnostics",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Semantic Binding",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Model Ad Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Entity Line Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Dimensions Market",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Measures Available Impressions, Household Uniques",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "1 deprecated",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened compile diagnostics",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Market • Deprecated",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "semanticGovernance",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.reportDocumentReopenSession?.reportId === 'capacityLocationQ3'",
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
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel'))[0]?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); const hierarchyLabels = ['Market', 'Region', 'Metro Area']; const activeLabels = hierarchyLabels.filter((label) => labels.includes(label)); return labels.includes('Region') && activeLabels.length === 1; })()",
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
      text: "Reopened ReportDocument: Capacity Location Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Template: Capacity Location Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Runtime Diagnostics",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Semantic Binding",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Model Ad Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Market • Deprecated",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "semanticGovernance",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const interaction = preview?.getStandaloneRuntimeInteraction?.(); if (!interaction) { return false; } const headers = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel'))[0]?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); const hierarchyLabels = ['Market', 'Region', 'Metro Area']; const activeLabels = hierarchyLabels.filter((label) => labels.includes(label)); return labels.includes('Region') && activeLabels.length === 1 && Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'region'); })()",
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
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel'))[0]?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); const hierarchyLabels = ['Market', 'Region', 'Metro Area']; const activeLabels = hierarchyLabels.filter((label) => labels.includes(label)); return labels.includes('Metro Area') && activeLabels.length === 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-location-table-runtime-surface-resume.png",
      fullPage: true,
    },
  ],
};
