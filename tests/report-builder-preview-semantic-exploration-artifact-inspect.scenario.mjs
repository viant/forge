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
      type: "waitForEval",
      expression: "(() => { const keys = ['reportBuilder.state.demoReportBuilder.demoReportBuilderWindow', 'reportBuilder.state.demoReportBuilder']; return keys.some((key) => { const raw = window.localStorage.getItem(key); if (!raw) { return false; } try { const parsed = JSON.parse(raw); return !!parsed?.explorationSession?.sessionId; } catch (_) { return false; } }); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__measure-pill",
      text: "Reach Rate",
      index: 0,
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
      name: "Debug draft JSON",
    },
    {
      type: "waitForEval",
      expression: "!!document.querySelector('[aria-label=\"Saved exploration artifact summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "reportBuilder.explorationArtifact",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"artifactId\": \"rbexploration_",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"reportSpec\": {",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Selected dimensions (2)",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Event Date",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Hide saved exploration artifact",
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"Saved exploration artifact summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"reportSpec\": {",
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-exploration-artifact-inspect.png",
      fullPage: true,
    },
  ],
};
