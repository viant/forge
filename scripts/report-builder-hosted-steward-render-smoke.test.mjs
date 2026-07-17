import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildReportBuilderDefaultState,
  buildReportBuilderDefaultChartSpecs,
  buildReportBuilderDefaultTablePresets,
  buildReportBuilderQuickViewOptions,
  buildReportBuilderChartFields,
  getReportBuilderQuickPresetPolicy,
  validateReportBuilderChartSpec,
  isExplicitReportBuilderChartMode,
} from "../src/components/dashboard/reportBuilderUtils.js";
import { buildReportBuilderActionModel } from "../src/components/dashboard/reportBuilderActionModel.js";
import { buildReportBuilderDesktopResultHeaderState } from "../src/components/dashboard/reportBuilderResultHeader.js";

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

function resolveConfigEntry(reportBuilder = {}, collectionKey = "", id = "") {
  const normalizedCollectionKey = String(collectionKey || "").trim();
  const normalizedId = String(id || "").trim();
  if (!normalizedCollectionKey || !normalizedId) {
    return null;
  }
  const entries = Array.isArray(reportBuilder?.[normalizedCollectionKey]) ? reportBuilder[normalizedCollectionKey] : [];
  return entries.find((entry) => {
    const entryId = String(entry?.id || entry?.key || "").trim();
    return entryId === normalizedId;
  }) || null;
}

function resolveConfigEntryLabel(reportBuilder = {}, collectionKey = "", id = "") {
  const entry = resolveConfigEntry(reportBuilder, collectionKey, id);
  return String(entry?.label || titleizeId(id)).trim() || titleizeId(id);
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
  reportBuilder.result = {
    ...(reportBuilder.result && typeof reportBuilder.result === "object" ? reportBuilder.result : {}),
    runtimePreview: {
      ...(
        reportBuilder?.result?.runtimePreview && typeof reportBuilder.result.runtimePreview === "object"
          ? reportBuilder.result.runtimePreview
          : {}
      ),
      enabled: true,
    },
  };
  nextContainer.reportBuilder = reportBuilder;
  return nextContainer;
}

function buildHostedSyntheticDimensionValue(dimensionId = "", rowIndex = 0) {
  const normalizedId = String(dimensionId || "").trim();
  const normalizedKey = normalizedId.toLowerCase();
  if (!normalizedKey) {
    return `Value ${rowIndex + 1}`;
  }
  if (normalizedKey.includes("date")) {
    return `2026-06-${String(23 + rowIndex).padStart(2, "0")}`;
  }
  if (normalizedKey === "channelid") {
    return rowIndex + 1;
  }
  if (normalizedKey === "channelv2") {
    return ["Display", "CTV", "Mobile"][rowIndex] || `Channel ${rowIndex + 1}`;
  }
  if (normalizedKey.includes("country")) {
    return ["US", "CA", "GB"][rowIndex] || `C${rowIndex + 1}`;
  }
  if (normalizedKey.includes("region")) {
    return ["North", "South", "West"][rowIndex] || `Region ${rowIndex + 1}`;
  }
  if (normalizedKey.includes("city")) {
    return ["Warsaw", "Austin", "Berlin"][rowIndex] || `City ${rowIndex + 1}`;
  }
  if (normalizedKey.endsWith("id")) {
    return rowIndex + 101;
  }
  return `${titleizeId(normalizedId)} ${rowIndex + 1}`;
}

function buildHostedSyntheticMeasureValue(measureId = "", rowIndex = 0, measureIndex = 0) {
  const normalizedId = String(measureId || "").trim().toLowerCase();
  if (normalizedId.includes("rate") || normalizedId.includes("pct") || normalizedId.includes("share")) {
    return Number((0.12 + (rowIndex * 0.07) + (measureIndex * 0.01)).toFixed(4));
  }
  if (normalizedId.includes("price") || normalizedId.includes("ecpm")) {
    return Number((8.5 + (rowIndex * 1.75) + (measureIndex * 0.25)).toFixed(2));
  }
  return ((rowIndex + 1) * 1000) + ((measureIndex + 1) * 125);
}

