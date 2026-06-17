import { buildReportBuilderReportSpec } from "./reportSpecModel.js";
import {
  normalizeRefinementBarActionKinds,
  normalizeRefinementBarText,
} from "./refinementBarModel.js";
import {
  applyReportCalculatedFields,
  cloneReportCalculatedFields,
} from "./calculatedFieldModel.js";
import { buildReportFillChartPayload } from "./reportFillChartPayload.js";
import { buildReportFillGeoPayload } from "./reportFillGeoPayload.js";
import { buildReportFillTableRows } from "./reportFillTablePayload.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function hashString(value = "") {
  let hash = 2166136261;
  const input = String(value || "");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildReportSpecHash(reportSpec = {}) {
  return hashString(JSON.stringify(reportSpec || {}));
}

export function buildReportFillHash(reportFill = {}) {
  return hashString(JSON.stringify(reportFill || {}));
}

function buildReportFillDataset(dataset = {}, payload = {}, calculatedFields = []) {
  const rawRows = Array.isArray(payload?.rows) ? payload.rows.map((row) => cloneValue(row)) : [];
  const rows = applyReportCalculatedFields(rawRows, calculatedFields, {
    datasetRef: normalizeString(dataset?.id),
  });
  const diagnostics = Array.isArray(payload?.diagnostics) ? payload.diagnostics.map((entry) => cloneValue(entry)) : [];
  const request = cloneValue(dataset?.request || {});
  return {
    id: normalizeString(dataset?.id),
    dataSourceRef: normalizeString(dataset?.dataSourceRef),
    request,
    provenance: {
      requestHash: hashString(JSON.stringify(request)),
      rowCount: rows.length,
      truncated: !!payload?.hasMore,
      hasMore: !!payload?.hasMore,
      diagnostics,
    },
    rows,
  };
}

function buildReportFillKpiContent(block = {}, dataset = {}) {
  const rows = Array.isArray(dataset?.rows) ? dataset.rows : [];
  const firstRow = rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0]) ? rows[0] : null;
  const valueField = normalizeString(block?.valueField);
  const secondaryField = normalizeString(block?.secondaryField);
  return {
    title: normalizeString(block?.title || "KPI"),
    ...(normalizeString(block?.description)
      ? { description: normalizeString(block.description) }
      : {}),
    valueField,
    valueLabel: normalizeString(block?.valueLabel || valueField || "Value"),
    value: valueField && firstRow ? firstRow[valueField] ?? null : null,
    rowCount: Number(dataset?.provenance?.rowCount || 0),
    ...(secondaryField
      ? {
        secondaryField,
        secondaryLabel: normalizeString(block?.secondaryLabel || secondaryField),
        secondaryValue: firstRow ? firstRow[secondaryField] ?? null : null,
      }
      : {}),
    ...(normalizeString(block?.emptyLabel)
      ? { emptyLabel: normalizeString(block.emptyLabel) }
      : {}),
  };
}

