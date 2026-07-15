import {
  buildReportBuilderReportSpec,
  normalizeReportSpecScopeParams,
} from "./reportSpecModel.js";
import {
  buildReportBuilderReportDocument,
  lowerReportDocumentToReportSpec,
} from "./reportDocumentModel.js";
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
import {
  normalizeReportDatasetCapabilities,
  normalizeReportDatasetSource,
} from "./reportDatasetSourceModel.js";
import { normalizeReportDatasetScope } from "./reportDatasetScopeModel.js";
import { formatDashboardValue } from "../components/dashboard/dashboardUtils.js";
import { resolveKey } from "../utils/selector.js";
import equal from "fast-deep-equal";
import { resolveReportDatasetRefResolution } from "./reportDatasetRefModel.js";

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

function stableCloneForHash(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stableCloneForHash(entry));
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableCloneForHash(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function stableJSONStringify(value = null) {
  return JSON.stringify(stableCloneForHash(value));
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
    ...(normalizeReportDatasetScope(dataset?.scope)
      ? { scope: normalizeReportDatasetScope(dataset.scope) }
      : {}),
    ...(normalizeReportDatasetSource(dataset?.source)
      ? { source: normalizeReportDatasetSource(dataset?.source) }
      : {}),
    ...(dataset?.resultContract && typeof dataset.resultContract === "object" && !Array.isArray(dataset.resultContract)
      ? { resultContract: cloneValue(dataset.resultContract) }
      : {}),
    ...(normalizeReportDatasetCapabilities(dataset?.capabilities)
      ? { capabilities: normalizeReportDatasetCapabilities(dataset?.capabilities) }
      : {}),
    request,
    provenance: {
      requestHash: hashString(stableJSONStringify(request)),
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

function normalizeReportFillKpiPresentationMode(value = "") {
  const normalized = normalizeString(value).toLowerCase();
  return ["card", "body", "both"].includes(normalized) ? normalized : "card";
}

function normalizeReportFillBodyFormat(value = "") {
  return normalizeString(value).toLowerCase() === "markdown" ? "markdown" : "markdown";
}

function formatReportFillKpiMacroValue(value = null, format = "") {
  if (value === undefined || value === null || value === "") {
    return "—";
  }
  if (Array.isArray(value)) {
    return value.map((entry) => formatReportFillKpiMacroValue(entry, format)).join(", ");
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return normalizeString(format) ? formatDashboardValue(value, format) : String(value);
}

function resolveReportFillDatasetLabel(dataset = null, fallbackRef = "") {
  const normalizedFallbackRef = normalizeString(fallbackRef);
  const dataSourceRef = normalizeString(dataset?.dataSourceRef);
  const id = normalizeString(dataset?.id);
  return dataSourceRef || id || normalizedFallbackRef;
}

function buildReportFillDatasetFriendlyAlias(value = "") {
  const normalized = normalizeString(value);
  if (!normalized) {
    return "";
  }
  return normalized
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join("");
}

function buildReportFillDatasetAliasMap(datasetsById = new Map()) {
  const result = new Map();
  if (!(datasetsById instanceof Map)) {
    return result;
  }
  datasetsById.forEach((dataset, datasetId) => {
    const aliases = [
      normalizeString(datasetId),
      normalizeString(dataset?.id),
      normalizeString(dataset?.dataSourceRef),
      buildReportFillDatasetFriendlyAlias(datasetId),
      buildReportFillDatasetFriendlyAlias(dataset?.id),
      buildReportFillDatasetFriendlyAlias(dataset?.dataSourceRef),
    ].filter(Boolean);
    aliases.forEach((alias) => {
      const candidates = [alias, normalizeString(alias).toLowerCase()].filter(Boolean);
      candidates.forEach((candidate) => {
        if (!result.has(candidate)) {
          result.set(candidate, dataset);
        }
      });
    });
  });
  return result;
}

function resolveReportFillAliasedDataset(datasetsByAlias = new Map(), alias = "") {
  if (!(datasetsByAlias instanceof Map)) {
    return null;
  }
  const normalizedAlias = normalizeString(alias);
  if (!normalizedAlias) {
    return null;
  }
  return datasetsByAlias.get(normalizedAlias)
    || datasetsByAlias.get(normalizedAlias.toLowerCase())
    || null;
}

function resolveReportFillMacroFormat(value = "") {
  const normalized = normalizeString(value).toLowerCase();
  switch (normalized) {
    case "compact":
    case "compactnumber":
      return "compactNumber";
    case "currency":
      return "currency";
    case "percent":
      return "percent";
    case "percentfraction":
      return "percentFraction";
    case "number":
      return "number";
    default:
      return normalizeString(value);
  }
}

function resolveReportFillSelectedRow(dataset = {}, rowSelector = "", {
  valueField = "",
} = {}) {
  const rows = Array.isArray(dataset?.rows) ? dataset.rows : [];
  const normalizedRowSelector = normalizeString(rowSelector).toLowerCase() || "firstrow";
  if (rows.length === 0) {
    return null;
  }
  if (normalizedRowSelector === "firstrow") {
    return rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0]) ? rows[0] : null;
  }
  const normalizedValueField = normalizeString(valueField);
  if (!normalizedValueField) {
    return rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0]) ? rows[0] : null;
  }
  const comparableRows = rows.filter((row) => row && typeof row === "object" && !Array.isArray(row) && Number.isFinite(Number(row?.[normalizedValueField])));
  if (comparableRows.length === 0) {
    return rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0]) ? rows[0] : null;
  }
  const reducer = normalizedRowSelector === "minbyvalue"
    ? ((best, row) => (Number(row?.[normalizedValueField]) < Number(best?.[normalizedValueField]) ? row : best))
    : ((best, row) => (Number(row?.[normalizedValueField]) > Number(best?.[normalizedValueField]) ? row : best));
  return comparableRows.slice(1).reduce(reducer, comparableRows[0]);
}