function buildHostedSyntheticCollection(reportBuilder = {}, seededBuilderState = null) {
  const selectedDimensions = Array.isArray(seededBuilderState?.selectedDimensions)
    ? seededBuilderState.selectedDimensions.map((entry) => String(entry || "").trim()).filter(Boolean)
    : pickDefaultDimensionIds(reportBuilder);
  const selectedMeasures = Array.isArray(seededBuilderState?.selectedMeasures)
    ? seededBuilderState.selectedMeasures.map((entry) => String(entry || "").trim()).filter(Boolean)
    : pickDefaultMeasureIds(reportBuilder);
  return Array.from({ length: 3 }, (_, rowIndex) => {
    const row = {};
    selectedDimensions.forEach((dimensionId) => {
      row[dimensionId] = buildHostedSyntheticDimensionValue(dimensionId, rowIndex);
    });
    selectedMeasures.forEach((measureId, measureIndex) => {
      row[measureId] = buildHostedSyntheticMeasureValue(measureId, rowIndex, measureIndex);
    });
    return row;
  });
}

function buildHostedResultExpectationState(container = {}) {
  const reportBuilder = container?.reportBuilder || {};
  const seededBuilderState = buildReportBuilderDefaultState({
    ...reportBuilder,
    binding: null,
  });
  if (reportBuilder?.binding && typeof reportBuilder.binding === "object") {
    seededBuilderState.binding = reportBuilder.binding;
  }
  const selectedDimensions = Array.isArray(seededBuilderState?.selectedDimensions)
    ? seededBuilderState.selectedDimensions.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
  const selectedMeasures = Array.isArray(seededBuilderState?.selectedMeasures)
    ? seededBuilderState.selectedMeasures.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
  const expectedTableHeaders = [
    ...selectedDimensions.map((id) => resolveConfigEntryLabel(reportBuilder, "dimensions", id)),
    ...selectedMeasures.map((id) => resolveConfigEntryLabel(reportBuilder, "measures", id)),
  ];
  return {
    seededBuilderState,
    seededCollection: buildHostedSyntheticCollection(reportBuilder, seededBuilderState),
    expectedTableHeaders,
  };
}

function buildHostedChartExpectationState(container = {}) {
  const reportBuilder = container?.reportBuilder || {};
  const baseState = buildReportBuilderDefaultState({
    ...reportBuilder,
    binding: null,
  });
  if (reportBuilder?.binding && typeof reportBuilder.binding === "object") {
    baseState.binding = reportBuilder.binding;
  }
  const defaultChartSpec = buildReportBuilderDefaultChartSpecs(reportBuilder, baseState)[0] || null;
  const seededBuilderState = defaultChartSpec
    ? {
        ...baseState,
        viewMode: "chart",
        chartSpec: defaultChartSpec,
      }
    : baseState;
  return {
    seededBuilderState,
    seededCollection: buildHostedSyntheticCollection(reportBuilder, seededBuilderState),
    expectedChartTitle: String(defaultChartSpec?.title || "").trim(),
    expectedChartTypeLabel: String(defaultChartSpec?.type || "").trim(),
  };
}

