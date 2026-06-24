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
      value: "capacityLocationsTopMarketsQ3",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Locations Top Markets Q3",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"capacityLocationsTopMarketsQ3\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Locations Top Markets Q3",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Locations Top Markets Q3",
      reportId: "capacityLocationsTopMarketsQ3",
      documentVersion: 11,
      includeSummaryNotice: true,
    }),
    {
      type: "waitForDomContains",
      text: "Template: Capacity Location Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.reportDocumentReopenSession?.reportId === 'capacityLocationsTopMarketsQ3'",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceStandaloneRuntimeInteraction !== 'function') { return false; } return !!preview.replaceStandaloneRuntimeInteraction({ refinements: [{ op: 'keep', field: 'country', values: ['US'], sourceBlockId: 'primaryChart', label: 'Keep only = US' }], drillTransitions: [{ refinementId: 'keep:country:primaryChart', sourceField: 'country', nextFieldRef: 'region', sourceBlockId: 'primaryChart' }], hostIntent: null, detailDiagnostic: null }); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview?.getBuilderState?.(); const interaction = state?.reportDocumentReopenSession?.runtimePreviewInteraction; return !!interaction && Array.isArray(interaction.refinements) && interaction.refinements.some((entry) => entry.field === 'country' && Array.isArray(entry.values) && entry.values[0] === 'US') && Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'region'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const interaction = preview?.getStandaloneRuntimeInteraction?.(); return !!interaction && Array.isArray(interaction.refinements) && interaction.refinements.some((entry) => entry.field === 'country' && Array.isArray(entry.values) && entry.values[0] === 'US') && Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'region'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel'))[0]?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); return labels.includes('Region') && !labels.includes('Market'); })()",
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
      text: "Reopened ReportDocument: Capacity Locations Top Markets Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Template: Capacity Location Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const interaction = preview?.getStandaloneRuntimeInteraction?.(); if (!interaction) { return false; } const headers = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel'))[0]?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); return labels.includes('Region') && !labels.includes('Market') && Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'region'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.advanceStandaloneRuntimeInteraction !== 'function') { return false; } return !!preview.advanceStandaloneRuntimeInteraction((current = null) => ({ ...(current || {}), refinements: [...((current && Array.isArray(current.refinements)) ? current.refinements : []), { op: 'drill', field: 'region', values: ['West'], sourceBlockId: 'primaryTable', label: 'Drill to Metro = West' }], drillTransitions: [...((current && Array.isArray(current.drillTransitions)) ? current.drillTransitions : []), { refinementId: 'drill:region:primaryTable', sourceField: 'region', nextFieldRef: 'metrocode', sourceBlockId: 'primaryTable' }], hostIntent: null, detailDiagnostic: null })); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview?.getBuilderState?.(); const interaction = state?.reportDocumentReopenSession?.runtimePreviewInteraction; return !!interaction && Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'metrocode') && Array.isArray(interaction.refinements) && interaction.refinements.some((entry) => entry.field === 'region' && Array.isArray(entry.values) && entry.values[0] === 'West') && interaction.refinements.some((entry) => entry.field === 'country' && Array.isArray(entry.values) && entry.values[0] === 'US'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const interaction = preview?.getStandaloneRuntimeInteraction?.(); return !!interaction && Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'metrocode') && Array.isArray(interaction.refinements) && interaction.refinements.some((entry) => entry.field === 'region' && Array.isArray(entry.values) && entry.values[0] === 'West') && interaction.refinements.some((entry) => entry.field === 'country' && Array.isArray(entry.values) && entry.values[0] === 'US'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel'))[0]?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); return labels.includes('Metro Area') && !labels.includes('Region'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-location-chart-runtime-surface-resume.png",
      fullPage: true,
    },
  ],
};
