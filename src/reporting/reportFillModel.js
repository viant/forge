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
import { formatDashboardValue } from "../components/dashboard/dashboardUtils.js";
import { resolveReportBuilderScopeParamFilters } from "../components/dashboard/reportBuilderPredicates.js";
import { resolveScopeParamId } from "./scopeStateModel.js";
import { resolveKey } from "../utils/selector.js";
import equal from "fast-deep-equal";

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

function resolveDisplayValueMapValue(value = undefined, displayValueMap = null) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (!displayValueMap || typeof displayValueMap !== "object" || Array.isArray(displayValueMap)) {
    return undefined;
  }
  const key = String(value);
  return Object.prototype.hasOwnProperty.call(displayValueMap, key)
    ? displayValueMap[key]
    : undefined;
}

function resolveReportFillFieldDisplayValue(row = null, {
  sourceField = "",
  displayKey = "",
  displayValueMap = null,
} = {}) {
  const normalizedSourceField = normalizeString(sourceField);
  const normalizedDisplayKey = normalizeString(displayKey);
  if (!row || typeof row !== "object" || Array.isArray(row) || !normalizedSourceField) {
    return null;
  }
  const rawValue = row[normalizedSourceField] ?? null;
  if (normalizedDisplayKey && normalizedDisplayKey !== normalizedSourceField) {
    const displayValue = resolveKey(row, normalizedDisplayKey);
    if (displayValue !== undefined && displayValue !== null && displayValue !== "") {
      return displayValue;
    }
  }
  const mappedDisplayValue = resolveDisplayValueMapValue(rawValue, displayValueMap);
  if (mappedDisplayValue !== undefined && mappedDisplayValue !== null && mappedDisplayValue !== "") {
    return mappedDisplayValue;
  }
  return rawValue;
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
    ...(normalizeString(block?.tone) ? { tone: normalizeString(block.tone) } : {}),
    valueField,
    valueLabel: normalizeString(block?.valueLabel || valueField || "Value"),
    value: valueField && firstRow ? firstRow[valueField] ?? null : null,
    rowCount: Number(dataset?.provenance?.rowCount || 0),
    ...(secondaryField
      ? {
        secondaryField,
        secondaryLabel: normalizeString(block?.secondaryLabel || secondaryField),
        secondaryValue: firstRow
          ? resolveReportFillFieldDisplayValue(firstRow, {
            sourceField: secondaryField,
            displayKey: block?.secondaryDisplayKey,
            displayValueMap: block?.secondaryDisplayValueMap,
          })
          : null,
      }
      : {}),
    ...(normalizeString(block?.emptyLabel)
      ? { emptyLabel: normalizeString(block.emptyLabel) }
      : {}),
  };
}

function buildReportFillBadgesContent(block = {}, dataset = {}) {
  const rows = Array.isArray(dataset?.rows) ? dataset.rows : [];
  const firstRow = rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0]) ? rows[0] : null;
  const items = (Array.isArray(block?.items) ? block.items : [])
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const label = normalizeString(item?.label);
      const valueField = normalizeString(item?.valueField);
      const resolvedValue = valueField && firstRow ? firstRow[valueField] ?? null : null;
      const format = normalizeString(item?.format);
      const rawValue = resolvedValue ?? item?.value;
      const value = normalizeString(rawValue);
      const rules = Array.isArray(item?.rules) ? item.rules : [];
      const matchedRule = rules.find((rule) => equal(rule?.value, rawValue)) || null;
      const tone = normalizeString(matchedRule?.tone || item?.tone);
      if (!label && !value && !valueField) {
        return null;
      }
      const fieldDisplayValue = valueField && firstRow
        ? resolveReportFillFieldDisplayValue(firstRow, {
          sourceField: valueField,
          displayKey: item?.displayKey,
          displayValueMap: item?.displayValueMap,
        })
        : null;
      const preferredFieldDisplayValue = (
        valueField
        && (normalizeString(item?.displayKey) || (item?.displayValueMap && typeof item.displayValueMap === "object" && !Array.isArray(item.displayValueMap)))
      )
        ? fieldDisplayValue
        : null;
      const displayValue = normalizeString(
        matchedRule?.label
        || preferredFieldDisplayValue
        || (
          format
          && rawValue !== undefined
          && rawValue !== null
          && String(rawValue) !== ""
            ? formatDashboardValue(rawValue, format)
            : rawValue
        ),
      );
      return {
        id: normalizeString(item?.id || label || value),
        ...(label ? { label } : {}),
        ...(rawValue !== undefined && rawValue !== null && String(rawValue) !== "" ? { value: cloneValue(rawValue) } : {}),
        ...(format ? { format } : {}),
        ...(displayValue ? { displayValue } : {}),
        ...(valueField ? { valueField } : {}),
        ...(tone ? { tone } : {}),
      };
    })
    .filter(Boolean);
  return {
    title: normalizeString(block?.title || "Status Pills"),
    rowCount: Number(dataset?.provenance?.rowCount || 0),
    items,
  };
}

function buildReportFillBlocks(reportSpec = {}, datasetsById = new Map()) {
  const reportBuilderBlock = (Array.isArray(reportSpec?.blocks) ? reportSpec.blocks : [])
    .find((entry) => normalizeString(entry?.kind) === "reportBuilderBlock") || null;
  const reportBuilderConfig = reportBuilderBlock?.config && typeof reportBuilderBlock.config === "object" && !Array.isArray(reportBuilderBlock.config)
    ? reportBuilderBlock.config
    : {};
  const scopeFilterIndex = new Map(
    resolveReportBuilderScopeParamFilters(reportBuilderConfig)
      .map((filter) => [resolveScopeParamId(filter), filter])
      .filter(([id]) => !!id),
  );
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
    if (normalizeString(block?.kind) === "badgesBlock") {
      return {
        ...normalizedBlock,
        content: buildReportFillBadgesContent(block, dataset),
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
            .map((paramId) => {
              const scopeParam = (Array.isArray(reportSpec?.scope?.params) ? reportSpec.scope.params : [])
                .find((entry) => normalizeString(entry?.id) === paramId);
              const scopeFilter = scopeFilterIndex.get(paramId) || null;
              return {
                id: paramId,
                ...(normalizeString(scopeParam?.label || scopeFilter?.label || paramId) ? { label: normalizeString(scopeParam?.label || scopeFilter?.label || paramId) } : {}),
                ...(normalizeString(scopeParam?.kind || scopeFilter?.type) ? { type: normalizeString(scopeParam?.kind || scopeFilter?.type) } : {}),
                ...(normalizeString(scopeParam?.datasetRef) ? { datasetRef: normalizeString(scopeParam.datasetRef) } : {}),
                ...((scopeParam?.multiple === true || scopeFilter?.multiple === true) ? { multiple: true } : {}),
                ...(normalizeString(scopeParam?.presentation || scopeFilter?.presentation) ? { presentation: normalizeString(scopeParam?.presentation || scopeFilter?.presentation) } : {}),
                ...((scopeParam?.required === true || scopeFilter?.required === true) ? { required: true } : {}),
                ...(Array.isArray(scopeParam?.options) ? { options: cloneValue(scopeParam.options) } : (Array.isArray(scopeFilter?.options) ? { options: cloneValue(scopeFilter.options) } : {})),
                ...(normalizeString(scopeParam?.description) ? { description: normalizeString(scopeParam.description) } : {}),
                value: cloneValue(scopeParam?.value),
              };
            }),
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