function buildHostedHeaderExpectationState(container = {}, seededBuilderState = null, seededCollection = []) {
  const reportBuilder = container?.reportBuilder || {};
  const resolvedState = seededBuilderState && typeof seededBuilderState === "object"
    ? seededBuilderState
    : buildReportBuilderDefaultState({
        ...reportBuilder,
        binding: null,
      });
  if (!resolvedState.binding && reportBuilder?.binding && typeof reportBuilder.binding === "object") {
    resolvedState.binding = reportBuilder.binding;
  }
  const explicitChartMode = isExplicitReportBuilderChartMode(reportBuilder);
  const viewModes = Array.isArray(reportBuilder?.result?.viewModes) && reportBuilder.result.viewModes.length > 0
    ? reportBuilder.result.viewModes
    : ["chart", "table"];
  const canRunReport = true;
  const canShowResults = canRunReport && Array.isArray(seededCollection) && seededCollection.length > 0;
  const defaultTablePresets = buildReportBuilderDefaultTablePresets(reportBuilder, resolvedState);
  const defaultChartSpecs = buildReportBuilderDefaultChartSpecs(reportBuilder, resolvedState);
  const quickPresetPolicy = getReportBuilderQuickPresetPolicy(reportBuilder);
  const quickChartOptions = buildReportBuilderQuickViewOptions({
    config: reportBuilder,
    state: resolvedState,
    quickPresetPolicy,
    defaultTablePresets,
    modifiedTablePreset: null,
    defaultChartSpecs,
    previousChartPresets: [],
  });
  const chartFields = buildReportBuilderChartFields(reportBuilder, resolvedState);
  const chartValidation = validateReportBuilderChartSpec(reportBuilder, resolvedState.chartSpec, chartFields);
  const hasValidChartSpec = !!resolvedState.chartSpec && chartValidation.valid;
  const actionModel = buildReportBuilderActionModel({
    viewModes,
    explicitChartMode,
    hasValidChartSpec,
    canShowResults,
    canRunReport,
    loading: false,
  });
  const headerState = buildReportBuilderDesktopResultHeaderState({
    desktopActionModel: actionModel.desktop,
    resultViewModes: actionModel.resultModes,
    currentViewMode: String(resolvedState?.viewMode || "").trim(),
    explicitChartMode,
    hasValidChartSpec,
    canCreateChart: chartFields.some((entry) => String(entry?.kind || "").trim() === "dimension")
      && chartFields.some((entry) => String(entry?.kind || "").trim() === "measure"),
    hasTableQuickPresets: defaultTablePresets.length > 0,
    quickChartOptions,
    overflowActionCount: actionModel.desktop.overflowActionIds.length,
  });
  return {
    expectedQuickActionLabel: headerState.quickActions.enabled && quickChartOptions.length > 0
      ? String(headerState.quickActions.buttonLabel || "").trim()
      : "",
    expectedEditChartLabel: headerState.editChartEnabled ? "Edit Chart" : "",
    expectedOverflowLabel: headerState.overflowEnabled ? "More actions" : "",
    expectedViewToggleModes: headerState.viewToggleModes.map((entry) => String(entry?.mode || "").trim()).filter(Boolean),
  };
}

