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
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-report-runtime-table-panel .forge-dashboard-row-action').length >= 1",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Show channel details",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Resolved detail target",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "target://example/performance/channel-detail",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Detail target resolved with omitted parameters: campaign.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-runtime-host-intent'); const text = (panel?.innerText || panel?.textContent || ''); return text.includes('channel') && text.includes('Display') && !text.includes('Prospect Sprint'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-runtime-table-detail-proof.png",
      fullPage: true,
    },
  ],
};