function resolveReportFillTemplateRawValue(token = "", {
  content = {},
  row = null,
  dataset = null,
  datasetRef = "primary",
  datasetsByAlias = new Map(),
} = {}) {
  const normalizedToken = normalizeString(token);
  if (normalizedToken === "value") {
    return content?.value;
  }
  if (normalizedToken === "secondaryValue") {
    return content?.secondaryValue;
  }
  if (normalizedToken.startsWith("row.")) {
    return row && typeof row === "object" && !Array.isArray(row)
      ? resolveKey(row, normalizedToken.slice(4))
      : undefined;
  }
  if (normalizedToken === "dataset.id") {
    return normalizeString(dataset?.id || datasetRef);
  }
  if (normalizedToken === "dataset.label") {
    return resolveReportFillDatasetLabel(dataset, datasetRef);
  }
  if (normalizedToken === "dataset.dataSourceRef") {
    return normalizeString(dataset?.dataSourceRef || "");
  }
  const normalizedDatasetRef = normalizeString(datasetRef || "primary") || "primary";
  const datasetRowPrefix = `dataset.${normalizedDatasetRef}.row.`;
  if (normalizedToken.startsWith(datasetRowPrefix)) {
    return row && typeof row === "object" && !Array.isArray(row)
      ? resolveKey(row, normalizedToken.slice(datasetRowPrefix.length))
      : undefined;
  }
  const absoluteRowMatch = normalizedToken.match(/^([A-Za-z0-9_]+)\.row\.(.+)$/);
  if (absoluteRowMatch) {
    const matchedDataset = resolveReportFillAliasedDataset(datasetsByAlias, absoluteRowMatch[1]);
    const matchedRow = resolveReportFillSelectedRow(matchedDataset || {}, "firstrow");
    return matchedRow && typeof matchedRow === "object" && !Array.isArray(matchedRow)
      ? resolveKey(matchedRow, normalizeString(absoluteRowMatch[2]))
      : undefined;
  }
  const absoluteFieldMatch = normalizedToken.match(/^([A-Za-z0-9_]+)\.(.+)$/);
  if (absoluteFieldMatch) {
    const datasetAlias = normalizeString(absoluteFieldMatch[1]);
    const matchedDataset = datasetAlias !== "dataset"
      ? resolveReportFillAliasedDataset(datasetsByAlias, datasetAlias)
      : null;
    if (matchedDataset) {
      const matchedRow = resolveReportFillSelectedRow(matchedDataset || {}, "firstrow");
      return matchedRow && typeof matchedRow === "object" && !Array.isArray(matchedRow)
        ? resolveKey(matchedRow, normalizeString(absoluteFieldMatch[2]))
        : undefined;
    }
  }
  return undefined;
}

