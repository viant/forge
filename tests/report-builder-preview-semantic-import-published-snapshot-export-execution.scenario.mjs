import baseScenario from "./report-builder-preview-semantic-import-published-snapshot-export-request.scenario.mjs";
import { buildSectionButtonClickStep } from "./report-builder-preview-scenario-builders.mjs";

const baseSteps = (Array.isArray(baseScenario?.steps) ? baseScenario.steps : []).filter(
  (step) => step?.type !== "screenshot",
);

export default {
  ...baseScenario,
  steps: [
    ...baseSteps,
    buildSectionButtonClickStep({
      sectionIncludes: "Active saved artifact",
      buttonTexts: ["Export snapshot", "Review export"],
      missingSectionMessage: "active saved artifact section not found",
      missingButtonMessage: "published-snapshot export button not found",
    }),
    {
      type: "waitForDomContains",
      text: "Accepted PDF export for Capacity Trend Q3 Published Snapshot.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('demo-export-job-1') && text.includes('queued') && text.includes('publishedSnapshot') && text.includes('reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3') && text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions') && text.includes('Household Uniques'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Refresh status",
    },
    {
      type: "waitForDomContains",
      text: "Export demo-export-job-1 is queued.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Refresh status",
    },
    {
      type: "waitForDomContains",
      text: "Export demo-export-job-1 is succeeded.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('demo-export-artifact-1') && text.includes('succeeded'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Download artifact",
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'Capacity Trend Q3 Published Snapshot.pdf' && window.__artifactDownloadCapture.payloadReady === true",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.mimeType === 'application/pdf' && window.__artifactDownloadCapture.payload.includes('%PDF-demo Capacity Trend Q3 Published Snapshot')",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-published-snapshot-export-execution.png",
      fullPage: true,
    },
  ],
};
