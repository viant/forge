import baseScenario from "./report-builder-preview-semantic-list-entry-published-snapshot-export-request.scenario.mjs";

const baseSteps = (Array.isArray(baseScenario?.steps) ? baseScenario.steps : []).filter(
  (step) => step?.type !== "screenshot",
);

export default {
  ...baseScenario,
  steps: [
    ...baseSteps,
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Trend Q3 Published Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Reopen in builder",
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument Capacity Trend Q3 Published Snapshot for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Capacity Trend Q3 Published Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.applyAuthoredDocumentBlock !== 'function') { throw new Error('applyAuthoredDocumentBlock API not available.'); } const result = preview.applyAuthoredDocumentBlock({ kind: 'markdownBlock', seed: { id: 'runtimeNote', title: 'Runtime Note', markdown: '## Runtime Note\\nLive selected published snapshot export note.' } }); return !!result?.valid; })()",
    },
    {
      type: "waitForDomContains",
      text: "Runtime Note",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const summary = Array.from(document.querySelectorAll('[aria-label="Selected list entry export request summary"]')).find(Boolean);
        if (!summary) { return false; }
        const container = summary.closest('.forge-report-builder__chart-inline-notice');
        const text = container?.innerText || container?.textContent || '';
        const pre = container?.querySelector('pre');
        const raw = pre?.textContent || '';
        return text.includes('imported published-snapshot')
          && text.includes('published-snapshot artifact')
          && raw.includes('"from": "publishedSnapshot"')
          && raw.includes('"artifactRef": "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3"')
          && raw.includes('Runtime Note')
          && raw.includes('Live selected published snapshot export note.');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-list-entry-published-snapshot-live-export-request.png",
      fullPage: true,
    },
  ],
};
