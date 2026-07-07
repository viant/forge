import {
  buildPreviewBootstrapSteps,
  buildPreviewPatchBuilderStateStep,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    {
      type: "eval",
      expression: `(() => {
        window.localStorage.setItem("reportBuilder.workspaceMode.desktop.demoReportBuilder.demoReportBuilderWindow", JSON.stringify("design"));
        window.localStorage.setItem("reportBuilder.workspaceMode.desktop.demoReportBuilder", JSON.stringify("design"));
        return true;
      })()`,
    },
    {
      type: "reload",
    },
    {
      type: "waitForEval",
      expression: `(() => !!document.querySelector('[data-testid="report-builder-outline"]'))()`,
      timeoutMs: 60000,
    },
    buildPreviewPatchBuilderStateStep({
      patch: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate", "channelV2"],
        viewMode: "table",
        chartSpec: null,
        staticFilters: {
          dateRange: {
            start: "2026-05-01",
            end: "2026-05-04",
          },
        },
        reportDocumentBlocks: [
          {
            id: "detailTable",
            kind: "tableBlock",
            title: "Detail Table",
            columns: [],
          },
        ],
        reportDocumentLayout: {
          type: "stack",
          items: [
            { blockId: "primaryBuilder" },
            { blockId: "detailTable" },
          ],
        },
      },
    }),
    {
      type: "waitForDomContains",
      text: "Detail Table does not define any table fields.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Apply current fields",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Apply current fields",
    },
    {
      type: "waitForDomContains",
      text: "Detail Table now uses the current fields. Refreshing results.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const root = document.querySelector('.forge-report-builder');
        const text = document.body?.innerText || document.body?.textContent || '';
        return root?.getAttribute('data-report-builder-state') !== 'loading'
          && !text.includes('Refreshing report data')
          && !text.includes("We couldn't render these results");
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Report mode. Run the report and review the live result.",
    },
    {
      type: "waitForDomContains",
      text: "Semantic binding: Ad Delivery • Entity: Line Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => {
        const panel = Array.from(document.querySelectorAll('section'))
          .find((node) => ((node.innerText || node.textContent || '')).includes('Detail Table'));
        const text = panel?.innerText || panel?.textContent || '';
        return text.includes('Date')
          && text.includes('Channel')
          && text.includes('Available Impressions')
          && text.includes('May 1, 2026')
          && text.includes('Display')
          && !text.includes('does not define any table fields');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-empty-table-apply-current-fields-proof.png",
      fullPage: true,
    },
  ],
};
