import { adaptDashboardToReportDocument } from "./dashboardReportAdapter.js";
import {
  buildReportBuilderReportDocument,
  lowerReportDocumentToReportSpec,
  normalizeReportBuilderDocumentBlocks,
} from "./reportDocumentModel.js";
import { buildReportFillFromReportSpec } from "./reportFillModel.js";
import { buildReportPrintFromReportFill } from "./reportPrintModel.js";
import { autoType, csvParse } from "d3-dsv";
import {
  applyReportBuilderStaticDatasetFieldHints,
  buildReportBuilderStaticDatasetPayloadMap,
  normalizeReportBuilderStaticDatasets,
} from "../components/dashboard/reportBuilderStaticDatasets.js";

const INLINE_REPORT_GRAMMARS = new Set(["dashboard-v1", "report-document-v1"]);

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeId(value = "") {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeInlinePayloadRows(source = {}) {
  if (Array.isArray(source?.rows)) return cloneValue(source.rows);
  let payload = source?.payload ?? source?.data;
  const format = normalizeString(source?.format || "json").toLowerCase() || "json";
  if (typeof payload === "string") {
    if (format === "csv") {
      return csvParse(payload, autoType).map((row) => cloneValue(row));
    }
    try {
      payload = JSON.parse(payload);
    } catch (error) {
      throw new Error(`Inline dataset '${normalizeString(source?.id) || "unknown"}' does not contain valid JSON.`);
    }
  }
  if (Array.isArray(payload)) return cloneValue(payload);
  if (isPlainObject(payload)) return [cloneValue(payload)];
  return [];
}

export function normalizeInlineReportAssemblyDataSources(dataSources = {}) {
  return Object.fromEntries(Object.entries(isPlainObject(dataSources) ? dataSources : {}).map(([id, source]) => {
    if (!isPlainObject(source)) {
      throw new Error(`Inline dataset '${id}' must be an object.`);
    }
    return [id, {
      ...cloneValue(source),
      id: normalizeString(source.id || id),
      rows: normalizeInlinePayloadRows({ ...source, id: source.id || id }),
    }];
  }));
}

function humanize(value = "") {
  const normalized = normalizeString(value);
  if (!normalized) return "";
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function normalizeSourceDeclarations(source = {}) {
  const result = [];
  const append = (value, fallbackId = "") => {
    if (!isPlainObject(value)) return;
    const id = normalizeString(value.id || fallbackId);
    if (!id) return;
    result.push({ ...cloneValue(value), id });
  };
  [source?.datasets, source?.dataSources].forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => append(entry));
      return;
    }
    if (isPlainObject(value)) {
      Object.entries(value).forEach(([id, entry]) => append(entry, id));
    }
  });
  const seen = new Set();
  return result.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

function normalizeInlineStaticDatasets(dataSources = {}, fieldHints = {}) {
  const seeds = Object.entries(isPlainObject(dataSources) ? dataSources : {}).map(([id, source]) => {
    if (!isPlainObject(source) || !Array.isArray(source.rows)) return null;
    return {
      id: normalizeString(source.id || id),
      label: normalizeString(source.label || humanize(source.id || id)),
      description: normalizeString(source.description),
      dataSourceRef: normalizeString(source.dataSourceRef),
      sourceFormat: normalizeString(source.format || "json") || "json",
      rows: cloneValue(source.rows),
      columns: Array.isArray(source.columns) ? cloneValue(source.columns) : undefined,
    };
  }).filter(Boolean);
  const normalized = applyReportBuilderStaticDatasetFieldHints(
    normalizeReportBuilderStaticDatasets(seeds),
    fieldHints,
  );
  seeds.forEach((seed, index) => {
    if (normalizeString(seed.id) !== normalizeString(normalized[index]?.id)) {
      throw new Error(`Inline static dataset id '${seed.id}' must use canonical lowercase letters, numbers, and underscores (for example '${normalized[index]?.id || sanitizeId(seed.id)}').`);
    }
  });
  return normalized;
}

