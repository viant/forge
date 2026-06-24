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
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const jobId = preview?.lastExportRequest?.jobId; if (!jobId) { throw new Error('last export job id not found'); } preview.replaceExportBehaviors([{ match: { phase: 'status', jobId }, error: 'Renderer rejected reportPrint for Capacity Trend Q3.', result: { jobId, status: 'failed', artifactId: '', artifactRef: 'reportBuilder.savedReportPayload://rbreport_capacity_trend_q3', format: 'pdf', error: 'Renderer rejected reportPrint for Capacity Trend Q3.', diagnostics: [{ code: 'export.renderUnsupported', severity: 'error', path: '$.reportPrint.pages[0]', message: 'Unsupported chart primitive in current renderer.', suggestedFix: 'Use a print-safe chart preset.' }] } }]); return true; })()",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Refresh status",
    },
    {
      type: "waitForDomContains",
      text: "Renderer rejected reportPrint for Capacity Trend Q3.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Unsupported chart primitive in current renderer.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Use a print-safe chart preset.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('demo-export-job-1') && text.includes('failed') && text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions') && text.includes('ATTACHED REPORTFILL'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-report-fill-attach-report-spec-export-status-failure.png",
      fullPage: true,
    },
  ],
};
