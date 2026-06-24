import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FORGE_ROOT = "/Users/awitas/go/src/github.com/viant/forge";
const STEWARD_ROOT = "/Users/awitas/go/src/github.com/viant-internal/steward_ai/deployment/steward";
const SYNTHETIC_SEMANTIC_MODEL_REF = "model://example/operations/performance@v1";
const SYNTHETIC_SEMANTIC_MODEL_LABEL = "Operational Analytics";
const SYNTHETIC_SEMANTIC_ENTITY_ID = "order_performance";
const SYNTHETIC_SEMANTIC_ENTITY_LABEL = "Order Performance";

function buildWindowContentJSON(windowKey, sharedConfigPath) {
  const contentPath = path.join(
    STEWARD_ROOT,
    "extension/forge/windows",
    windowKey,
    "shared/content.yaml",
  );
  const sharedPath = path.join(STEWARD_ROOT, "shared", sharedConfigPath);
  const script = [
    'require "yaml"',
    'require "json"',
    `content = YAML.load_file(${JSON.stringify(contentPath)})`,
    `shared = YAML.load_file(${JSON.stringify(sharedPath)})`,
    'content["reportBuilder"] = shared["reportBuilder"]',
    "puts JSON.generate(content)",
  ].join("; ");
  return JSON.parse(execFileSync("ruby", ["-e", script], { encoding: "utf8" }));
}

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function titleizeId(value = "") {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function pickDefaultMeasureIds(reportBuilder = {}) {
  const measures = Array.isArray(reportBuilder?.measures) ? reportBuilder.measures : [];
  const primaryMeasure = String(reportBuilder?.primaryMeasure || "").trim();
  const defaults = measures
    .filter((entry) => entry?.default === true)
    .map((entry) => String(entry?.id || entry?.key || "").trim())
    .filter(Boolean);
  if (defaults.length > 0) {
    return defaults;
  }
  if (primaryMeasure) {
    return [primaryMeasure];
  }
  const first = String(measures[0]?.id || measures[0]?.key || "").trim();
  return first ? [first] : [];
}

function pickDefaultDimensionIds(reportBuilder = {}) {
  const dimensions = Array.isArray(reportBuilder?.dimensions) ? reportBuilder.dimensions : [];
  const defaults = dimensions
    .filter((entry) => entry?.default === true)
    .map((entry) => String(entry?.id || entry?.key || "").trim())
    .filter(Boolean);
  if (defaults.length > 0) {
    return defaults;
  }
  const first = String(dimensions[0]?.id || dimensions[0]?.key || "").trim();
  return first ? [first] : [];
}

function buildSyntheticSemanticContainer(container) {
  const nextContainer = deepClone(container);
  const reportBuilder = nextContainer?.reportBuilder && typeof nextContainer.reportBuilder === "object"
    ? nextContainer.reportBuilder
    : {};
  const measures = Array.isArray(reportBuilder.measures) ? reportBuilder.measures : [];
  const dimensions = Array.isArray(reportBuilder.dimensions) ? reportBuilder.dimensions : [];
  const selectedMeasures = pickDefaultMeasureIds(reportBuilder);
  const selectedDimensions = pickDefaultDimensionIds(reportBuilder);
  reportBuilder.binding = {
    mode: "semantic",
    modelRef: SYNTHETIC_SEMANTIC_MODEL_REF,
    entity: SYNTHETIC_SEMANTIC_ENTITY_ID,
    selectedMeasures,
    selectedDimensions,
  };
  reportBuilder.semanticModel = {
    modelRef: SYNTHETIC_SEMANTIC_MODEL_REF,
    version: 1,
    label: SYNTHETIC_SEMANTIC_MODEL_LABEL,
    description: "Synthetic hosted render semantic model for report builder smoke coverage.",
    entities: [
      {
        id: SYNTHETIC_SEMANTIC_ENTITY_ID,
        label: SYNTHETIC_SEMANTIC_ENTITY_LABEL,
        description: "Synthetic hosted render semantic entity.",
        dimensions: dimensions.map((entry) => ({
          id: String(entry?.id || entry?.key || "").trim(),
          label: titleizeId(entry?.label || entry?.id || entry?.key || ""),
          description: `Governed dimension for ${titleizeId(entry?.label || entry?.id || entry?.key || "")}.`,
          governance: {
            status: "approved",
            certification: "reviewed",
          },
        })).filter((entry) => !!entry.id),
        measures: measures.map((entry) => ({
          id: String(entry?.id || entry?.key || "").trim(),
          label: titleizeId(entry?.label || entry?.id || entry?.key || ""),
          description: `Governed measure for ${titleizeId(entry?.label || entry?.id || entry?.key || "")}.`,
          format: String(entry?.format || "number").trim() || "number",
          governance: {
            status: "approved",
            certification: "certified",
          },
        })).filter((entry) => !!entry.id),
        parameters: [],
      },
    ],
  };
  nextContainer.reportBuilder = reportBuilder;
  return nextContainer;
}

function buildRenderHarnessScript(containerPath, expectations = {}) {
  return `
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { signal } from '@preact/signals-react';
import ReportBuilder from '${FORGE_ROOT}/src/components/dashboard/ReportBuilder.jsx';

const container = JSON.parse(fs.readFileSync(${JSON.stringify(containerPath)}, 'utf8'));
const expectedSemanticNotice = ${JSON.stringify(String(expectations?.semanticNotice || "").trim())};

const context = {
  locale: 'en-US',
  identity: {
    dataSourceRef: String(container?.dataSourceRef || 'demo').trim() || 'demo',
    dataSourceId: String(container?.dataSourceRef || 'demo').trim() || 'demo',
    windowId: 'hostedReportBuilderSmoke',
  },
  metadata: {
    namespace: 'Hosted Render Smoke',
    dialogs: [],
  },
  signals: {
    collection: signal([]),
    control: signal({ loading: false, error: null }),
    windowForm: signal({}),
    collectionInfo: signal({ hasMore: false }),
    input: signal({ parameters: {} }),
    form: signal({}),
    metrics: signal({}),
    selection: signal({ selected: null, rowIndex: -1 }),
    message: signal(null),
  },
  handlers: {
    dataSource: {
      setWindowFormData({ values = {}, replace = false } = {}) {
        context.signals.windowForm.value = replace ? values : { ...context.signals.windowForm.peek(), ...values };
      },
      setInputParameters(request = {}) {
        context.signals.input.value = { ...context.signals.input.peek(), parameters: request };
      },
      async fetchRecords() {
        return { rows: [], hasMore: false };
      },
      getFormData() {
        return context.signals.form.peek() || {};
      },
    },
  },
  lookupHandler(name) {
    const normalized = String(name || '').trim();
    if (normalized.endsWith('.initializeState')) {
      return ({ state = {} } = {}) => state;
    }
    if (normalized.endsWith('.buildRequest')) {
      return ({ request = {} } = {}) => request;
    }
    if (normalized.endsWith('.resolveLookup')) {
      return () => null;
    }
    throw new Error(\`missing hook \${normalized}\`);
  },
  Context() {
    return context;
  },
};

const html = renderToStaticMarkup(React.createElement(ReportBuilder, { container, context }));
console.log(JSON.stringify({
  renderOk: true,
  semanticNoticeFound: expectedSemanticNotice ? html.includes(expectedSemanticNotice) : true,
  semanticUnavailableFound: html.includes('Semantic model unavailable'),
  snippet: html.slice(0, 800),
}));
`;
}

function assertHostedBuilderRender(windowKey, sharedConfigPath, {
  semanticVariant = false,
  semanticNotice = "",
} = {}) {
  const baseContainer = buildWindowContentJSON(windowKey, sharedConfigPath);
  const container = semanticVariant ? buildSyntheticSemanticContainer(baseContainer) : baseContainer;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reportbuilder-hosted-render-"));
  const containerPath = path.join(tempDir, `${windowKey}.json`);
  const harnessPath = path.join(tempDir, `${windowKey}.mjs`);
  fs.writeFileSync(containerPath, JSON.stringify(container), "utf8");
  fs.writeFileSync(harnessPath, buildRenderHarnessScript(containerPath, {
    semanticNotice,
  }), "utf8");
  const output = execFileSync(
    "npx",
    ["vite-node", "--script", harnessPath],
    {
      cwd: FORGE_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const summary = JSON.parse(output.trim().split("\n").filter(Boolean).pop());
  assert.equal(summary?.renderOk, true, `${windowKey} should render without crashing`);
  if (semanticNotice) {
    assert.equal(
      summary?.semanticNoticeFound,
      true,
      `${windowKey} semantic variant should render ${semanticNotice}`,
    );
    assert.equal(
      summary?.semanticUnavailableFound,
      false,
      `${windowKey} semantic variant should not fall back to semantic-model-unavailable copy`,
    );
  }
}

assertHostedBuilderRender("metricReportBuilder", "metric_report_builder.yaml");
assertHostedBuilderRender("forecastingCubeBuilder", "forecasting_report_builder.yaml");
assertHostedBuilderRender("metricReportBuilder", "metric_report_builder.yaml", {
  semanticVariant: true,
  semanticNotice: `Semantic binding: ${SYNTHETIC_SEMANTIC_MODEL_LABEL} • Entity: ${SYNTHETIC_SEMANTIC_ENTITY_LABEL}`,
});
assertHostedBuilderRender("forecastingCubeBuilder", "forecasting_report_builder.yaml", {
  semanticVariant: true,
  semanticNotice: `Semantic binding: ${SYNTHETIC_SEMANTIC_MODEL_LABEL} • Entity: ${SYNTHETIC_SEMANTIC_ENTITY_LABEL}`,
});

console.log("report-builder-hosted-steward-render-smoke ✓ hosted Steward builders render through Forge ReportBuilder and semantic binding is visible in the real builder shell");