function buildRenderHarnessScript(containerPath, expectations = {}) {
  return `
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { signal } from '@preact/signals-react';
import ReportBuilder from '${FORGE_ROOT}/src/components/dashboard/ReportBuilder.jsx';
import { buildReportBuilderDefaultState } from '${FORGE_ROOT}/src/components/dashboard/reportBuilderUtils.js';
import { resolveReportBuilderReadiness } from '${FORGE_ROOT}/src/components/dashboard/reportBuilderUtils.js';

const container = JSON.parse(fs.readFileSync(${JSON.stringify(containerPath)}, 'utf8'));
const expectedSemanticNotice = ${JSON.stringify(String(expectations?.semanticNotice || "").trim())};
const expectedAuthoredRuntimeSemanticTitle = ${JSON.stringify(String(expectations?.authoredRuntimeSemanticTitle || "").trim())};
const expectedAuthoredRuntimeModelChip = ${JSON.stringify(String(expectations?.authoredRuntimeModelChip || "").trim())};
const expectedAuthoredRuntimeEntityChip = ${JSON.stringify(String(expectations?.authoredRuntimeEntityChip || "").trim())};
const expectedAuthoredRuntimeScopeTitle = ${JSON.stringify(String(expectations?.authoredRuntimeScopeTitle || "").trim())};
const expectedAuthoredRuntimeScopeValue = ${JSON.stringify(String(expectations?.authoredRuntimeScopeValue || "").trim())};
const seedDefaultBuilderState = ${expectations?.seedDefaultBuilderState === true ? "true" : "false"};
const seededCollection = ${JSON.stringify(Array.isArray(expectations?.seededCollection) ? expectations.seededCollection : [])};
const expectedTableHeaders = ${JSON.stringify(Array.isArray(expectations?.expectedTableHeaders) ? expectations.expectedTableHeaders : [])};
const expectedChartTitle = ${JSON.stringify(String(expectations?.expectedChartTitle || "").trim())};
const expectedChartTypeLabel = ${JSON.stringify(String(expectations?.expectedChartTypeLabel || "").trim())};
const expectedQuickActionLabel = ${JSON.stringify(String(expectations?.expectedQuickActionLabel || "").trim())};
const expectedEditChartLabel = ${JSON.stringify(String(expectations?.expectedEditChartLabel || "").trim())};
const expectedOverflowLabel = ${JSON.stringify(String(expectations?.expectedOverflowLabel || "").trim())};
const expectedViewToggleModes = ${JSON.stringify(Array.isArray(expectations?.expectedViewToggleModes) ? expectations.expectedViewToggleModes : [])};
const expectedWorkspaceMode = ${JSON.stringify(String(expectations?.workspaceMode || "").trim())};
const seededBuilderStateOverride = ${JSON.stringify(expectations?.seededBuilderState && typeof expectations.seededBuilderState === "object" ? expectations.seededBuilderState : null)};
const builderStateKey = String(container?.stateKey || container?.id || 'reportBuilder').trim() || 'reportBuilder';
const seededBuilderState = seededBuilderStateOverride && typeof seededBuilderStateOverride === 'object'
  ? seededBuilderStateOverride
  : (seedDefaultBuilderState
      ? (() => {
      const reportBuilderConfig = container?.reportBuilder || {};
      const defaults = buildReportBuilderDefaultState({
        ...reportBuilderConfig,
        binding: null,
      });
      return {
        ...defaults,
        ...(reportBuilderConfig?.binding && typeof reportBuilderConfig.binding === 'object'
          ? { binding: reportBuilderConfig.binding }
          : {}),
      };
    })()
  : null);
const seededWindowFormState = seededBuilderState ? { [builderStateKey]: seededBuilderState } : {};
const seededBaseReadiness = seededBuilderState
  ? resolveReportBuilderReadiness(container?.reportBuilder || {}, seededBuilderState)
  : null;
const workspaceModeStorage = new Map();
if (expectedWorkspaceMode) {
  workspaceModeStorage.set(\`reportBuilder.workspaceMode.desktop.\${builderStateKey}\`, JSON.stringify(expectedWorkspaceMode));
}
globalThis.window = {
  innerWidth: 1280,
  localStorage: {
    getItem(key) {
      return workspaceModeStorage.has(key) ? workspaceModeStorage.get(key) : null;
    },
    setItem(key, value) {
      workspaceModeStorage.set(key, String(value));
    },
    removeItem(key) {
      workspaceModeStorage.delete(key);
    },
  },
};

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
    collection: signal(seededCollection),
    control: signal({ loading: false, error: null }),
    windowForm: signal(seededWindowFormState),
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
const authoredRuntimePreviewIndex = (() => {
  const reportSurfaceIndex = html.indexOf('aria-label="Authored report"');
  return reportSurfaceIndex >= 0 ? reportSurfaceIndex : html.indexOf('aria-label="Authored runtime preview"');
})();
const authoredRuntimePreviewWindow = authoredRuntimePreviewIndex >= 0
  ? html.slice(authoredRuntimePreviewIndex, authoredRuntimePreviewIndex + 12000)
  : '';
const resultHeaderFound = html.includes('forge-report-builder__result-header');
const resultTableFound = html.includes('forge-report-builder__table') || html.includes('forge-report-runtime-table-panel');
const legacyResultMetaFound = html.includes('aria-label="Current result summary"');
const chartWrapFound = html.includes('forge-report-builder__chart-wrap') || html.includes('forge-report-runtime-chart-panel');
console.log(JSON.stringify({
  renderOk: true,
  semanticNoticeFound: expectedSemanticNotice ? html.includes(expectedSemanticNotice) : true,
  semanticUnavailableFound: html.includes('Semantic model unavailable'),
  authoredRuntimePreviewFound: authoredRuntimePreviewIndex >= 0,
  authoredRuntimeSemanticTitleFound: expectedAuthoredRuntimeSemanticTitle ? authoredRuntimePreviewWindow.includes(expectedAuthoredRuntimeSemanticTitle) : true,
  authoredRuntimeModelChipFound: expectedAuthoredRuntimeModelChip ? authoredRuntimePreviewWindow.includes(expectedAuthoredRuntimeModelChip) : true,
  authoredRuntimeEntityChipFound: expectedAuthoredRuntimeEntityChip ? authoredRuntimePreviewWindow.includes(expectedAuthoredRuntimeEntityChip) : true,
  authoredRuntimeScopeTitleFound: expectedAuthoredRuntimeScopeTitle ? authoredRuntimePreviewWindow.includes(expectedAuthoredRuntimeScopeTitle) : true,
  authoredRuntimeScopeValueFound: expectedAuthoredRuntimeScopeValue ? authoredRuntimePreviewWindow.includes(expectedAuthoredRuntimeScopeValue) : true,
  resultHeaderFound,
  resultTableFound,
  legacyResultMetaFound,
  chartWrapFound,
  expectedTableHeadersFound: expectedTableHeaders.every((entry) => html.includes(entry)),
  expectedChartTitleFound: expectedChartTitle ? html.includes(expectedChartTitle) : true,
  expectedChartTypeLabelFound: expectedChartTypeLabel ? html.toLowerCase().includes(expectedChartTypeLabel.toLowerCase()) : true,
  expectedQuickActionLabelFound: expectedQuickActionLabel ? html.includes(expectedQuickActionLabel) : true,
  expectedEditChartLabelFound: expectedEditChartLabel ? html.includes(expectedEditChartLabel) : true,
  expectedOverflowLabelFound: expectedOverflowLabel ? html.includes(expectedOverflowLabel) : true,
  expectedViewToggleModesFound: expectedViewToggleModes.every((entry) => html.includes(entry)),
  workspacePreviewFound: html.includes('forge-report-builder--workspace-preview'),
  workspaceReportFound: html.includes('forge-report-builder--workspace-report'),
  seededCollectionRowCount: Array.isArray(seededCollection) ? seededCollection.length : 0,
  builderStateKey,
  seededBuilderStateScopeParams: seededBuilderState?.scopeParams || seededBuilderState?.staticFilters || null,
  seededBaseReadiness,
  authoredRuntimePreviewSnippet: authoredRuntimePreviewWindow.slice(0, 2400),
  snippet: html.slice(0, 800),
}));
`;
}

