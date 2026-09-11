import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: { width: 1400, height: 1000 },
  steps: [
    ...buildPreviewBootstrapSteps({ captureDownloads: true }),
    { type: "clickRole", role: "button", name: "Design" },
    {
      type: "eval",
      expression: `(() => {
        const row = Array.from(document.querySelectorAll('.forge-report-builder__design-source-grid-row'))
          .find((entry) => (entry.innerText || entry.textContent || '').includes('Forecast Country Dashboard Brief'));
        const button = row && Array.from(row.querySelectorAll('button')).find((entry) => (entry.innerText || entry.textContent || '').trim() === 'Use');
        if (!button) throw new Error('Multi-dataset template is unavailable.');
        button.click();
        return true;
      })()`,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.()?.reportDocumentTemplateId === 'forecast_country_dashboard_brief'",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: `(() => {
        const preview = window.__REPORT_BUILDER_PREVIEW__;
        if (typeof preview?.replaceRuntimeDatasetPayloads !== 'function') throw new Error('Runtime dataset payload API is unavailable.');
        preview.replaceRuntimeDatasetPayloads({
          primary: { rows: [{ channelV2: 'Seeded Primary', avails: 810000, hhUniqs: 350000, reachRate: 43.2 }], hasMore: true },
          forecast_country_snapshot: { rows: [
            { country: 'North', avails: 420000, hhUniqs: 180000 },
            { country: 'South', avails: 390000, hhUniqs: 170000 }
          ], hasMore: false },
          audit_notes: { rows: [{ note: 'isolated named dataset' }], hasMore: false }
        });
        const state = preview.getBuilderState();
        const blocks = (state.reportDocumentBlocks || []).map((block) => block.id === 'countrySnapshotTable'
          ? { ...block, collapsible: true, defaultCollapsed: true }
          : block);
        const byId = new Map(blocks.map((block) => [block.id, block]));
        const nextBlocks = [
          byId.get('scopeFilters'),
          { id: 'proofTabs', kind: 'tabGroupBlock', title: 'Runtime Views', sectionIds: ['primaryView', 'snapshotView'], defaultSectionId: 'primaryView' },
          { id: 'primaryView', kind: 'sectionBlock', title: 'Primary View', navigationLabel: 'Primary View' },
          byId.get('primaryHeadline'),
          { id: 'snapshotView', kind: 'sectionBlock', title: 'Snapshot View', navigationLabel: 'Snapshot View' },
          byId.get('countrySnapshotKpi'), byId.get('countrySnapshotChart'), byId.get('countrySnapshotTable')
        ].filter(Boolean);
        return !!preview.patchBuilderState({
          reportDocumentBlocks: nextBlocks,
          reportDocumentLayout: { type: 'stack', items: nextBlocks.map((block) => ({ blockId: block.id })) }
        });
      })()`,
    },
    { type: "waitForDomContains", text: "RUNTIME VIEWS", timeoutMs: 60000 },
    { type: "waitForDomContains", text: "Seeded Primary", timeoutMs: 60000 },
    { type: "clickRole", role: "tab", name: "Snapshot View" },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || ''; return text.includes('Country Snapshot Table') && text.includes('North') && text.includes('South') && text.includes('Showing 2 of 2 rows'); })()",
      timeoutMs: 60000,
    },
    { type: "clickRole", role: "button", name: "Expand Country Snapshot Table" },
    { type: "waitForEval", expression: "!!document.querySelector('[aria-label=\"Collapse Country Snapshot Table\"]')", timeoutMs: 60000 },
    { type: "clickRole", role: "tab", name: "Filters", exact: true },
    { type: "waitForDomContains", text: "DATE RANGE", timeoutMs: 60000 },
    { type: "clickRole", role: "tab", name: "Layout", exact: true },
    { type: "clickSelector", selector: ".forge-report-builder__design-mode-control" },
    { type: "clickRole", role: "button", name: "Export", exact: true },
    { type: "waitForDomContains", text: "PDF", timeoutMs: 60000 },
    { type: "waitForDomContains", text: "XLSX", timeoutMs: 60000 },
    { type: "waitForDomContains", text: "CSV", timeoutMs: 60000 },
    { type: "clickRole", role: "menuitem", name: "CSV", exact: true },
    { type: "waitForEval", expression: "window.__artifactDownloadCapture?.filename?.endsWith('.csv') && window.__artifactDownloadCapture?.mimeType?.includes('text/csv') && window.__artifactDownloadCapture?.payloadReady === true", timeoutMs: 60000 },
    { type: "setViewport", width: 1024, height: 900 },
    { type: "wait", ms: 300 },
    { type: "setViewport", width: 768, height: 1024 },
    { type: "wait", ms: 300 },
    { type: "setViewport", width: 390, height: 844 },
    { type: "wait", ms: 300 },
    { type: "screenshot", file: "multi-dataset-runtime-proof.png", fullPage: true },
  ],
};
