import {
  buildInlineArtifactImportSteps,
  buildPreviewLifecycleBehaviorReplacementStep,
} from "./report-builder-preview-scenario-builders.mjs";

const publishedSnapshotRecordExpression = `(() => {
  const preview = window.__REPORT_BUILDER_PREVIEW__;
  const payloads = preview?.getSeededSavedReportPayloads?.() || [];
  const target = payloads.find((entry) => (entry?.savedReportPayload?.reportDocument?.id || entry?.reportId) === 'capacityTrendQ3') || payloads[0];
  const payload = target?.savedReportPayload || target;
  const exportRequest = target?.exportRequest;
  if (!payload?.reportDocument || !exportRequest) {
    throw new Error('seeded lifecycle published-snapshot record source not found');
  }
  return {
    reportId: payload.reportDocument.id || 'capacityTrendQ3',
    title: 'Capacity Trend Q3 Published Snapshot',
    documentVersion: (exportRequest?.source?.documentVersion || 6) + 1,
    savedAt: (payload?.savedAt || 6100) + 1,
    importedArtifactKind: 'reportBuilder.publishedSnapshot',
    lifecycle: 'published',
    document: {
      ...payload.reportDocument,
      title: 'Capacity Trend Q3 Published Snapshot',
    },
    reportSpec: exportRequest.reportSpec,
    source: {
      kind: 'reportBuilder.publishedSnapshot',
      reportId: payload.reportDocument.id || 'capacityTrendQ3',
      sourceArtifactId: 'published_snapshot_capacityTrendQ3',
    },
    exportRequest: {
      ...exportRequest,
      source: {
        ...exportRequest.source,
        from: 'publishedSnapshot',
        artifactKind: 'reportBuilder.publishedSnapshot',
        artifactRef: 'reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3',
        sourceArtifactId: 'published_snapshot_capacityTrendQ3',
        documentVersion: (exportRequest?.source?.documentVersion || 6) + 1,
        title: 'Capacity Trend Q3 Published Snapshot',
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
      documentVersion: 13,
      title: 'Capacity Trend Q3 Published Snapshot',
      artifactRef: 'report://capacityTrendQ3',
      lifecycle: 'published',
      shareableVersion: 13,
      ownerRef: 'team://preview/reporting',
      capabilities: {
        view: true,
        share: true,
        archive: true,
        export: true,
      },
      source: {
        kind: 'reportBuilder.publishedSnapshot',
        reportId: 'capacityTrendQ3',
        sourceArtifactId: 'published_snapshot_capacityTrendQ3',
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
      artifactExpression: publishedSnapshotRecordExpression,
      filename: "capacity-trend.lifecycle.published-snapshot.saved-record.failure.json",
      importedNoticeText: "Imported published snapshot Capacity Trend Q3 Published Snapshot. Reopen and export are ready.",
      captureDownloads: false,
    }),
    ...buildInlineArtifactImportSteps({
      artifactExpression: lifecycleListResponseExpression,
      filename: "capacity-trend.lifecycle.published-snapshot.list-response.failure.json",
      importedNoticeText: "Imported listReportDocuments response with 1 entry.",
      captureDownloads: false,
    }),
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Trend Q3 Published Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const section = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('List ReportDocuments response:'));
        if (!section) { return false; }
        const buttons = Array.from(section.querySelectorAll('button')).map((entry) => ((entry.innerText || entry.textContent || '').trim()));
        return buttons.includes('Archive');
      })()`,
      timeoutMs: 60000,
    },
    buildPreviewLifecycleBehaviorReplacementStep({
      behaviors: [{
        match: {
          action: "archive",
          source: "reportBuilder.catalogEntry",
          title: "Capacity Trend Q3 Published Snapshot",
        },
        error: "Preview lifecycle archive was rejected for Capacity Trend Q3 Published Snapshot.",
      }],
    }),
    {
      type: "clickRole",
      role: "button",
      name: "Archive",
    },
    {
      type: "waitForDomContains",
      text: "Archive failed for Capacity Trend Q3 Published Snapshot. Preview lifecycle archive was rejected for Capacity Trend Q3 Published Snapshot.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const text = document.body?.innerText || document.body?.textContent || '';
        const section = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('List ReportDocuments response:'));
        const buttons = Array.from(section?.querySelectorAll('button') || []).map((entry) => ((entry.innerText || entry.textContent || '').trim()));
        return text.includes('Archive failed for Capacity Trend Q3 Published Snapshot. Preview lifecycle archive was rejected for Capacity Trend Q3 Published Snapshot.')
          && buttons.includes('Archive')
          && !text.includes('Latest shared artifact');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-selected-entry-lifecycle-archive-failure.png",
      fullPage: true,
    },
  ],
};