function resolveReportFillTemplateToken(token = "", {
  content = {},
  row = null,
  dataset = null,
  datasetRef = "primary",
  datasetsByAlias = new Map(),
} = {}) {
  const normalizedToken = normalizeString(token);
  if (!normalizedToken) {
    return "";
  }
  const formatMatch = normalizedToken.match(/^format\(\s*([^,\s]+)\s*,\s*([^)]+?)\s*\)$/);
  if (formatMatch) {
    const rawValue = resolveReportFillTemplateRawValue(formatMatch[1], {
      content,
      row,
      dataset,
      datasetRef,
      datasetsByAlias,
    });
    return formatReportFillKpiMacroValue(rawValue, resolveReportFillMacroFormat(formatMatch[2]));
  }
  const helperMatch = normalizedToken.match(/^fmt\.(compact|compactNumber|currency|percent|percentFraction|number)\((.+)\)$/i);
  if (helperMatch) {
    const rawValue = resolveReportFillTemplateRawValue(helperMatch[2], {
      content,
      row,
      dataset,
      datasetRef,
      datasetsByAlias,
    });
    return formatReportFillKpiMacroValue(rawValue, resolveReportFillMacroFormat(helperMatch[1]));
  }
  if (normalizedToken === "value") {
    return formatReportFillKpiMacroValue(content?.value, normalizeString(content?.valueFormat || content?.format));
  }
  if (normalizedToken === "secondaryValue") {
    return formatReportFillKpiMacroValue(content?.secondaryValue, normalizeString(content?.secondaryFormat));
  }
  if (normalizedToken === "valueLabel") {
    return normalizeString(content?.valueLabel || content?.valueField || "Value");
  }
  if (normalizedToken === "secondaryLabel") {
    return normalizeString(content?.secondaryLabel || content?.secondaryField);
  }
  if (normalizedToken === "dataset.label") {
    return resolveReportFillDatasetLabel(dataset, datasetRef);
  }
  if (normalizedToken === "dataset.id") {
    return normalizeString(dataset?.id || datasetRef);
  }
  if (normalizedToken === "dataset.dataSourceRef") {
    return normalizeString(dataset?.dataSourceRef || "");
  }
  const resolved = resolveReportFillTemplateRawValue(normalizedToken, {
    content,
    row,
    dataset,
    datasetRef,
    datasetsByAlias,
  });
  return resolved === undefined ? "" : formatReportFillKpiMacroValue(resolved);
}

function resolveReportFillTemplateMarkdown(template = "", context = {}) {
  return String(template || "").replace(/\$\{\s*([^}]+?)\s*\}/g, (_, token) => resolveReportFillTemplateToken(token, context)).trim();
}

function resolveReportFillKpiBodyMarkdown(block = {}, content = {}, row = null, {
  dataset = null,
  datasetsByAlias = new Map(),
} = {}) {
  const presentationMode = normalizeReportFillKpiPresentationMode(block?.presentationMode);
  const bodyTemplate = String(block?.bodyTemplate || "");
  const hasTemplate = !!bodyTemplate.trim();
  if (!hasTemplate && presentationMode === "card") {
    return "";
  }
  const template = hasTemplate
    ? bodyTemplate
    : [
      `**${normalizeString(content?.valueLabel || content?.valueField || "Value")}:** ${formatReportFillKpiMacroValue(content?.value, normalizeString(content?.valueFormat || content?.format))}`,
      ...(content?.secondaryField
        ? [`**${normalizeString(content?.secondaryLabel || content?.secondaryField)}:** ${formatReportFillKpiMacroValue(content?.secondaryValue, normalizeString(content?.secondaryFormat))}`]
        : []),
    ].join("\n");
  return resolveReportFillTemplateMarkdown(template, {
    content,
    row,
    dataset,
    datasetRef: block?.datasetRef,
    datasetsByAlias,
  });
}

