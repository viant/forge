import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FORGE_ROOT = "/Users/awitas/go/src/github.com/viant/forge";
const STEWARD_ROOT = "/Users/awitas/go/src/github.com/viant-internal/steward_ai/deployment/steward";

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

function buildRenderHarnessScript(containerPath) {
  return `
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { signal } from '@preact/signals-react';
import ReportBuilder from '${FORGE_ROOT}/src/components/dashboard/ReportBuilder.jsx';

const container = JSON.parse(fs.readFileSync(${JSON.stringify(containerPath)}, 'utf8'));

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
console.log('render-ok');
console.log(html.slice(0, 400));
`;
}

function assertHostedBuilderRender(windowKey, sharedConfigPath) {
  const container = buildWindowContentJSON(windowKey, sharedConfigPath);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reportbuilder-hosted-render-"));
  const containerPath = path.join(tempDir, `${windowKey}.json`);
  const harnessPath = path.join(tempDir, `${windowKey}.mjs`);
  fs.writeFileSync(containerPath, JSON.stringify(container), "utf8");
  fs.writeFileSync(harnessPath, buildRenderHarnessScript(containerPath), "utf8");
  const output = execFileSync(
    "npx",
    ["vite-node", "--script", harnessPath],
    {
      cwd: FORGE_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  assert.equal(output.includes("render-ok"), true, `${windowKey} should render without crashing`);
}

assertHostedBuilderRender("metricReportBuilder", "metric_report_builder.yaml");
assertHostedBuilderRender("forecastingCubeBuilder", "forecasting_report_builder.yaml");

console.log("report-builder-hosted-steward-render-smoke ✓ current Steward metrics and forecasting builders render through Forge ReportBuilder without crashing");
