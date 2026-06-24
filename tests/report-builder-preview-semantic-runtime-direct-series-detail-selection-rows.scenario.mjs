import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && typeof preview.replaceDetailTargetBehaviors === 'function' && preview.replaceDetailTargetBehaviors([{ match: { targetRef: 'target://example/performance/date-detail' }, result: { targetRef: 'target://example/performance/date-detail', navigationMode: 'hostRoute', parameters: { eventDate: '$value', country: '$row.country' } } }]) === 1 && Array.isArray(preview.detailTargetBehaviors) && preview.detailTargetBehaviors.length === 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const close = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Close')); if (close) { close.click(); } return true; })()",
    },
    {
      type: "clickSelector",
      selector: ".forge-report-builder__chart-action-button--quick",
    },
    {
      type: "clickSelectorContains",
      selector: "[role=\"menuitem\"]",
      text: "Avails + HH Uniques by Date",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Avails + HH Uniques by Date",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceCollectionRows !== 'function') { throw new Error('Preview replaceCollectionRows API not available.'); } preview.replaceCollectionRows([{ eventDate: '2026-05-01', avails: 40000, hhUniqs: 16000, country: 'US' }, { eventDate: '2026-05-01', avails: 34700, hhUniqs: 15200, country: 'US' }, { eventDate: '2026-05-02', avails: 42000, hhUniqs: 17000, country: 'US' }, { eventDate: '2026-05-02', avails: 36400, hhUniqs: 15600, country: 'US' }, { eventDate: '2026-05-03', avails: 36000, hhUniqs: 14800, country: 'CA' }, { eventDate: '2026-05-03', avails: 33700, hhUniqs: 14200, country: 'CA' }, { eventDate: '2026-05-04', avails: 38000, hhUniqs: 15500, country: 'CA' }, { eventDate: '2026-05-04', avails: 35800, hhUniqs: 14900, country: 'CA' }], { hasMore: false, error: null }); return true; })()",
    },
    {
      type: "waitForDomContains",
      text: "34.7K",
      timeoutMs: 60000,
    },
    {
      type: "waitSelector",
      selector: ".forge-report-builder__runtime-preview .forge-report-runtime-chart-panel .recharts-bar-rectangle",
      index: 0,
      timeoutMs: 60000,
    },
    {
      type: "clickSelector",
      selector: ".forge-report-builder__runtime-preview .forge-report-runtime-chart-panel .recharts-bar-rectangle",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Selected value: 2026-05-01 • avails",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action",
      text: "Show date details",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Resolved detail target",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-host-intent'); const runtimeText = document.querySelector('.forge-report-builder__runtime-preview')?.innerText || ''; const text = panel?.innerText || panel?.textContent || ''; const parameterCount = panel?.querySelectorAll('.forge-report-runtime-host-intent__parameter')?.length || 0; return parameterCount === 2 && text.includes('target://example/performance/date-detail') && text.includes('eventDate') && text.includes('2026-05-01') && text.includes('country') && text.includes('US') && !runtimeText.includes('Detail target resolved with omitted parameters: country.') && !runtimeText.includes('No detail target resolved') && !runtimeText.includes('Failed to resolve detail target'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-runtime-direct-series-detail-selection-rows-proof.png",
      fullPage: true,
    },
  ],
};
