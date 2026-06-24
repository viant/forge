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
      text: "Capacity Inventory Brief",
    },
    {
      type: "waitForDomContains",
      text: "Capacity Inventory Brief applied.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Seeded from template: Capacity Inventory Brief",
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
      text: "Saved exploration artifact: Capacity Inventory Brief",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare report payload",
    },
    {
      type: "waitForDomContains",
      text: "Saved report payload: Capacity Inventory Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Template: Capacity Inventory Brief",
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
      text: "Selected entry: Capacity Inventory Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Selected entry: Capacity Inventory Brief') && text.includes('Template: Capacity Inventory Brief'); })()",
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
      text: "Get ReportDocument response: Capacity Inventory Brief",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Hide list response",
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Get ReportDocument response: Capacity Inventory Brief') && text.includes('Template: Capacity Inventory Brief'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Reopen in builder')); if (!button) { throw new Error('Reopen in builder button not found.'); } button.click(); })()",
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument Capacity Inventory Brief for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Capacity Inventory Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.(); return state?.reportDocumentTemplateId === 'capacity_inventory_brief' && state?.reportDocumentTemplateLabel === 'Capacity Inventory Brief' && Array.isArray(state?.reportDocumentLayout?.items) && state.reportDocumentLayout.items.some((item) => item?.blockId === 'narrativeIntro' && item?.size === 'half') && state.reportDocumentLayout.items.some((item) => item?.blockId === 'headlineKpi' && item?.size === 'half'); })()",
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
      expression: "Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview .forge-report-runtime-refinement-chip')).some((node) => (node.innerText || node.textContent || '').includes('Drill to Publisher = Display'))",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const interaction = preview?.getStandaloneRuntimeInteraction?.(); if (!interaction) { return false; } const headers = document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-table-panel')?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); const hierarchyLabels = ['Channel', 'Publisher', 'Site Type']; const activeLabels = hierarchyLabels.filter((label) => labels.includes(label)); return labels.includes('Publisher') && activeLabels.length === 1 && Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'publisher'); })()",
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
      text: "Reopened ReportDocument: Capacity Inventory Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview?.getBuilderState?.(); const interaction = preview?.getStandaloneRuntimeInteraction?.(); if (!interaction) { return false; } const headers = document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-table-panel')?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); const hierarchyLabels = ['Channel', 'Publisher', 'Site Type']; const activeLabels = hierarchyLabels.filter((label) => labels.includes(label)); return Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'publisher') && Array.isArray(interaction.refinements) && interaction.refinements.some((entry) => entry.field === 'channelV2' && Array.isArray(entry.values) && entry.values[0] === 'Display') && state?.reportDocumentTemplateLabel === 'Capacity Inventory Brief' && labels.includes('Publisher') && activeLabels.length === 1; })()",
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
      expression: "(() => { const headers = document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-table-panel')?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); const hierarchyLabels = ['Channel', 'Publisher', 'Site Type']; const activeLabels = hierarchyLabels.filter((label) => labels.includes(label)); return labels.includes('Site Type') && !labels.includes('Publisher') && activeLabels.length === 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-capacity-inventory-template-save-reopen-drill.png",
      fullPage: true,
    },
  ],
};
