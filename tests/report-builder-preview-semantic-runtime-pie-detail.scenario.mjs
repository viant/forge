import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 390,
    height: 844,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__compact-action",
      text: "Chart",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Create or apply a chart",
      timeoutMs: 60000,
    },
    {
      type: "clickSelector",
      selector: ".forge-report-builder__chart-action-button--quick",
    },
    {
      type: "clickSelectorContains",
      selector: "[role=\"menuitem\"]",
      text: "Avails by Channel",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Showing Avails by Channel.",
      timeoutMs: 60000,
    },
    {
      type: "waitForChartRender",
      selector: ".forge-report-runtime-chart-panel .recharts-wrapper",
      minMarks: 3,
      minSectors: 2,
      minVisibleSectors: 2,
      minSectorWidth: 80,
      minSectorHeight: 60,
      minWidth: 240,
      minHeight: 160,
      timeoutMs: 60000,
    },
    {
      type: "assertDomContains",
      text: "Click a chart mark to apply authored runtime actions.",
    },
    {
      type: "clickSelector",
      selector: ".forge-report-runtime-chart-panel .recharts-sector",
    },
    {
      type: "waitForDomContains",
      text: "Selected value: Display",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-runtime-chart-action",
      text: "Show channel details",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Resolved detail target",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-runtime-host-intent'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Resolved detail target') && text.includes('target://example/performance/channel-detail') && text.includes('Display'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-runtime-pie-detail-proof.png",
      fullPage: true,
    },
  ],
};