function normalizePublishedDataset(declaration = {}) {
  const id = normalizeString(declaration?.id);
  const dataSourceRef = normalizeString(declaration?.dataSourceRef || declaration?.sourceRef || id);
  if (!id || !dataSourceRef) return null;
  return {
    id,
    dataSourceRef,
    label: normalizeString(declaration?.label || humanize(id)) || id,
    ...(normalizeString(declaration?.description) ? { description: normalizeString(declaration.description) } : {}),
    ...(isPlainObject(declaration?.request) ? { request: cloneValue(declaration.request) } : {}),
    ...(isPlainObject(declaration?.source) ? { source: cloneValue(declaration.source) } : {}),
    ...(isPlainObject(declaration?.scope) ? { scope: cloneValue(declaration.scope) } : {}),
    ...(isPlainObject(declaration?.resultContract) ? { resultContract: cloneValue(declaration.resultContract) } : {}),
    ...(isPlainObject(declaration?.capabilities) ? { capabilities: cloneValue(declaration.capabilities) } : {}),
    ...(Array.isArray(declaration?.dimensions) ? { dimensions: cloneValue(declaration.dimensions) } : {}),
    ...(Array.isArray(declaration?.measures) ? { measures: cloneValue(declaration.measures) } : {}),
  };
}

function buildWorkspaceDatasetRequests(declarations = [], staticIds = new Set()) {
  return declarations
    .filter((entry) => normalizeString(entry?.kind).toLowerCase() === "workspaceref")
    .filter((entry) => !staticIds.has(normalizeString(entry?.id)))
    .map((entry) => ({
      id: normalizeString(entry.id),
      dataSourceRef: normalizeString(entry.dataSourceRef || entry.sourceRef || entry.id),
      request: isPlainObject(entry.request) ? cloneValue(entry.request) : {},
      ...(isPlainObject(entry.source) ? { source: cloneValue(entry.source) } : {}),
      ...(isPlainObject(entry.capabilities) ? { capabilities: cloneValue(entry.capabilities) } : {}),
    }));
}

function buildInlinePromotionState(staticDatasets = [], workspaceDatasetRequests = []) {
  const materializedDatasetIds = staticDatasets
    .map((entry) => normalizeString(entry?.id))
    .filter(Boolean);
  const reusableDataSourceRefs = Array.from(new Set(
    workspaceDatasetRequests
      .map((entry) => normalizeString(entry?.dataSourceRef))
      .filter(Boolean),
  ));
  return {
    eligible: materializedDatasetIds.length === 0,
    reusableDataSourceRefs,
    materializedDatasetIds,
    reason: materializedDatasetIds.length > 0
      ? "Materialized inline datasets must be mapped to registered workspace data sources before this report can be saved."
      : "",
  };
}

