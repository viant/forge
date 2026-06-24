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
      value: "capacityInventoryTopChannelsQ3",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Inventory Top Channels Q3",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"capacityInventoryTopChannelsQ3\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Inventory Top Channels Q3",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Inventory Top Channels Q3",
      reportId: "capacityInventoryTopChannelsQ3",
      documentVersion: 11,
      includeSummaryNotice: true,
    }),
    {
      type: "waitForDomContains",
      text: "Template: Capacity Inventory Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.reportDocumentReopenSession?.reportId === 'capacityInventoryTopChannelsQ3'",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceStandaloneRuntimeInteraction !== 'function') { return false; } preview.replaceStandaloneRuntimeInteraction({ refinements: [{ op: 'keep', field: 'channelV2', values: ['Display'], sourceBlockId: 'primaryChart', label: 'Keep only = Display' }], drillTransitions: [{ refinementId: 'keep:channelV2:primaryChart', sourceField: 'channelV2', nextFieldRef: 'publisher', sourceBlockId: 'primaryChart' }], hostIntent: null, detailDiagnostic: null }); return true; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview?.getBuilderState?.(); const interaction = state?.reportDocumentReopenSession?.runtimePreviewInteraction; return !!interaction && interaction.hostIntent === null && interaction.detailDiagnostic === null && Array.isArray(interaction.refinements) && interaction.refinements.some((entry) => entry.field === 'channelV2' && Array.isArray(entry.values) && entry.values[0] === 'Display') && Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'publisher'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const interaction = preview?.getStandaloneRuntimeInteraction?.(); return !!interaction && interaction.hostIntent === null && interaction.detailDiagnostic === null && Array.isArray(interaction.refinements) && interaction.refinements.some((entry) => entry.field === 'channelV2' && Array.isArray(entry.values) && entry.values[0] === 'Display') && Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'publisher'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel'))[0]?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); return labels.includes('Publisher') && !labels.includes('Channel'); })()",
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
      text: "Reopened ReportDocument: Capacity Inventory Top Channels Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Template: Capacity Inventory Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const interaction = preview?.getStandaloneRuntimeInteraction?.(); if (!interaction) { return false; } const headers = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel'))[0]?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); return labels.includes('Publisher') && !labels.includes('Channel') && Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'publisher'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.advanceStandaloneRuntimeInteraction !== 'function') { return false; } preview.advanceStandaloneRuntimeInteraction((current = null) => ({ ...(current || {}), refinements: [...((current && Array.isArray(current.refinements)) ? current.refinements : []), { op: 'drill', field: 'publisher', values: ['Acme Media'], sourceBlockId: 'primaryTable', label: 'Drill to Site Type = Acme Media' }], drillTransitions: [...((current && Array.isArray(current.drillTransitions)) ? current.drillTransitions : []), { refinementId: 'drill:publisher:primaryTable', sourceField: 'publisher', nextFieldRef: 'siteType', sourceBlockId: 'primaryTable' }], hostIntent: null, detailDiagnostic: null })); return true; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview?.getBuilderState?.(); const interaction = state?.reportDocumentReopenSession?.runtimePreviewInteraction; return !!interaction && interaction.hostIntent === null && interaction.detailDiagnostic === null && Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'siteType') && Array.isArray(interaction.refinements) && interaction.refinements.some((entry) => entry.field === 'publisher' && Array.isArray(entry.values) && entry.values[0] === 'Acme Media') && interaction.refinements.some((entry) => entry.field === 'channelV2' && Array.isArray(entry.values) && entry.values[0] === 'Display'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const interaction = preview?.getStandaloneRuntimeInteraction?.(); return !!interaction && interaction.hostIntent === null && interaction.detailDiagnostic === null && Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'siteType') && Array.isArray(interaction.refinements) && interaction.refinements.some((entry) => entry.field === 'publisher' && Array.isArray(entry.values) && entry.values[0] === 'Acme Media') && interaction.refinements.some((entry) => entry.field === 'channelV2' && Array.isArray(entry.values) && entry.values[0] === 'Display'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel'))[0]?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); return labels.includes('Site Type') && !labels.includes('Publisher'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-inventory-chart-runtime-surface-resume.png",
      fullPage: true,
    },
  ],
};
