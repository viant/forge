import {
  buildPreviewBootstrapSteps,
  buildSemanticValidationBehaviorInjectionSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 720,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    buildSemanticValidationBehaviorInjectionSteps({
      match: {
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        dimensions: ["event_date", "channel", "country_code"],
        measures: ["available_impressions", "household_uniques"],
      },
      delayMs: 1200,
      result: {
        valid: true,
        normalizedSelection: {
          entity: "line_delivery",
          dimensions: ["event_date", "channel", "country_code"],
          measures: ["available_impressions", "household_uniques"],
        },
        diagnostics: [],
      },
    }),
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
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; const runButtons = Array.from(document.querySelectorAll('button')).filter((button) => (button.innerText || '').trim() === 'Run'); return text.includes('Validating the semantic selection against the provider.') || (!text.includes('Semantic provider diagnostics') && !text.includes('Resolve semantic selection issues') && runButtons.length === 1 && runButtons[0].disabled === false); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; const runButtons = Array.from(document.querySelectorAll('button')).filter((button) => (button.innerText || '').trim() === 'Run'); return !text.includes('Validating the semantic selection against the provider.') && !text.includes('Semantic provider diagnostics') && !text.includes('Resolve semantic selection issues') && runButtons.length === 1 && runButtons[0].disabled === false; })()",
      timeoutMs: 60000,
    },
    {
      type: "selectSelector",
      selector: "select",
      index: 0,
      value: "",
    },
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('select')[0] && document.querySelectorAll('select')[0].value === ''",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { window.__semanticSuccessStaleValidationStartedAt = Date.now(); const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceSemanticValidationBehaviors !== 'function') { throw new Error('replaceSemanticValidationBehaviors API not available.'); } return preview.replaceSemanticValidationBehaviors([{ match: { modelRef: 'model://example/performance/delivery@v1', entity: 'line_delivery', dimensions: ['event_date', 'channel', 'country_code'], measures: ['available_impressions', 'household_uniques'] }, delayMs: 1500, result: { valid: true, normalizedSelection: { entity: 'line_delivery', dimensions: ['event_date', 'channel', 'country_code'], measures: ['available_impressions', 'household_uniques'] }, diagnostics: [] } }]); })()",
    },
    {
      type: "selectSelector",
      selector: "select",
      index: 0,
      value: "country",
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Validating the semantic selection against the provider.') || document.querySelectorAll('select')[0]?.value === 'country'; })()",
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
      text: "Audience Age Group is not supported for this semantic selection in the demo provider.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; const runButtons = Array.from(document.querySelectorAll('button')).filter((button) => (button.innerText || '').trim() === 'Run'); return Date.now() - (window.__semanticSuccessStaleValidationStartedAt || 0) >= 1800 && !text.includes('Validating the semantic selection against the provider.') && text.includes('Resolve semantic selection issues') && text.includes('Audience Age Group is not supported for this semantic selection in the demo provider.') && text.includes('Household Uniques cannot be combined with Audience Age Group in this demo semantic provider.') && runButtons.length === 1 && runButtons[0].disabled === true; })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-success-proof.png",
      fullPage: true,
    },
  ],
};
