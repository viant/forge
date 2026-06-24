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
      type: "clickSelector",
      selector: ".forge-report-builder__chart-action-button--quick",
    },
    {
      type: "clickSelectorContains",
      selector: "[role=\"menuitem\"]",
      text: "Avails by Date and Channel",
      index: 0,
    },
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-chart-legend-action').length >= 2",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-chart-legend-action",
      text: "Display",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Selected value: Display",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Start draft",
    },
    {
      type: "waitForDomContains",
      text: "Local Draft",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const keys = ['reportBuilder.state.demoReportBuilder.demoReportBuilderWindow', 'reportBuilder.state.demoReportBuilder']; return keys.some((key) => { const raw = window.localStorage.getItem(key); if (!raw) { return false; } try { const parsed = JSON.parse(raw); return parsed?.explorationSession?.sourceRef?.kind === 'reportBuilder.chartSelection' && parsed?.explorationSession?.sourceRef?.contextLabel === 'Display'; } catch (_) { return false; } }); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Discard draft",
    },
    {
      type: "waitForDomContains",
      text: "Draft discarded.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const keys = ['reportBuilder.state.demoReportBuilder.demoReportBuilderWindow', 'reportBuilder.state.demoReportBuilder']; return keys.every((key) => { const raw = window.localStorage.getItem(key); if (!raw) { return true; } try { const parsed = JSON.parse(raw); return !parsed?.explorationSession; } catch (_) { return false; } }); })()",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "Selected value: Display",
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-exploration-chart-selection.png",
      fullPage: true,
    },
  ],
};
