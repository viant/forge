import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1400,
    height: 1100,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    {
      type: "clickRole",
      role: "button",
      name: "Design",
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const rows = Array.from(document.querySelectorAll('.forge-report-builder__design-source-grid-row'))
          .map((entry) => ((entry.innerText || entry.textContent || '').replace(/\\s+/g, ' ').trim()));
        const templateRow = rows.find((entry) => entry.includes('Forecast Country Dashboard Brief'));
        return !!templateRow
          && templateRow.includes('2 DATASETS')
          && templateRow.includes('6 BLOCKS');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: `(() => {
        const rows = Array.from(document.querySelectorAll('.forge-report-builder__design-source-grid-row'));
        const row = rows.find((entry) => ((entry.innerText || entry.textContent || '').includes('Forecast Country Dashboard Brief')));
        if (!row) {
          throw new Error('Forecast Country Dashboard Brief row not found.');
        }
        const button = Array.from(row.querySelectorAll('button'))
          .find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Use'));
        if (!button) {
          throw new Error('Forecast Country Dashboard Brief use button not found.');
        }
        button.click();
        return true;
      })()`,
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.();
        const blocks = Array.isArray(state?.reportDocumentBlocks) ? state.reportDocumentBlocks : [];
        const snapshotBlocks = blocks.filter((block) => block?.datasetRef === 'forecast_country_snapshot');
        return state?.reportDocumentTemplateId === 'forecast_country_dashboard_brief'
          && state?.reportDocumentTitle === 'Forecast Country Dashboard Brief'
          && snapshotBlocks.length === 3
          && snapshotBlocks.some((block) => block?.id === 'countrySnapshotChart')
          && snapshotBlocks.some((block) => block?.id === 'countrySnapshotKpi')
          && snapshotBlocks.some((block) => block?.id === 'countrySnapshotTable');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-country-dashboard-template.png",
      fullPage: true,
    },
  ],
};
