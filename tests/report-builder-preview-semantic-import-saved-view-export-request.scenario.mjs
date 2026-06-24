import {
  buildInlineArtifactImportSteps,
  buildSectionButtonClickStep,
} from "./report-builder-preview-scenario-builders.mjs";

const savedViewArtifactExpression = `(() => {
  const preview = window.__REPORT_BUILDER_PREVIEW__;
  const payloads = preview?.getSeededSavedReportPayloads?.() || [];
  const target = payloads.find((entry) => (entry?.savedReportPayload?.reportDocument?.id || entry?.reportId) === 'capacityTrendQ3') || payloads[0];
  const payload = target?.savedReportPayload || target;
  const exportRequest = target?.exportRequest;
  if (!payload?.reportDocument || !exportRequest?.reportSpec || !exportRequest?.reportFill) {
    throw new Error('seeded saved-view artifact source not found');
  }
  const document = JSON.parse(JSON.stringify(payload.reportDocument));
  document.title = 'Capacity Trend Q3 Saved View';
  return {
    version: 1,
    kind: 'reportBuilder.savedView',
    id: 'saved_view_capacityTrendQ3',
    title: 'Capacity Trend Q3 Saved View',
    reportId: document.id || 'capacityTrendQ3',
    documentVersion: exportRequest?.source?.documentVersion || 6,
    savedAt: payload?.savedAt || 6100,
    document,
    reportSpec: exportRequest.reportSpec,
    reportFill: exportRequest.reportFill,
    ...(exportRequest?.reportPrint ? { reportPrint: exportRequest.reportPrint } : {}),
  };
})()`;

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildInlineArtifactImportSteps({
      artifactExpression: savedViewArtifactExpression,
      filename: "capacity-trend.saved-view.json",
      importedNoticeText: "Imported saved view Capacity Trend Q3 Saved View. Reopen and export are ready.",
      captureDownloads: true,
    }),
    {
      type: "waitForDomContains",
      text: "Imported saved report records",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "imported saved-view",
      timeoutMs: 60000,
    },
    buildSectionButtonClickStep({
      sectionIncludes: "Capacity Trend Q3 Saved View",
      buttonTexts: ["Use"],
      missingSectionMessage: "saved-view imported record card not found",
      missingButtonMessage: "saved-view use button not found",
    }),
    {
      type: "waitForDomContains",
      text: "Capacity Trend Q3 Saved View is now the active saved report record.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Active saved artifact",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "saved-view artifact",
      timeoutMs: 60000,
    },
    buildSectionButtonClickStep({
      sectionIncludes: "Active saved artifact",
      buttonTexts: ["Inspect export", "Hide export"],
      missingSectionMessage: "active saved artifact section not found",
      missingButtonMessage: "saved-view inspect export button not found",
    }),
    {
      type: "waitForEval",
      expression: `(() => {
        const summary = Array.from(document.querySelectorAll('[aria-label="Saved export request summary"]')).find(Boolean);
        if (!summary) { return false; }
        const container = summary.closest('.forge-report-builder__chart-inline-notice');
        const text = container?.innerText || container?.textContent || '';
        const pre = container?.querySelector('pre');
        const raw = pre?.textContent || '';
        return text.includes('savedView')
          && text.includes('reportBuilder.savedView://saved_view_capacityTrendQ3')
          && raw.includes('"from": "savedView"')
          && raw.includes('"artifactKind": "reportBuilder.savedView"')
          && raw.includes('"sourceArtifactId": "saved_view_capacityTrendQ3"');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-saved-view-export-request.png",
      fullPage: true,
    },
  ],
};
