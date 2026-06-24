import {
  buildInlineArtifactImportSteps,
} from "./report-builder-preview-scenario-builders.mjs";

const savedViewRecordExpression = `(() => {
  const preview = window.__REPORT_BUILDER_PREVIEW__;
  const payloads = preview?.getSeededSavedReportPayloads?.() || [];
  const target = payloads.find((entry) => (entry?.savedReportPayload?.reportDocument?.id || entry?.reportId) === 'capacityTrendQ3') || payloads[0];
  const payload = target?.savedReportPayload || target;
  const exportRequest = target?.exportRequest;
  if (!payload?.reportDocument || !exportRequest) {
    throw new Error('seeded lifecycle saved-view record source not found');
  }
  return {
    reportId: payload.reportDocument.id || 'capacityTrendQ3',
    title: 'Capacity Trend Q3 Saved View',
    documentVersion: exportRequest?.source?.documentVersion || 6,
    savedAt: payload?.savedAt || 6100,
    importedArtifactKind: 'reportBuilder.savedView',
    document: {
      ...payload.reportDocument,
      title: 'Capacity Trend Q3 Saved View',
    },
    reportSpec: exportRequest.reportSpec,
    source: {
      kind: 'reportBuilder.savedView',
      reportId: payload.reportDocument.id || 'capacityTrendQ3',
      sourceArtifactId: 'saved_view_capacityTrendQ3',
    },
    exportRequest: {
      ...exportRequest,
      source: {
        ...exportRequest.source,
        from: 'savedView',
        artifactKind: 'reportBuilder.savedView',
        artifactRef: 'reportBuilder.savedView://saved_view_capacityTrendQ3',
        sourceArtifactId: 'saved_view_capacityTrendQ3',
        title: 'Capacity Trend Q3 Saved View',
      },
    },
  };
})()`;

const lifecycleListResponseExpression = `(() => ({
  version: 1,
  kind: 'listReportDocumentsResponse',
  entries: [
    {
      reportRef: { reportId: 'capacityTrendQ3' },
      documentVersion: 12,
      title: 'Capacity Trend Q3 Saved View',
      artifactRef: 'report://capacityTrendQ3',
      lifecycle: 'draft',
      shareableVersion: 12,
      ownerRef: 'team://preview/reporting',
      capabilities: {
        view: true,
        share: true,
        publish: true,
        export: true,
      },
      source: {
        kind: 'reportBuilder.savedView',
        reportId: 'capacityTrendQ3',
        sourceArtifactId: 'saved_view_capacityTrendQ3',
      },
    },
  ],
  cursor: '',
  hasMore: false,
}))()`;

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildInlineArtifactImportSteps({
      artifactExpression: savedViewRecordExpression,
      filename: "capacity-trend.lifecycle.saved-view.saved-record.json",
      importedNoticeText: "Imported saved view Capacity Trend Q3 Saved View. Reopen and export are ready.",
      captureDownloads: false,
    }),
    ...buildInlineArtifactImportSteps({
      artifactExpression: lifecycleListResponseExpression,
      filename: "capacity-trend.lifecycle.saved-view.list-response.json",
      importedNoticeText: "Imported listReportDocuments response with 1 entry.",
      captureDownloads: false,
    }),
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Trend Q3 Saved View",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const section = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('List ReportDocuments response:'));
        if (!section) { return false; }
        const buttons = Array.from(section.querySelectorAll('button'));
        const share = buttons.find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Share'));
        const publish = buttons.find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Publish'));
        const enabled = (node) => !!node && !(node.disabled || node.getAttribute('aria-disabled') === 'true');
        return enabled(share) && enabled(publish);
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Publish",
    },
    {
      type: "waitForDomContains",
      text: "Published snapshot created for Capacity Trend Q3 Saved View.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Latest shared artifact",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const panel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Latest shared artifact'));
        const text = panel?.innerText || panel?.textContent || '';
        return text.includes('published-snapshot artifact')
          && text.includes('published_snapshot_capacityTrendQ3_1')
          && text.includes('The latest publish action returned an immutable snapshot artifact for this report.');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect artifact",
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const panel = document.querySelector('[aria-label="Latest shared artifact summary"]');
        const text = panel?.innerText || panel?.textContent || '';
        return text.includes('"kind": "reportBuilder.publishedSnapshot"')
          && text.includes('"artifactRef": "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3_1"');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-selected-entry-lifecycle-publish.png",
      fullPage: true,
    },
  ],
};
