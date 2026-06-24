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
      value: "capacityQ3",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Q3",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"capacityQ3\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Q3",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Q3",
      reportId: "capacityQ3",
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
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.reportDocumentReopenSession?.reportId === 'capacityQ3'",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceStandaloneRuntimeInteraction !== 'function') { return false; } return !!preview.replaceStandaloneRuntimeInteraction({ refinements: [{ op: 'drill', field: 'channelV2', values: ['Display'], sourceBlockId: 'primaryTable', label: 'Drill to Publisher = Display' }], drillTransitions: [{ refinementId: 'drill:channelV2:primaryTable', sourceField: 'channelV2', nextFieldRef: 'publisher', sourceBlockId: 'primaryTable' }], hostIntent: null, detailDiagnostic: null }); })()",
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
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel'))[0]?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); return labels.includes('Publisher') && !labels.includes('Site Type'); })()",
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
      text: "Reopened ReportDocument: Capacity Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Template: Capacity Inventory Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const interaction = preview?.getStandaloneRuntimeInteraction?.(); if (!interaction) { return false; } const headers = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel'))[0]?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); const hierarchyLabels = ['Channel', 'Publisher', 'Site Type']; const activeLabels = hierarchyLabels.filter((label) => labels.includes(label)); return labels.includes('Publisher') && activeLabels.length === 1 && Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'publisher'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.advanceStandaloneRuntimeInteraction !== 'function') { return false; } return !!preview.advanceStandaloneRuntimeInteraction((current = null) => { if (!current || !Array.isArray(current.refinements) || !current.refinements.some((entry) => entry.field === 'channelV2' && Array.isArray(entry.values) && entry.values[0] === 'Display') || !Array.isArray(current.drillTransitions) || !current.drillTransitions.some((entry) => entry.nextFieldRef === 'publisher')) { return null; } return { ...current, refinements: [...current.refinements, { op: 'drill', field: 'publisher', values: ['Acme Media'], sourceBlockId: 'primaryTable', label: 'Drill to Site Type = Acme Media' }], drillTransitions: [...current.drillTransitions, { refinementId: 'drill:publisher:primaryTable', sourceField: 'publisher', nextFieldRef: 'siteType', sourceBlockId: 'primaryTable' }], hostIntent: null, detailDiagnostic: null }; }); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview?.getBuilderState?.(); const interaction = state?.reportDocumentReopenSession?.runtimePreviewInteraction; if (!interaction || interaction.hostIntent !== null || interaction.detailDiagnostic !== null || !Array.isArray(interaction.drillTransitions) || !Array.isArray(interaction.refinements)) { return false; } const publisherIndex = interaction.drillTransitions.findIndex((entry) => entry.nextFieldRef === 'publisher'); const siteTypeIndex = interaction.drillTransitions.findIndex((entry) => entry.nextFieldRef === 'siteType'); return publisherIndex >= 0 && siteTypeIndex === publisherIndex + 1 && interaction.refinements.some((entry) => entry.field === 'publisher' && Array.isArray(entry.values) && entry.values[0] === 'Acme Media') && interaction.refinements.some((entry) => entry.field === 'channelV2' && Array.isArray(entry.values) && entry.values[0] === 'Display'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const interaction = preview?.getStandaloneRuntimeInteraction?.(); if (!interaction || interaction.hostIntent !== null || interaction.detailDiagnostic !== null || !Array.isArray(interaction.drillTransitions) || !Array.isArray(interaction.refinements)) { return false; } const publisherIndex = interaction.drillTransitions.findIndex((entry) => entry.nextFieldRef === 'publisher'); const siteTypeIndex = interaction.drillTransitions.findIndex((entry) => entry.nextFieldRef === 'siteType'); return publisherIndex >= 0 && siteTypeIndex === publisherIndex + 1 && interaction.refinements.some((entry) => entry.field === 'publisher' && Array.isArray(entry.values) && entry.values[0] === 'Acme Media') && interaction.refinements.some((entry) => entry.field === 'channelV2' && Array.isArray(entry.values) && entry.values[0] === 'Display'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel'))[0]?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); return labels.includes('Site Type') && !labels.includes('Publisher'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-inventory-table-runtime-surface-resume.png",
      fullPage: true,
    },
  ],
};
