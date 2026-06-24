import {
  buildPreviewBootstrapSteps,
  buildQueuedSemanticValidationBehaviorsStep,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 720,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    buildQueuedSemanticValidationBehaviorsStep({
      behaviors: [
        {
          match: {
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            dimensions: ["event_date", "channel", "country_code"],
            measures: ["available_impressions", "household_uniques"],
          },
          delayMs: 800,
          result: {
            valid: true,
            normalizedSelection: {
              entity: "line_delivery",
              dimensions: ["event_date", "channel", "country_code"],
              measures: ["available_impressions", "household_uniques"],
            },
            diagnostics: [],
          },
        },
        {
          match: {
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            dimensions: ["event_date", "channel", "age_group"],
            measures: ["available_impressions", "household_uniques"],
          },
          delayMs: 800,
          error: "Queued semantic provider unavailable.",
        },
      ],
    }),
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.semanticValidationBehaviors) && window.__REPORT_BUILDER_PREVIEW__.semanticValidationBehaviors.length === 2",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Performance metrics settings",
    },
    {
      type: "waitForDomContains",
      text: "BREAK DOWN BY",
      timeoutMs: 60000,
    },
    {
      type: "selectSelector",
      selector: "select",
      index: 0,
      value: "country",
    },
    {
      type: "waitForDomContains",
      text: "Validating the semantic selection against the provider.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; const runButtons = Array.from(document.querySelectorAll('button')).filter((button) => (button.innerText || '').trim() === 'Run'); const remaining = window.__REPORT_BUILDER_PREVIEW__ && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.semanticValidationBehaviors) ? window.__REPORT_BUILDER_PREVIEW__.semanticValidationBehaviors.length : -1; return !text.includes('Validating the semantic selection against the provider.') && !text.includes('Resolve semantic selection issues') && runButtons.length === 1 && runButtons[0].disabled === false && remaining === 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "selectSelector",
      selector: "select",
      index: 0,
      value: "agegroupId",
    },
    {
      type: "waitForDomContains",
      text: "Validating the semantic selection against the provider.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Semantic validation: Queued semantic provider unavailable.",
      timeoutMs: 60000,
    },
    {
      type: "assertDomContains",
      text: "Resolve semantic selection issues",
    },
    {
      type: "waitForEval",
      expression: "(() => { const runButtons = Array.from(document.querySelectorAll('button')).filter((button) => (button.innerText || '').trim() === 'Run'); const remaining = window.__REPORT_BUILDER_PREVIEW__ && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.semanticValidationBehaviors) ? window.__REPORT_BUILDER_PREVIEW__.semanticValidationBehaviors.length : -1; return runButtons.length === 1 && runButtons[0].disabled === true && remaining === 0; })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-queue-proof.png",
      fullPage: true,
    },
  ],
};