function buildInlineDocument({
  reportId,
  grammar,
  source,
  staticDatasets,
  declarations,
  dashboardAdapter = null,
  builderTarget = null,
}) {
  const staticIds = new Set(staticDatasets.map((entry) => normalizeString(entry.id)));
  let authoredBlocks;
  let layout;
  let adapter = null;
  if (grammar === "dashboard-v1") {
    adapter = dashboardAdapter || adaptDashboardToReportDocument(source, { fileName: `${reportId}.json` });
    authoredBlocks = adapter.blocks;
    layout = adapter.layout;
  } else {
    authoredBlocks = normalizeReportBuilderDocumentBlocks(source?.blocks);
    if (authoredBlocks.length !== (Array.isArray(source?.blocks) ? source.blocks.length : 0)) {
      throw new Error("The inline report contains invalid canonical report blocks.");
    }
    layout = isPlainObject(source?.layout) ? cloneValue(source.layout) : {
      type: "grid",
      columns: 12,
      items: authoredBlocks.map((block) => ({ blockId: block.id })),
    };
  }

  const declarationById = new Map(declarations.map((entry) => [normalizeString(entry.id), entry]));
  const adapterDeclarations = Array.isArray(adapter?.dataSources) ? adapter.dataSources : [];
  const publishedDatasets = [...declarations, ...adapterDeclarations]
    .filter((entry) => !staticIds.has(normalizeString(entry?.id)))
    .filter((entry, index, values) => values.findIndex((candidate) => normalizeString(candidate?.id) === normalizeString(entry?.id)) === index)
    .map((entry) => normalizePublishedDataset({
      ...entry,
      ...(declarationById.get(normalizeString(entry?.id)) || {}),
    }))
    .filter(Boolean);
  const primarySource = publishedDatasets[0]?.dataSourceRef || staticDatasets[0]?.dataSourceRef || reportId;
  const title = normalizeString(source?.title || adapter?.title || humanize(reportId) || "Inline report") || "Inline report";
  const state = {
    reportDocumentTitle: title,
    reportDocumentSubtitle: normalizeString(source?.subtitle || adapter?.subtitle),
    reportDocumentDescription: normalizeString(source?.description || adapter?.description),
    reportDocumentThemeAccent: normalizeString(source?.theme?.accentTone),
    reportDocumentBadgePalette: normalizeString(source?.theme?.badgePalette),
    reportDocumentBlocks: authoredBlocks,
    reportDocumentLayout: layout,
    reportStaticDatasets: staticDatasets,
    ...(adapter ? {
      reportDashboardAdapter: {
        source: cloneValue(adapter.source),
        dataSourceRefs: cloneValue(adapter.dataSourceRefs),
        dataSources: cloneValue(adapter.dataSources),
        filterDefinitions: cloneValue(adapter.filterDefinitions),
        interactionBindings: cloneValue(adapter.interactionBindings),
        diagnostics: cloneValue(adapter.diagnostics),
      },
    } : {}),
  };
  const config = {
    title,
    dataSources: publishedDatasets,
    staticFilters: cloneValue(adapter?.filterDefinitions || source?.filters || []),
    result: { defaultMode: "table", chartCreationMode: "explicit", resultPanePosition: "left" },
  };
  const reportDocument = buildReportBuilderReportDocument({
      container: { id: reportId, stateKey: reportId, title, dataSourceRef: primarySource },
      config,
      state,
      refinements: Array.isArray(source?.refinements) ? source.refinements : [],
      semanticSummary: isPlainObject(source?.semanticSummary) ? source.semanticSummary : null,
    });
  if (builderTarget) {
    const builderBlock = reportDocument.blocks.find((block) => block?.kind === "reportBuilderBlock");
    if (builderBlock) {
      builderBlock.source = {
        kind: "dashboard.reportBuilder",
        containerId: normalizeString(builderTarget?.containerId),
        stateKey: normalizeString(builderTarget?.stateKey),
        dataSourceRef: normalizeString(builderTarget?.dataSourceRef),
      };
    }
  }
  return {
    reportDocument,
    diagnostics: cloneValue(adapter?.diagnostics || []),
  };
}

function rebuildInlineRuntime(compiled, datasetPayloads) {
  const reportFill = buildReportFillFromReportSpec(compiled.reportSpec, datasetPayloads);
  const reportPrint = buildReportPrintFromReportFill({ reportSpec: compiled.reportSpec, reportFill });
  if (!reportPrint) {
    throw new Error("The inline report could not produce a print-ready artifact.");
  }
  return {
    ...compiled,
    datasetPayloads: cloneValue(datasetPayloads),
    reportFill,
    reportPrint,
  };
}