function buildReportFillBlocks(reportSpec = {}, datasetsById = new Map()) {
  return (Array.isArray(reportSpec?.blocks) ? reportSpec.blocks : []).map((block) => {
    const normalizedBlock = cloneValue(block);
    const dataset = datasetsById.get(normalizeString(block?.datasetRef)) || null;
    if (normalizeString(block?.kind) === "tableBlock") {
      const columns = cloneValue(block?.columns || []);
      return {
        ...normalizedBlock,
        content: {
          columns,
          rowCount: Number(dataset?.provenance?.rowCount || 0),
          resolvedRows: buildReportFillTableRows(columns, dataset?.rows || []),
        },
      };
    }
    if (normalizeString(block?.kind) === "chartBlock") {
      const chartSpec = cloneValue(block?.chartSpec || null);
      const chartModel = cloneValue(block?.chartModel || null);
      return {
        ...normalizedBlock,
        content: {
          chartSpec,
          chartModel,
          rowCount: Number(dataset?.provenance?.rowCount || 0),
          resolvedChart: buildReportFillChartPayload(chartModel, dataset?.rows || []),
        },
      };
    }
    if (normalizeString(block?.kind) === "geoMapBlock") {
      return {
        ...normalizedBlock,
        content: {
          geo: cloneValue(block?.geo || {}),
          rowCount: Number(dataset?.provenance?.rowCount || 0),
          resolvedGeo: buildReportFillGeoPayload(block, dataset?.rows || []),
        },
      };
    }
    if (normalizeString(block?.kind) === "kpiBlock") {
      return {
        ...normalizedBlock,
        content: buildReportFillKpiContent(block, dataset),
      };
    }
    if (normalizeString(block?.kind) === "markdownBlock") {
      return {
        ...normalizedBlock,
        content: {
          title: normalizeString(block?.title),
          markdown: String(block?.markdown || ""),
        },
      };
    }
    if (normalizeString(block?.kind) === "filterBarBlock") {
      return {
        ...normalizedBlock,
        content: {
          title: normalizeString(block?.title || "Filters"),
          params: (Array.isArray(block?.paramIds) ? block.paramIds : [])
            .map((paramId) => normalizeString(paramId))
            .filter(Boolean)
            .map((paramId) => ({
              id: paramId,
              value: cloneValue(reportSpec?.scope?.params?.find((entry) => normalizeString(entry?.id) === paramId)?.value),
            })),
        },
      };
    }
    if (normalizeString(block?.kind) === "refinementBarBlock") {
      const content = {
        refinements: cloneValue(reportSpec?.refinements || []),
      };
      if (block?.title != null) {
        content.title = normalizeRefinementBarText(block?.title);
      }
      const actionKinds = normalizeRefinementBarActionKinds(block?.actionKinds);
      if (actionKinds != null) {
        content.actionKinds = actionKinds;
      }
      if (block?.emptyLabel != null) {
        content.emptyLabel = normalizeRefinementBarText(block?.emptyLabel);
      }
      return {
        ...normalizedBlock,
        content,
      };
    }
    return normalizedBlock;
  });
}

export function buildReportFillFromReportSpec(reportSpec = {}, datasetPayloads = {}) {
  const normalizedReportSpec = cloneValue(reportSpec || {});
  const calculatedFields = cloneReportCalculatedFields(normalizedReportSpec?.calculatedFields || []);
  const datasets = (Array.isArray(normalizedReportSpec?.datasets) ? normalizedReportSpec.datasets : []).map((dataset) => (
    buildReportFillDataset(dataset, datasetPayloads?.[normalizeString(dataset?.id)] || {}, calculatedFields)
  ));
  const datasetsById = new Map(datasets.map((dataset) => [dataset.id, dataset]));
  return {
    version: 1,
    kind: "reportFill",
    specVersion: Number(normalizedReportSpec?.version || 0) || 1,
    specHash: buildReportSpecHash(normalizedReportSpec),
    source: cloneValue(normalizedReportSpec?.source || {}),
    parameters: cloneValue(normalizedReportSpec?.parameters || {}),
    refinements: cloneValue(normalizedReportSpec?.refinements || []),
    calculatedFields,
    datasets,
    blocks: buildReportFillBlocks(normalizedReportSpec, datasetsById),
    diagnostics: datasets.flatMap((dataset) => dataset?.provenance?.diagnostics || []),
  };
}

export function buildReportBuilderReportFill({
  container = {},
  config = {},
  state = {},
  primaryRows = [],
  primaryHasMore = false,
  primaryDiagnostics = [],
} = {}) {
  const reportSpec = buildReportBuilderReportSpec({
    container,
    config,
    state,
  });
  return buildReportFillFromReportSpec(reportSpec, {
    primary: {
      rows: primaryRows,
      hasMore: primaryHasMore,
      diagnostics: primaryDiagnostics,
    },
  });
}
