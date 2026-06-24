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
      expression: "window.__REPORT_BUILDER_PREVIEW__ && window.__REPORT_BUILDER_PREVIEW__.replaceCollectionRows && window.__REPORT_BUILDER_PREVIEW__.replaceCollectionRows([{ eventDate: '2026-05-09', channelV2: 'Direct', avails: 77777 }], { hasMore: false, error: null });",
    },
    {
      type: "waitForEval",
      expression: "(() => { const panels = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel')); const panel = panels[panels.length - 1]; const text = panel?.innerText || panel?.textContent || ''; return text.includes('Direct') && !text.includes('CTV') && !text.includes('Display'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Compiled Runtime Preview",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-runtime-collection-source.png",
      fullPage: true,
    },
  ],
};