export function compileInlineReport({
  reportId = "inlineReport",
  grammar = "dashboard-v1",
  source = {},
  dataSources = {},
  builderTarget = null,
} = {}) {
  if (!isPlainObject(source)) {
    throw new Error("Inline report source must be a JSON object.");
  }
  const normalizedGrammar = normalizeString(grammar || "dashboard-v1").toLowerCase() || "dashboard-v1";
  if (!INLINE_REPORT_GRAMMARS.has(normalizedGrammar)) {
    throw new Error(`Unsupported inline report grammar '${normalizedGrammar}'.`);
  }
  const normalizedReportId = sanitizeId(reportId) || "inline_report";
  const declarations = normalizeSourceDeclarations(source);
  const dashboardAdapter = normalizedGrammar === "dashboard-v1"
    ? adaptDashboardToReportDocument(source, { fileName: `${normalizedReportId}.json` })
    : null;
  const adapterHints = dashboardAdapter?.datasetFieldHints || {};
  const staticDatasets = normalizeInlineStaticDatasets(dataSources, adapterHints);
  const { reportDocument, diagnostics } = buildInlineDocument({
    reportId: normalizedReportId,
    grammar: normalizedGrammar,
    source,
    staticDatasets,
    declarations,
    dashboardAdapter,
    builderTarget,
  });
  const reportSpec = lowerReportDocumentToReportSpec(reportDocument, { includePrimaryBlocks: false });
  const staticPayloads = buildReportBuilderStaticDatasetPayloadMap(staticDatasets);
  const workspaceDatasetRequests = buildWorkspaceDatasetRequests(
    declarations,
    new Set(staticDatasets.map((entry) => normalizeString(entry.id))),
  );
  const promotion = buildInlinePromotionState(staticDatasets, workspaceDatasetRequests);
  return rebuildInlineRuntime({
    grammar: normalizedGrammar,
    reportDocument,
    reportSpec,
    diagnostics,
    workspaceDatasetRequests,
    promotion,
  }, staticPayloads);
}

export function compileInlineReportDefinition(definition = null, {
  fallbackReportId = "inlineReport",
  builderTarget = null,
} = {}) {
  if (!isPlainObject(definition)) {
    throw new Error("An inline report definition is required.");
  }
  const status = normalizeString(definition.status).toLowerCase();
  if (status && !["committed", "ready"].includes(status)) {
    throw new Error(`Inline report '${normalizeString(definition.id) || fallbackReportId}' is ${status} and cannot be opened in the builder.`);
  }
  const source = isPlainObject(definition.source) ? definition.source : definition;
  const reportId = normalizeString(
    definition.reportId
    || [definition.scope, definition.id].map((entry) => normalizeString(entry)).filter(Boolean).join(":")
    || source.id
    || fallbackReportId,
  ) || fallbackReportId;
  return compileInlineReport({
    reportId,
    grammar: normalizeString(definition.grammar || source.grammar || "dashboard-v1") || "dashboard-v1",
    source,
    dataSources: normalizeInlineReportAssemblyDataSources(definition.dataSources || source.dataSources || {}),
    builderTarget,
  });
}

function normalizeFetchedDatasetPayload(value) {
  if (Array.isArray(value)) return { rows: cloneValue(value), hasMore: false, diagnostics: [] };
  if (!isPlainObject(value)) return { rows: [], hasMore: false, diagnostics: [] };
  const rows = Array.isArray(value.rows)
    ? value.rows
    : (Array.isArray(value.data) ? value.data : (Array.isArray(value.items) ? value.items : []));
  return {
    rows: cloneValue(rows),
    hasMore: value.hasMore === true,
    diagnostics: Array.isArray(value.diagnostics) ? cloneValue(value.diagnostics) : [],
  };
}

export async function materializeInlineReport(compiled = null, { fetchDataset } = {}) {
  if (!isPlainObject(compiled) || !isPlainObject(compiled.reportSpec)) {
    throw new Error("A compiled inline report is required.");
  }
  const requests = Array.isArray(compiled.workspaceDatasetRequests) ? compiled.workspaceDatasetRequests : [];
  if (requests.length === 0) return compiled;
  if (typeof fetchDataset !== "function") {
    throw new Error("Inline report workspace datasets require a host fetchDataset callback.");
  }
  const resolved = await Promise.all(requests.map(async (request) => {
    const value = await fetchDataset(cloneValue(request));
    return [request.id, normalizeFetchedDatasetPayload(value)];
  }));
  return rebuildInlineRuntime(compiled, {
    ...(isPlainObject(compiled.datasetPayloads) ? cloneValue(compiled.datasetPayloads) : {}),
    ...Object.fromEntries(resolved),
  });
}