function buildReportFillKpiContent(block = {}, dataset = {}, {
  datasetsByAlias = new Map(),
} = {}) {
  const valueField = normalizeString(block?.valueField);
  const secondaryField = normalizeString(block?.secondaryField);
  const presentationMode = normalizeReportFillKpiPresentationMode(block?.presentationMode);
  const bodyFormat = normalizeReportFillBodyFormat(block?.bodyFormat);
  const rowSelector = normalizeString(block?.rowSelector).toLowerCase() || "firstrow";
  const selectedRow = resolveReportFillSelectedRow(dataset, rowSelector, { valueField });
  const content = {
    title: normalizeString(block?.title || "KPI"),
    ...(normalizeString(block?.description)
      ? { description: normalizeString(block.description) }
      : {}),
    ...(normalizeString(block?.tone) ? { tone: normalizeString(block.tone) } : {}),
    valueField,
    valueLabel: normalizeString(block?.valueLabel || valueField || "Value"),
    ...(normalizeString(block?.valueFormat) ? { valueFormat: normalizeString(block.valueFormat) } : {}),
    value: valueField && selectedRow ? selectedRow[valueField] ?? null : null,
    rowCount: Number(dataset?.provenance?.rowCount || 0),
    ...(secondaryField
      ? {
        secondaryField,
        secondaryLabel: normalizeString(block?.secondaryLabel || secondaryField),
        ...(normalizeString(block?.secondaryFormat) ? { secondaryFormat: normalizeString(block.secondaryFormat) } : {}),
        secondaryValue: selectedRow
          ? resolveReportFillFieldDisplayValue(selectedRow, {
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
    ...(rowSelector !== "firstrow" ? { rowSelector } : {}),
    ...(presentationMode !== "card" ? { presentationMode } : {}),
    ...((presentationMode !== "card" || String(block?.bodyTemplate || "").trim()) ? { bodyFormat } : {}),
    ...(String(block?.bodyTemplate || "").trim() ? { bodyTemplate: String(block.bodyTemplate || "") } : {}),
  };
  const bodyMarkdown = resolveReportFillKpiBodyMarkdown(block, content, selectedRow, {
    dataset,
    datasetsByAlias,
  });
  return {
    ...content,
    ...(bodyMarkdown ? { bodyMarkdown } : {}),
  };
}

function buildReportFillCollectionItemContent(block = {}, row = null, rowIndex = 0, dataset = {}, {
  datasetsByAlias = new Map(),
} = {}) {
  const itemTitleField = normalizeString(block?.itemTitleField);
  const valueField = normalizeString(block?.valueField);
  const secondaryField = normalizeString(block?.secondaryField);
  const value = valueField && row ? row[valueField] ?? null : null;
  const secondaryValue = secondaryField && row
    ? resolveReportFillFieldDisplayValue(row, { sourceField: secondaryField })
    : null;
  const content = {
    index: rowIndex,
    title: itemTitleField && row
      ? resolveReportFillFieldDisplayValue(row, { sourceField: itemTitleField })
      : `Item ${rowIndex + 1}`,
    ...(itemTitleField ? { itemTitleField } : {}),
    ...(normalizeString(block?.itemTitleLabel) ? { itemTitleLabel: normalizeString(block.itemTitleLabel) } : {}),
    ...(valueField
      ? {
        valueField,
        valueLabel: normalizeString(block?.valueLabel || valueField || "Value"),
        ...(normalizeString(block?.valueFormat) ? { valueFormat: normalizeString(block.valueFormat) } : {}),
        value,
      }
      : {}),
    ...(secondaryField
      ? {
        secondaryField,
        secondaryLabel: normalizeString(block?.secondaryLabel || secondaryField),
        ...(normalizeString(block?.secondaryFormat) ? { secondaryFormat: normalizeString(block.secondaryFormat) } : {}),
        secondaryValue,
      }
      : {}),
  };
  const bodyMarkdown = String(block?.bodyTemplate || "").trim()
    ? resolveReportFillTemplateMarkdown(String(block.bodyTemplate || ""), {
      content,
      row,
      dataset,
      datasetRef: block?.datasetRef,
      datasetsByAlias,
    })
    : "";
  return {
    ...content,
    ...(bodyMarkdown ? { bodyMarkdown } : {}),
  };
}

function buildReportFillCollectionContent(block = {}, dataset = {}, {
  datasetsByAlias = new Map(),
} = {}) {
  const rows = Array.isArray(dataset?.rows) ? dataset.rows : [];
  const rowLimit = Math.max(1, Math.trunc(Number(block?.rowLimit || 6)) || 6);
  const visibleRows = rows
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .slice(0, rowLimit);
  return {
    title: normalizeString(block?.title || "Collection") || "Collection",
    ...(normalizeString(block?.description) ? { description: normalizeString(block.description) } : {}),
    ...(normalizeString(block?.emptyLabel) ? { emptyLabel: normalizeString(block.emptyLabel) } : {}),
    layout: ["list"].includes(normalizeString(block?.layout).toLowerCase()) ? "list" : "grid",
    columns: (() => {
      const normalized = Math.trunc(Number(block?.columns || 2));
      return Number.isInteger(normalized) && normalized >= 1 && normalized <= 4 ? normalized : 2;
    })(),
    rowCount: Number(dataset?.provenance?.rowCount || rows.length || 0),
    rowLimit,
    items: visibleRows.map((row, index) => buildReportFillCollectionItemContent(block, row, index, dataset, {
      datasetsByAlias,
    })),
  };
}

function buildReportFillSectionContent(block = {}) {
  return {
    title: normalizeString(block?.title || "Section") || "Section",
    ...(normalizeString(block?.subtitle) ? { subtitle: normalizeString(block.subtitle) } : {}),
    ...(normalizeString(block?.description) ? { description: normalizeString(block.description) } : {}),
    navigationLabel: normalizeString(block?.navigationLabel || block?.title || "Section") || "Section",
  };
}

function normalizeReportFillCompositeChildBlockIds(childBlockIds = []) {
  const seen = new Set();
  return (Array.isArray(childBlockIds) ? childBlockIds : [])
    .map((blockId) => normalizeString(blockId))
    .filter((blockId) => {
      if (!blockId || seen.has(blockId)) {
        return false;
      }
      seen.add(blockId);
      return true;
    });
}

function buildReportFillCompositeContent(block = {}) {
  return {
    title: normalizeString(block?.title || "Grouped Panel") || "Grouped Panel",
    ...(normalizeString(block?.description) ? { description: normalizeString(block.description) } : {}),
    childBlockIds: normalizeReportFillCompositeChildBlockIds(block?.childBlockIds),
  };
}

function normalizeReportFillTabGroupSectionIds(sectionIds = []) {
  const seen = new Set();
  return (Array.isArray(sectionIds) ? sectionIds : [])
    .map((sectionId) => normalizeString(sectionId))
    .filter((sectionId) => {
      if (!sectionId || seen.has(sectionId)) {
        return false;
      }
      seen.add(sectionId);
      return true;
    });
}

function buildReportFillTabGroupContent(block = {}, reportSpec = {}) {
  const requestedSectionIds = normalizeReportFillTabGroupSectionIds(block?.sectionIds);
  const availableSections = (Array.isArray(reportSpec?.blocks) ? reportSpec.blocks : [])
    .filter((entry) => normalizeString(entry?.kind) === "sectionBlock")
    .map((section, index) => ({
      id: normalizeString(section?.id || `section_${index + 1}`) || `section_${index + 1}`,
      title: normalizeString(section?.title || `Section ${index + 1}`) || `Section ${index + 1}`,
      navigationLabel: normalizeString(section?.navigationLabel || section?.title || `Section ${index + 1}`) || `Section ${index + 1}`,
    }));
  const sectionById = new Map(availableSections.map((section) => [section.id, section]));
  const orderedTabs = requestedSectionIds
    .map((sectionId) => sectionById.get(sectionId) || null)
    .filter(Boolean);
  const trailingTabs = availableSections.filter((section) => !requestedSectionIds.includes(section.id));
  const tabs = [...orderedTabs, ...trailingTabs];
  const defaultSectionId = normalizeString(block?.defaultSectionId);
  return {
    title: normalizeString(block?.title || "Sections") || "Sections",
    sectionIds: tabs.map((tab) => tab.id),
    ...(defaultSectionId && tabs.some((tab) => tab.id === defaultSectionId) ? { defaultSectionId } : {}),
    tabs,
  };
}

function buildReportFillStepperContent(block = {}) {
  const steps = (Array.isArray(block?.steps) ? block.steps : [])
    .map((step, index) => {
      if (!step || typeof step !== "object" || Array.isArray(step)) {
        return null;
      }
      const title = normalizeString(step?.title);
      const body = String(step?.body || "");
      const tone = normalizeString(step?.tone).toLowerCase();
      if (!title && !body.trim()) {
        return null;
      }
      return {
        id: normalizeString(step?.id || `step_${index + 1}`) || `step_${index + 1}`,
        title,
        body,
        ...(tone ? { tone } : {}),
      };
    })
    .filter(Boolean);
  return {
    title: normalizeString(block?.title || "Stepper") || "Stepper",
    ...(normalizeString(block?.description) ? { description: normalizeString(block.description) } : {}),
    steps,
  };
}

function buildReportFillInfoPanelContent(block = {}) {
  return {
    title: normalizeString(block?.title || "Info Panel") || "Info Panel",
    ...(normalizeString(block?.eyebrow) ? { eyebrow: normalizeString(block.eyebrow) } : {}),
    ...(normalizeString(block?.description) ? { description: normalizeString(block.description) } : {}),
    ...(normalizeString(block?.tone) ? { tone: normalizeString(block.tone).toLowerCase() } : {}),
    bodyFormat: "markdown",
    body: String(block?.body || ""),
  };
}

function buildReportFillCalloutContent(block = {}) {
  const badges = Array.isArray(block?.badges)
    ? block.badges.map((badge) => normalizeString(badge)).filter(Boolean)
    : [];
  return {
    title: normalizeString(block?.title || "Callout") || "Callout",
    ...(normalizeString(block?.icon) ? { icon: normalizeString(block.icon) } : {}),
    ...(normalizeString(block?.description) ? { description: normalizeString(block.description) } : {}),
    ...(normalizeString(block?.tone) ? { tone: normalizeString(block.tone).toLowerCase() } : {}),
    ...(badges.length > 0 ? { badges } : {}),
    bodyFormat: "markdown",
    body: String(block?.body || ""),
  };
}

function buildReportFillKanbanContent(block = {}) {
  const columns = (Array.isArray(block?.columns) ? block.columns : [])
    .map((column, columnIndex) => {
      if (!column || typeof column !== "object" || Array.isArray(column)) {
        return null;
      }
      const cards = (Array.isArray(column?.cards) ? column.cards : [])
        .map((card, cardIndex) => {
          if (!card || typeof card !== "object" || Array.isArray(card)) {
            return null;
          }
          const title = normalizeString(card?.title);
          const body = String(card?.body || "");
          const badge = normalizeString(card?.badge);
          const tone = normalizeString(card?.tone).toLowerCase();
          if (!title && !body.trim() && !badge) {
            return null;
          }
          return {
            id: normalizeString(card?.id || `card_${cardIndex + 1}`) || `card_${cardIndex + 1}`,
            title,
            body,
            ...(badge ? { badge } : {}),
            ...(tone ? { tone } : {}),
          };
        })
        .filter(Boolean);
      const title = normalizeString(column?.title);
      const tone = normalizeString(column?.tone).toLowerCase();
      if (!title && cards.length === 0) {
        return null;
      }
      return {
        id: normalizeString(column?.id || `column_${columnIndex + 1}`) || `column_${columnIndex + 1}`,
        title,
        ...(tone ? { tone } : {}),
        cards,
      };
    })
    .filter(Boolean);
  return {
    title: normalizeString(block?.title || "Pipeline") || "Pipeline",
    ...(normalizeString(block?.description) ? { description: normalizeString(block.description) } : {}),
    columns,
  };
}

function buildReportFillTimelineContent(block = {}) {
  const events = (Array.isArray(block?.events) ? block.events : [])
    .map((event, index) => {
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        return null;
      }
      const title = normalizeString(event?.title);
      const body = String(event?.body || "");
      const date = normalizeString(event?.date);
      const badge = normalizeString(event?.badge);
      const tone = normalizeString(event?.tone).toLowerCase();
      if (!title && !body.trim() && !date && !badge) {
        return null;
      }
      return {
        id: normalizeString(event?.id || `event_${index + 1}`) || `event_${index + 1}`,
        ...(date ? { date } : {}),
        title,
        body,
        ...(badge ? { badge } : {}),
        ...(tone ? { tone } : {}),
      };
    })
    .filter(Boolean);
  return {
    title: normalizeString(block?.title || "Timeline") || "Timeline",
    ...(normalizeString(block?.description) ? { description: normalizeString(block.description) } : {}),
    events,
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

function buildReportFillMarkdownContent(block = {}, dataset = {}, {
  datasetsByAlias = new Map(),
} = {}) {
  const selectedRow = resolveReportFillSelectedRow(dataset, "firstrow");
  const markdown = resolveReportFillTemplateMarkdown(String(block?.markdown || ""), {
    content: {},
    row: selectedRow,
    dataset,
    datasetRef: block?.datasetRef,
    datasetsByAlias,
  });
  return {
    title: normalizeString(block?.title),
    ...(normalizeString(block?.datasetRef) ? { datasetRef: normalizeString(block.datasetRef) } : {}),
    markdown,
  };
}

function normalizeFilterBarBlockMode(value = "") {
  const normalized = normalizeString(value).toLowerCase();
  return ["baseline", "unified"].includes(normalized) ? normalized : "baseline";
}

function normalizeFilterBarBlockPlacement(value = "") {
  const normalized = normalizeString(value).toLowerCase();
  return ["inherit", "inline", "rail-left", "hidden"].includes(normalized) ? normalized : "inherit";
}

function buildFilterBarGroupOrdering(block = {}) {
  const visibleGroups = (Array.isArray(block?.visibleGroups) ? block.visibleGroups : [])
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
  const groupOrder = (Array.isArray(block?.groupOrder) ? block.groupOrder : [])
    .map((entry) => normalizeString(entry))
    .filter((entry) => !!entry && visibleGroups.includes(entry));
  const collapsedGroups = (Array.isArray(block?.collapsedGroups) ? block.collapsedGroups : [])
    .map((entry) => normalizeString(entry))
    .filter((entry) => !!entry && visibleGroups.includes(entry));
  return {
    mode: normalizeFilterBarBlockMode(block?.mode),
    placement: normalizeFilterBarBlockPlacement(block?.placement),
    visibleGroups,
    groupOrder: groupOrder.length > 0 ? groupOrder : [...visibleGroups],
    collapsedGroups,
  };
}

function orderFilterBarEntries(entries = [], ordering = {}) {
  const normalizedEntries = Array.isArray(entries) ? entries : [];
  const visibleGroups = Array.isArray(ordering?.visibleGroups) ? ordering.visibleGroups : [];
  const groupOrder = Array.isArray(ordering?.groupOrder) ? ordering.groupOrder : [];
  if (visibleGroups.length === 0 && groupOrder.length === 0) {
    return normalizedEntries;
  }
  const orderIndex = new Map(groupOrder.map((groupId, index) => [normalizeString(groupId), index]));
  return normalizedEntries
    .filter((entry) => {
      if (visibleGroups.length === 0) {
        return true;
      }
      const groupId = normalizeString(entry?.groupId || entry?.id);
      return visibleGroups.includes(groupId);
    })
    .sort((left, right) => {
      const leftIndex = orderIndex.has(normalizeString(left?.groupId || left?.id))
        ? orderIndex.get(normalizeString(left?.groupId || left?.id))
        : Number.MAX_SAFE_INTEGER;
      const rightIndex = orderIndex.has(normalizeString(right?.groupId || right?.id))
        ? orderIndex.get(normalizeString(right?.groupId || right?.id))
        : Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      return normalizeString(left?.label || left?.id).localeCompare(normalizeString(right?.label || right?.id));
    });
}

function buildReportFillBlocks(reportSpec = {}, datasetsById = new Map(), {
  unifiedFilterContent = null,
} = {}) {
  const scopeParams = Array.isArray(reportSpec?.scope?.params) ? reportSpec.scope.params : [];
  const availableDatasetRefs = Array.from(datasetsById.keys());
  const datasetsByAlias = buildReportFillDatasetAliasMap(datasetsById);
  return (Array.isArray(reportSpec?.blocks) ? reportSpec.blocks : []).map((block) => {
    const normalizedBlock = cloneValue(block);
    const datasetResolution = resolveReportDatasetRefResolution({
      preferredDatasetRef: normalizeString(block?.datasetRef),
      availableDatasetRefs,
      fallbackDatasetRef: "primary",
    });
    const dataset = datasetsById.get(datasetResolution.datasetRef) || null;
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
        content: buildReportFillKpiContent(block, dataset, {
          datasetsByAlias,
        }),
      };
    }
    if (normalizeString(block?.kind) === "collectionBlock") {
      return {
        ...normalizedBlock,
        content: buildReportFillCollectionContent(block, dataset, {
          datasetsByAlias,
        }),
      };
    }
    if (normalizeString(block?.kind) === "sectionBlock") {
      return {
        ...normalizedBlock,
        content: buildReportFillSectionContent(block),
      };
    }
    if (normalizeString(block?.kind) === "compositeBlock") {
      return {
        ...normalizedBlock,
        content: buildReportFillCompositeContent(block),
      };
    }
    if (normalizeString(block?.kind) === "tabGroupBlock") {
      return {
        ...normalizedBlock,
        content: buildReportFillTabGroupContent(block, reportSpec),
      };
    }
    if (normalizeString(block?.kind) === "stepperBlock") {
      return {
        ...normalizedBlock,
        content: buildReportFillStepperContent(block),
      };
    }
    if (normalizeString(block?.kind) === "infoPanelBlock") {
      return {
        ...normalizedBlock,
        content: buildReportFillInfoPanelContent(block),
      };
    }
    if (normalizeString(block?.kind) === "calloutBlock") {
      return {
        ...normalizedBlock,
        content: buildReportFillCalloutContent(block),
      };
    }
    if (normalizeString(block?.kind) === "kanbanBlock") {
      return {
        ...normalizedBlock,
        content: buildReportFillKanbanContent(block),
      };
    }
    if (normalizeString(block?.kind) === "timelineBlock") {
      return {
        ...normalizedBlock,
        content: buildReportFillTimelineContent(block),
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
        content: buildReportFillMarkdownContent(block, dataset, {
          datasetsByAlias,
        }),
      };
    }
    if (normalizeString(block?.kind) === "filterBarBlock") {
      const unifiedCriteria = (
        (datasetResolution.datasetRef === "primary" || !normalizeString(block?.datasetRef))
        && Array.isArray(unifiedFilterContent?.criteria)
      )
        ? unifiedFilterContent.criteria.map((entry) => cloneValue(entry))
        : [];
      const filterBarOrdering = buildFilterBarGroupOrdering(block);
      const params = (Array.isArray(block?.paramIds) ? block.paramIds : [])
        .map((paramId) => normalizeString(paramId))
        .filter(Boolean)
        .map((paramId) => {
          const scopeParam = scopeParams
            .find((entry) => normalizeString(entry?.id) === paramId);
          return {
            id: paramId,
            groupId: paramId,
            ...(normalizeString(scopeParam?.label || paramId) ? { label: normalizeString(scopeParam?.label || paramId) } : {}),
            ...(normalizeString(scopeParam?.kind) ? { type: normalizeString(scopeParam?.kind) } : {}),
            ...(normalizeString(scopeParam?.datasetRef) ? { datasetRef: normalizeString(scopeParam.datasetRef) } : {}),
            ...(scopeParam?.multiple === true ? { multiple: true } : {}),
            ...(normalizeString(scopeParam?.presentation) ? { presentation: normalizeString(scopeParam?.presentation) } : {}),
            ...(scopeParam?.required === true ? { required: true } : {}),
            ...(Array.isArray(scopeParam?.options) ? { options: cloneValue(scopeParam.options) } : {}),
            ...(normalizeString(scopeParam?.description) ? { description: normalizeString(scopeParam.description) } : {}),
            value: cloneValue(scopeParam?.value),
          };
        });
      const orderedParams = orderFilterBarEntries(params, filterBarOrdering);
      const orderedCriteria = orderFilterBarEntries(unifiedCriteria, filterBarOrdering);
      return {
        ...normalizedBlock,
        content: {
          title: normalizeString(block?.title || "Filters"),
          mode: filterBarOrdering.mode,
          placement: filterBarOrdering.placement,
          groupOrder: filterBarOrdering.groupOrder,
          visibleGroups: filterBarOrdering.visibleGroups,
          collapsedGroups: filterBarOrdering.collapsedGroups,
          params: orderedParams,
          ...(orderedCriteria.length > 0 ? { criteria: orderedCriteria } : {}),
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

export function buildReportFillFromReportSpec(reportSpec = {}, datasetPayloads = {}, {
  unifiedFilterContent = null,
} = {}) {
  const normalizedReportSpec = cloneValue(reportSpec || {});
  // Fingerprint the spec as provided: consumers compare fill.specHash against
  // a hash of the stored spec, which scope-param enrichment must not disturb.
  const specHash = buildReportSpecHash(normalizedReportSpec);
  const normalizedScopeParams = normalizeReportSpecScopeParams(normalizedReportSpec);
  if (normalizedScopeParams.length > 0 || normalizedReportSpec?.scope) {
    normalizedReportSpec.scope = {
      ...(normalizedReportSpec?.scope && typeof normalizedReportSpec.scope === "object" && !Array.isArray(normalizedReportSpec.scope)
        ? normalizedReportSpec.scope
        : {}),
      params: normalizedScopeParams,
    };
  }
  const calculatedFields = cloneReportCalculatedFields(normalizedReportSpec?.calculatedFields || []);
  const datasets = (Array.isArray(normalizedReportSpec?.datasets) ? normalizedReportSpec.datasets : []).map((dataset) => (
    buildReportFillDataset(dataset, datasetPayloads?.[normalizeString(dataset?.id)] || {}, calculatedFields)
  ));
  const datasetsById = new Map(datasets.map((dataset) => [dataset.id, dataset]));
  return {
    version: 1,
    kind: "reportFill",
    specVersion: Number(normalizedReportSpec?.version || 0) || 1,
    specHash,
    source: cloneValue(normalizedReportSpec?.source || {}),
    parameters: cloneValue(normalizedReportSpec?.parameters || {}),
    refinements: cloneValue(normalizedReportSpec?.refinements || []),
    calculatedFields,
    datasets,
    blocks: buildReportFillBlocks(normalizedReportSpec, datasetsById, {
      unifiedFilterContent,
    }),
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
  const hasAuthoredDocumentBlocks = Array.isArray(state?.reportDocumentBlocks) && state.reportDocumentBlocks.length > 0;
  const reportSpec = hasAuthoredDocumentBlocks
    ? lowerReportDocumentToReportSpec(buildReportBuilderReportDocument({
      container,
      config,
      state,
    }))
    : buildReportBuilderReportSpec({
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
