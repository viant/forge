import {
  buildInlineArtifactImportSteps,
  buildSectionButtonClickStep,
} from "./report-builder-preview-scenario-builders.mjs";

const publishedSnapshotArtifactExpression = `(() => {
  const preview = window.__REPORT_BUILDER_PREVIEW__;
  const payloads = preview?.getSeededSavedReportPayloads?.() || [];
  const target = payloads.find((entry) => (entry?.savedReportPayload?.reportDocument?.id || entry?.reportId) === 'capacityTrendQ3') || payloads[0];
  const payload = target?.savedReportPayload || target;
  const exportRequest = target?.exportRequest;
  if (!payload?.reportDocument || !exportRequest?.reportSpec || !exportRequest?.reportFill) {
    throw new Error('seeded active published-snapshot artifact source not found');
  }
  const document = JSON.parse(JSON.stringify(payload.reportDocument));
  document.title = 'Capacity Trend Q3 Published Snapshot';
  return {
    version: 1,
    kind: 'reportBuilder.publishedSnapshot',
    id: 'published_snapshot_capacityTrendQ3',
    title: 'Capacity Trend Q3 Published Snapshot',
    reportId: document.id || 'capacityTrendQ3',
    documentVersion: (exportRequest?.source?.documentVersion || 6) + 1,
    savedAt: (payload?.savedAt || 6100) + 1,
    lifecycle: 'published',
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
      artifactExpression: publishedSnapshotArtifactExpression,
      filename: "capacity-trend.active-lifecycle.published-snapshot.failure.json",
      importedNoticeText: "Imported published snapshot Capacity Trend Q3 Published Snapshot. Reopen and export are ready.",
      captureDownloads: false,
    }),
    {
      type: "waitForDomContains",
      text: "Imported saved report records",
      timeoutMs: 60000,
    },
    buildSectionButtonClickStep({
      sectionIncludes: "Capacity Trend Q3 Published Snapshot",
      buttonTexts: ["Use"],
      missingSectionMessage: "published-snapshot imported record card not found",
      missingButtonMessage: "published-snapshot use button not found",
    }),
    {
      type: "waitForDomContains",
      text: "Capacity Trend Q3 Published Snapshot is now the active saved report record.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Active saved artifact",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const section = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Active saved artifact'));
        if (!section) { return false; }
        const buttons = Array.from(section.querySelectorAll('button')).map((entry) => ((entry.innerText || entry.textContent || '').trim()));
        return buttons.includes('Archive');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: `(() => {
        const preview = window.__REPORT_BUILDER_PREVIEW__;
        if (!preview || typeof preview.replaceLifecycleBehaviors !== 'function') {
          throw new Error('replaceLifecycleBehaviors API not available');
        }
        return preview.replaceLifecycleBehaviors([{
          match: {
            action: 'archive',
            source: 'reportBuilder',
            title: 'Capacity Trend Q3 Published Snapshot',
          },
          error: 'Preview lifecycle archive was rejected for Capacity Trend Q3 Published Snapshot.',
        }]) === 1;
      })()`,
    },
    buildSectionButtonClickStep({
      sectionIncludes: "Active saved artifact",
      buttonTexts: ["Archive"],
      missingSectionMessage: "active saved artifact section not found",
      missingButtonMessage: "active saved artifact archive button not found",
    }),
    {
      type: "waitForDomContains",
      text: "Archive failed for Capacity Trend Q3 Published Snapshot. Preview lifecycle archive was rejected for Capacity Trend Q3 Published Snapshot.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const text = document.body?.innerText || document.body?.textContent || '';
        const section = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Active saved artifact'));
        const buttons = Array.from(section?.querySelectorAll('button') || []).map((entry) => ((entry.innerText || entry.textContent || '').trim()));
        return text.includes('Archive failed for Capacity Trend Q3 Published Snapshot. Preview lifecycle archive was rejected for Capacity Trend Q3 Published Snapshot.')
          && buttons.includes('Archive')
          && !text.includes('Latest shared artifact');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-published-snapshot-lifecycle-archive-failure.png",
      fullPage: true,
    },
  ],
};
