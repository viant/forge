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
      type: "waitForEval",
      expression: "(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.(); const items = Array.isArray(state?.reportDocumentLayout?.items) ? state.reportDocumentLayout.items : []; const measures = Array.isArray(state?.selectedMeasures) ? state.selectedMeasures : []; const dimensions = Array.isArray(state?.selectedDimensions) ? state.selectedDimensions : []; return state?.reportDocumentTitle === 'Capacity Inventory Brief' && dimensions.length === 1 && dimensions[0] === 'channelV2' && measures.length === 3 && measures.includes('avails') && measures.includes('hhUniqs') && measures.includes('reachRate') && state?.primaryMeasure === 'avails' && state?.viewMode === 'table' && state?.pageSize === 12 && state?.orderField === 'avails' && state?.orderDir === 'desc' && state?.chartSpec?.title === 'Inventory by Channel' && items.some((item) => item?.blockId === 'narrativeIntro' && item?.size === 'half') && items.some((item) => item?.blockId === 'headlineKpi' && item?.size === 'half'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const titles = Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).map((node) => (node.innerText || node.textContent || '').trim()); return titles.includes('Active Drill Path') && titles.includes('Inventory Outlook') && titles.includes('Top Channel KPI'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => !!document.querySelector('[data-report-runtime-block-id=\"narrativeIntro\"][data-report-runtime-layout-size=\"half\"]') && !!document.querySelector('[data-report-runtime-block-id=\"headlineKpi\"][data-report-runtime-layout-size=\"half\"]'))()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-capacity-inventory-template.png",
      fullPage: true,
    },
  ],
};
