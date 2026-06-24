import {
  buildPreviewBootstrapSteps,
  buildSectionButtonClickStep,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps({ captureDownloads: true }),
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
      type: "clickRole",
      role: "button",
      name: "Fork from here",
    },
    {
      type: "waitForDomContains",
      text: "Exploration Session.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Save artifact",
    },
    {
      type: "waitForDomContains",
      text: "Saved exploration artifact: Market Brief",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare report payload",
    },
    {
      type: "waitForDomContains",
      text: "Saved report payload: Market Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panels = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')); const panel = panels.find((node) => ((node.innerText || node.textContent || '').includes('Saved report payload: Market Brief'))); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Dimensions Country') && text.includes('Measures Available Impressions, Household Uniques'); })()",
      timeoutMs: 60000,
    },
    buildSectionButtonClickStep({
      sectionIncludes: "Saved report payload: Market Brief",
      sectionSelector: ".forge-report-builder__chart-inline-notice",
      buttonTexts: ["Inspect export", "Hide export"],
      missingSectionMessage: "Saved report payload section not found.",
      missingButtonMessage: "Inspect export button not found for Market Brief payload.",
    }),
    {
      type: "waitForEval",
      expression: "(() => { const summary = Array.from(document.querySelectorAll('[aria-label=\"Saved export request summary\"]')).find(Boolean); if (!summary) { return false; } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const text = container?.innerText || container?.textContent || ''; const pre = container?.querySelector('pre'); const raw = pre?.textContent || ''; try { const parsed = JSON.parse(raw || '{}'); const reportPrint = parsed?.reportPrint || {}; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && parsed?.kind === 'reportExportRequest' && parsed?.target?.format === 'pdf' && reportPrint?.kind === 'reportPrint' && raw.includes('Executive Summary') && raw.includes('Headline KPI') && raw.includes('\"reportDocumentTemplateId\": \"market_brief\"') && raw.includes('\"reportDocumentTemplateLabel\": \"Market Brief\"'); } catch (_) { return false; } })()",
      timeoutMs: 60000,
    },
    buildSectionButtonClickStep({
      sectionIncludes: "Saved report payload: Market Brief",
      sectionSelector: ".forge-report-builder__chart-inline-notice",
      buttonTexts: ["Export snapshot", "Review export"],
      missingSectionMessage: "Saved report payload section not found.",
      missingButtonMessage: "Export snapshot button not found for Market Brief payload.",
    }),
    {
      type: "waitForDomContains",
      text: "Accepted PDF export for Market Brief.",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const jobId = preview?.lastExportRequest?.jobId; if (!jobId) { throw new Error('last export job id not found'); } preview.replaceExportBehaviors([{ match: { phase: 'status', jobId }, error: 'Renderer rejected reportPrint for Market Brief.', result: { jobId, status: 'failed', artifactId: '', artifactRef: 'reportBuilder.savedReportPayload://rbreport_market_brief', format: 'pdf', error: 'Renderer rejected reportPrint for Market Brief.', diagnostics: [{ code: 'export.renderUnsupported', severity: 'error', path: '$.reportPrint.pages[0]', message: 'Unsupported chart primitive in current renderer.', suggestedFix: 'Use a print-safe chart preset.' }] } }]); return true; })()",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Refresh status",
    },
    {
      type: "waitForDomContains",
      text: "Renderer rejected reportPrint for Market Brief.",
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
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('demo-export-job-1') && text.includes('failed') && text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Executive Summary') && text.includes('Headline KPI'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-template-saved-payload-export-status-failure.png",
      fullPage: true,
    },
  ],
};