function assertHostedBuilderRender(windowKey, sharedConfigPath, {
  semanticVariant = false,
  semanticNotice = "",
  authoredRuntimeSemanticTitle = "",
  authoredRuntimeModelChip = "",
  authoredRuntimeEntityChip = "",
  authoredRuntimeScopeTitle = "",
  authoredRuntimeScopeValue = "",
  seedDefaultBuilderState = false,
  seededCollection = [],
  seededBuilderState = null,
  expectedTableHeaders = [],
  expectedChartTitle = "",
  expectedChartTypeLabel = "",
  expectedQuickActionLabel = "",
  expectedEditChartLabel = "",
  expectedOverflowLabel = "",
  expectedViewToggleModes = [],
  workspaceMode = "",
} = {}) {
  const baseContainer = buildWindowContentJSON(windowKey, sharedConfigPath);
  const container = semanticVariant ? buildSyntheticSemanticContainer(baseContainer) : baseContainer;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reportbuilder-hosted-render-"));
  const containerPath = path.join(tempDir, `${windowKey}.json`);
  const harnessPath = path.join(tempDir, `${windowKey}.mjs`);
  fs.writeFileSync(containerPath, JSON.stringify(container), "utf8");
  fs.writeFileSync(harnessPath, buildRenderHarnessScript(containerPath, {
    semanticNotice,
    authoredRuntimeSemanticTitle,
    authoredRuntimeModelChip,
    authoredRuntimeEntityChip,
    authoredRuntimeScopeTitle,
    authoredRuntimeScopeValue,
    seedDefaultBuilderState,
    seededCollection,
    seededBuilderState,
    expectedTableHeaders,
    expectedChartTitle,
    expectedChartTypeLabel,
    expectedQuickActionLabel,
    expectedEditChartLabel,
    expectedOverflowLabel,
    expectedViewToggleModes,
    workspaceMode,
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
  if ((authoredRuntimeSemanticTitle || authoredRuntimeModelChip || authoredRuntimeEntityChip || authoredRuntimeScopeTitle || authoredRuntimeScopeValue) && !summary?.workspaceReportFound) {
    assert.equal(
      summary?.authoredRuntimePreviewFound,
      true,
      `${windowKey} semantic variant should render the authored runtime preview section\n${JSON.stringify(summary, null, 2)}`,
    );
    assert.equal(
      summary?.authoredRuntimeSemanticTitleFound,
      true,
      `${windowKey} authored runtime preview should render ${authoredRuntimeSemanticTitle}\n${JSON.stringify(summary, null, 2)}`,
    );
    assert.equal(
      summary?.authoredRuntimeModelChipFound,
      true,
      `${windowKey} authored runtime preview should render ${authoredRuntimeModelChip}\n${JSON.stringify(summary, null, 2)}`,
    );
    assert.equal(
      summary?.authoredRuntimeEntityChipFound,
      true,
      `${windowKey} authored runtime preview should render ${authoredRuntimeEntityChip}\n${JSON.stringify(summary, null, 2)}`,
    );
    assert.equal(
      summary?.authoredRuntimeScopeTitleFound,
      true,
      `${windowKey} authoredRuntime preview should render ${authoredRuntimeScopeTitle}\n${JSON.stringify(summary, null, 2)}`,
    );
    assert.equal(
      summary?.authoredRuntimeScopeValueFound,
      true,
      `${windowKey} authored runtime preview should render ${authoredRuntimeScopeValue}\n${JSON.stringify(summary, null, 2)}`,
    );
  }
  if (Array.isArray(seededCollection) && seededCollection.length > 0) {
    const expectsChartSurface = !!(expectedChartTitle || expectedChartTypeLabel);
    if (workspaceMode === "preview" || workspaceMode === "report") {
      assert.equal(
        summary?.workspaceReportFound,
        true,
        `${windowKey} seeded hosted state should render on the report surface\n${JSON.stringify(summary, null, 2)}`,
      );
    }
    assert.equal(
      summary?.seededBaseReadiness?.canRun,
      true,
      `${windowKey} seeded hosted state should remain runnable\n${JSON.stringify(summary, null, 2)}`,
    );
    assert.equal(
      summary?.resultHeaderFound,
      true,
      `${windowKey} seeded hosted state should render the desktop result header\n${JSON.stringify(summary, null, 2)}`,
    );
    assert.equal(
      summary?.legacyResultMetaFound,
      false,
      `${windowKey} seeded hosted state should not render legacy result meta chips\n${JSON.stringify(summary, null, 2)}`,
    );
    assert.equal(
      summary?.expectedQuickActionLabelFound,
      true,
      `${windowKey} seeded hosted state should render ${expectedQuickActionLabel}\n${JSON.stringify(summary, null, 2)}`,
    );
    if (!summary?.workspaceReportFound) {
      assert.equal(
        summary?.expectedViewToggleModesFound,
        true,
        `${windowKey} seeded hosted state should render the expected view toggle modes ${JSON.stringify(expectedViewToggleModes)}\n${JSON.stringify(summary, null, 2)}`,
      );
    }
    if (!expectsChartSurface && !summary?.workspaceReportFound) {
      assert.equal(
        summary?.resultTableFound,
        true,
        `${windowKey} seeded hosted state should render a result table\n${JSON.stringify(summary, null, 2)}`,
      );
      assert.equal(
        summary?.expectedTableHeadersFound,
        true,
        `${windowKey} seeded hosted state should render the expected table headers ${JSON.stringify(expectedTableHeaders)}\n${JSON.stringify(summary, null, 2)}`,
      );
      assert.equal(
        summary?.expectedEditChartLabelFound,
        true,
        `${windowKey} seeded hosted table state should reflect ${expectedEditChartLabel || "no edit-chart action"}\n${JSON.stringify(summary, null, 2)}`,
      );
      assert.equal(
        summary?.expectedOverflowLabelFound,
        true,
        `${windowKey} seeded hosted table state should reflect ${expectedOverflowLabel || "no overflow action"}\n${JSON.stringify(summary, null, 2)}`,
      );
    }
    if (expectsChartSurface && !summary?.workspaceReportFound) {
      assert.equal(
        summary?.chartWrapFound,
        true,
        `${windowKey} seeded hosted chart state should render the chart surface\n${JSON.stringify(summary, null, 2)}`,
      );
      assert.equal(
        summary?.resultTableFound,
        false,
        `${windowKey} seeded hosted chart state should not fall back to the table surface\n${JSON.stringify(summary, null, 2)}`,
      );
      assert.equal(
        summary?.expectedChartTitleFound,
        true,
        `${windowKey} seeded hosted chart state should render ${expectedChartTitle}\n${JSON.stringify(summary, null, 2)}`,
      );
      assert.equal(
        summary?.expectedChartTypeLabelFound,
        true,
        `${windowKey} seeded hosted chart state should render ${expectedChartTypeLabel}\n${JSON.stringify(summary, null, 2)}`,
      );
      assert.equal(
        summary?.expectedEditChartLabelFound,
        true,
        `${windowKey} seeded hosted chart state should reflect ${expectedEditChartLabel || "no edit-chart action"}\n${JSON.stringify(summary, null, 2)}`,
      );
      assert.equal(
        summary?.expectedOverflowLabelFound,
        true,
        `${windowKey} seeded hosted chart state should reflect ${expectedOverflowLabel || "no overflow action"}\n${JSON.stringify(summary, null, 2)}`,
      );
    }
  }
}

assertHostedBuilderRender("metricReportBuilder", "metric_report_builder.yaml");
assertHostedBuilderRender("forecastingCubeBuilder", "forecasting_report_builder.yaml");
assertHostedBuilderRender("metricReportBuilder", "metric_report_builder.yaml", {
  semanticVariant: true,
  semanticNotice: `Semantic binding: ${SYNTHETIC_SEMANTIC_MODEL_LABEL} • Entity: ${SYNTHETIC_SEMANTIC_ENTITY_LABEL}`,
  authoredRuntimeSemanticTitle: "Semantic Binding",
  authoredRuntimeModelChip: `Model ${SYNTHETIC_SEMANTIC_MODEL_LABEL}`,
  authoredRuntimeEntityChip: `Entity ${SYNTHETIC_SEMANTIC_ENTITY_LABEL}`,
  authoredRuntimeScopeTitle: "Filters",
  authoredRuntimeScopeValue: "Date Range",
  seedDefaultBuilderState: true,
  workspaceMode: "preview",
  ...(() => {
    const seeded = buildHostedResultExpectationState(buildSyntheticSemanticContainer(buildWindowContentJSON("metricReportBuilder", "metric_report_builder.yaml")));
    return {
      ...seeded,
      ...buildHostedHeaderExpectationState(buildSyntheticSemanticContainer(buildWindowContentJSON("metricReportBuilder", "metric_report_builder.yaml")), seeded.seededBuilderState, seeded.seededCollection),
    };
  })(),
});
assertHostedBuilderRender("forecastingCubeBuilder", "forecasting_report_builder.yaml", {
  semanticVariant: true,
  semanticNotice: `Semantic binding: ${SYNTHETIC_SEMANTIC_MODEL_LABEL} • Entity: ${SYNTHETIC_SEMANTIC_ENTITY_LABEL}`,
  authoredRuntimeSemanticTitle: "Semantic Binding",
  authoredRuntimeModelChip: `Model ${SYNTHETIC_SEMANTIC_MODEL_LABEL}`,
  authoredRuntimeEntityChip: `Entity ${SYNTHETIC_SEMANTIC_ENTITY_LABEL}`,
  authoredRuntimeScopeTitle: "Filters",
  authoredRuntimeScopeValue: "Date Range",
  seedDefaultBuilderState: true,
  workspaceMode: "preview",
  ...(() => {
    const container = buildSyntheticSemanticContainer(buildWindowContentJSON("forecastingCubeBuilder", "forecasting_report_builder.yaml"));
    const seeded = buildHostedResultExpectationState(container);
    return {
      ...seeded,
      ...buildHostedHeaderExpectationState(container, seeded.seededBuilderState, seeded.seededCollection),
    };
  })(),
});
assertHostedBuilderRender("metricReportBuilder", "metric_report_builder.yaml", {
  semanticVariant: true,
  semanticNotice: `Semantic binding: ${SYNTHETIC_SEMANTIC_MODEL_LABEL} • Entity: ${SYNTHETIC_SEMANTIC_ENTITY_LABEL}`,
  authoredRuntimeSemanticTitle: "Semantic Binding",
  authoredRuntimeModelChip: `Model ${SYNTHETIC_SEMANTIC_MODEL_LABEL}`,
  authoredRuntimeEntityChip: `Entity ${SYNTHETIC_SEMANTIC_ENTITY_LABEL}`,
  authoredRuntimeScopeTitle: "Filters",
  authoredRuntimeScopeValue: "Date Range",
  workspaceMode: "preview",
  ...(() => {
    const container = buildSyntheticSemanticContainer(buildWindowContentJSON("metricReportBuilder", "metric_report_builder.yaml"));
    const seeded = buildHostedChartExpectationState(container);
    return {
      ...seeded,
      ...buildHostedHeaderExpectationState(container, seeded.seededBuilderState, seeded.seededCollection),
    };
  })(),
});
assertHostedBuilderRender("forecastingCubeBuilder", "forecasting_report_builder.yaml", {
  semanticVariant: true,
  semanticNotice: `Semantic binding: ${SYNTHETIC_SEMANTIC_MODEL_LABEL} • Entity: ${SYNTHETIC_SEMANTIC_ENTITY_LABEL}`,
  authoredRuntimeSemanticTitle: "Semantic Binding",
  authoredRuntimeModelChip: `Model ${SYNTHETIC_SEMANTIC_MODEL_LABEL}`,
  authoredRuntimeEntityChip: `Entity ${SYNTHETIC_SEMANTIC_ENTITY_LABEL}`,
  authoredRuntimeScopeTitle: "Filters",
  authoredRuntimeScopeValue: "Date Range",
  workspaceMode: "preview",
  ...(() => {
    const container = buildSyntheticSemanticContainer(buildWindowContentJSON("forecastingCubeBuilder", "forecasting_report_builder.yaml"));
    const seeded = buildHostedChartExpectationState(container);
    return {
      ...seeded,
      ...buildHostedHeaderExpectationState(container, seeded.seededBuilderState, seeded.seededCollection),
    };
  })(),
});

console.log("report-builder-hosted-steward-render-smoke ✓ hosted Steward builders render through Forge ReportBuilder, semantic binding is visible in the real builder shell, and the authored runtime semantic section renders for the hosted metrics and forecasting builders");
