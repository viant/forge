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
      type: "clickSelectorContains",
      selector: ".forge-report-builder__measure-pill",
      text: "Reach Rate",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Local Draft.",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__measure-pill",
      text: "Reach Rate",
      index: 0,
    },
    {
      type: "waitForEval",
      expression: "(() => { const keys = ['reportBuilder.state.demoReportBuilder.demoReportBuilderWindow', 'reportBuilder.state.demoReportBuilder']; return keys.some((key) => { const raw = window.localStorage.getItem(key); if (!raw) { return false; } try { const parsed = JSON.parse(raw); return !!parsed?.explorationSession?.sessionId; } catch (_) { return false; } }); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Save artifact",
    },
    {
      type: "waitForDomContains",
      text: "Saved exploration artifact: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "reportBuilder.explorationArtifact",
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"Saved exploration artifact summary\"]')",
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
      type: "assertDomContains",
      text: "Saved exploration artifact: Report Builder Demo",
    },
    {
      type: "assertDomNotContains",
      text: "reportBuilder.explorationArtifact",
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"Saved exploration artifact summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-exploration-save.png",
      fullPage: true,
    },
  ],
};
