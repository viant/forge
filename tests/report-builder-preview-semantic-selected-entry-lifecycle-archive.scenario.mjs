import {
  buildInlineArtifactImportSteps,
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
      filename: "capacity-trend.lifecycle.published-snapshot.saved-record.json",
      importedNoticeText: "Imported published snapshot Capacity Trend Q3 Published Snapshot. Reopen and export are ready.",
      captureDownloads: false,
    }),
    ...buildInlineArtifactImportSteps({
      artifactExpression: lifecycleListResponseExpression,
      filename: "capacity-trend.lifecycle.published-snapshot.list-response.json",
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
        const buttons = Array.from(section.querySelectorAll('button'));
        const archive = buttons.find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Archive'));
        const enabled = (node) => !!node && !(node.disabled || node.getAttribute('aria-disabled') === 'true');
        return enabled(archive);
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Archive",
    },
    {
      type: "waitForDomContains",
      text: "Archived shared artifact for Capacity Trend Q3 Published Snapshot.",
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
          && text.includes('The latest archive action preserved an immutable snapshot artifact for this report.');
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
          && text.includes('"lifecycle": "archived"')
          && text.includes('"artifactRef": "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3_1"');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-selected-entry-lifecycle-archive.png",
      fullPage: true,
    },
  ],
};
