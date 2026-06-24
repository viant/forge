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
      text: "Market Brief",
    },
    {
      type: "waitForDomContains",
      text: "Market Brief applied.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Seeded from template: Market Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const titles = Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).map((node) => (node.innerText || node.textContent || '').trim()); return titles.includes('Executive Summary') && titles.includes('Headline KPI'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const card = document.querySelector('[data-report-document-block-id=\"narrativeIntro\"]'); if (!card) { throw new Error('Narrative block card not found.'); } const button = Array.from(card.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Half')); if (!button) { throw new Error('Half width button not found for narrative block.'); } button.click(); })()",
    },
    {
      type: "waitForDomContains",
      text: "Executive Summary resized to half width in the authored report layout.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.(); const items = Array.isArray(state?.reportDocumentLayout?.items) ? state.reportDocumentLayout.items : []; return items.some((item) => item?.blockId === 'narrativeIntro' && item?.size === 'half'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => !!document.querySelector('[data-report-runtime-block-id=\"narrativeIntro\"][data-report-runtime-layout-size=\"half\"]'))()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-authored-layout-sizing.png",
      fullPage: true,
    },
  ],
};
