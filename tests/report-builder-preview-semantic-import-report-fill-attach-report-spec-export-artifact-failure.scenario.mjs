import baseScenario from "./report-builder-preview-semantic-import-report-fill-attach-report-spec-export-request.scenario.mjs";
import { buildAriaSectionButtonClickStep } from "./report-builder-preview-scenario-builders.mjs";

const baseSteps = (Array.isArray(baseScenario?.steps) ? baseScenario.steps : []).filter(
  (step) => step?.type !== "screenshot",
);

export default {
  ...baseScenario,
  steps: [
    ...baseSteps,
    buildAriaSectionButtonClickStep({
      ariaLabel: "Imported runtime preview",
      buttonTexts: ["Export snapshot", "Review export"],
      missingSectionMessage: "imported runtime section not found",
      missingButtonMessage: "imported pipeline export button not found",
    }),
    {
      type: "waitForDomContains",
      text: "Accepted PDF export for Capacity Trend Q3.",
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
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const artifactId = preview?.lastExportRequest?.artifactId; if (!artifactId) { throw new Error('last export artifact id not found'); } preview.replaceExportBehaviors([{ match: { phase: 'artifact', artifactId }, error: 'Could not load the preview export artifact for Capacity Trend Q3.' }]); return true; })()",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Download artifact",
    },
    {
      type: "waitForDomContains",
      text: "Could not load the preview export artifact for Capacity Trend Q3.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('demo-export-artifact-1') && text.includes('succeeded') && text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions') && text.includes('ATTACHED REPORTFILL'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === '' && window.__artifactDownloadCapture.payloadReady === false",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-report-fill-attach-report-spec-export-artifact-failure.png",
      fullPage: true,
    },
  ],
};
