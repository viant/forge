import { autoType, csvParse } from "d3-dsv";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function humanizeLabel(value = "") {
  const normalized = normalizeString(value);
  if (!normalized) {
    return "";
  }
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join(" ");
}

function normalizeStaticDatasetFormat(value = "") {
  const normalized = normalizeString(value).toLowerCase();
  return normalized === "json" || normalized === "forge-data" || normalized === "forge_data"
    ? "json"
    : "csv";
}

function buildStaticDatasetKindLabel(format = "csv") {
  return `static ${normalizeStaticDatasetFormat(format)}`;
}

function buildStaticDatasetDataSourceRef(id = "", format = "csv") {
  const normalizedId = sanitizeId(id);
  const normalizedFormat = normalizeStaticDatasetFormat(format);
  return `static_${normalizedFormat}_${normalizedId}`;
}

function buildStaticDatasetRequestKind(format = "csv") {
  return normalizeStaticDatasetFormat(format) === "json" ? "staticJson" : "staticCsv";
}

function sanitizeId(value = "") {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function assertStaticDatasetIdAllowed(id = "") {
  const normalizedId = sanitizeId(id);
  if (!normalizedId) {
    throw new Error("Static datasets require a non-empty id.");
  }
  if (normalizedId === "primary") {
    throw new Error("Static dataset id 'primary' is reserved. Rename the imported dataset before adding it.");
  }
  return normalizedId;
}

function inferColumnKind(rows = [], key = "") {
  const values = (Array.isArray(rows) ? rows : [])
    .map((row) => (row && typeof row === "object" && !Array.isArray(row) ? row[key] : undefined))
    .filter((value) => value !== null && value !== undefined && value !== "");
  if (values.length === 0) {
    return "dimension";
  }
  const numeric = values.every((value) => typeof value === "number" && Number.isFinite(value));
  return numeric ? "measure" : "dimension";
}

function normalizeColumns(columns = [], rows = []) {
  const explicit = Array.isArray(columns) ? columns : [];
  const seen = new Set();
  const normalized = explicit
    .map((column) => {
      const key = normalizeString(column?.key || column?.id || column?.value);
      if (!key || seen.has(key)) {
        return null;
      }
      seen.add(key);
      return {
        key,
        label: normalizeString(column?.label || humanizeLabel(key)) || key,
        kind: normalizeString(column?.kind || inferColumnKind(rows, key)) || inferColumnKind(rows, key),
      };
    })
    .filter(Boolean);
  if (normalized.length > 0) {
    return normalized;
  }
  const firstRow = rows.find((row) => row && typeof row === "object" && !Array.isArray(row)) || null;
  if (!firstRow) {
    return [];
  }
  return Object.keys(firstRow).map((key) => ({
    key,
    label: humanizeLabel(key) || key,
    kind: inferColumnKind(rows, key),
  }));
}

function buildFieldOptions(columns = [], kind = "") {
  return (Array.isArray(columns) ? columns : [])
    .filter((column) => normalizeString(column?.kind) === kind)
    .map((column) => ({
      value: normalizeString(column?.key),
      label: normalizeString(column?.label || column?.key),
    }))
    .filter((entry) => entry.value && entry.label);
}

function buildAllFieldOptions(columns = []) {
  return (Array.isArray(columns) ? columns : [])
    .map((column) => ({
      value: normalizeString(column?.key),
      label: normalizeString(column?.label || column?.key),
    }))
    .filter((entry) => entry.value && entry.label);
}

function buildDatasetDescription(label = "", rows = [], columns = [], format = "csv") {
  const rowCount = Array.isArray(rows) ? rows.length : 0;
  const columnCount = Array.isArray(columns) ? columns.length : 0;
  const typeLabel = normalizeStaticDatasetFormat(format) === "json" ? "JSON" : "CSV";
  return [typeLabel, `${rowCount} row${rowCount === 1 ? "" : "s"}`, `${columnCount} column${columnCount === 1 ? "" : "s"}`].join(" • ");
}

function normalizeDatasetRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row) => cloneValue(row));
}

function buildDatasetSeed({
  id = "",
  label = "",
  fileName = "",
  description = "",
  rows = [],
  columns = [],
  format = "csv",
  dataSourceRef = "",
} = {}) {
  const normalizedRows = normalizeDatasetRows(rows);
  const normalizedColumns = normalizeColumns(columns, normalizedRows);
  const normalizedId = assertStaticDatasetIdAllowed(id || label || fileName || `static_${Date.now()}`);
  const fallbackLabel = humanizeLabel(label || fileName || normalizedId);
  const resolvedLabel = normalizeString(label || fallbackLabel || normalizedId) || normalizedId;
  const resolvedFormat = normalizeStaticDatasetFormat(format);
  return {
    id: normalizedId,
    label: resolvedLabel,
    fileName,
    description: normalizeString(description || buildDatasetDescription(resolvedLabel, normalizedRows, normalizedColumns, resolvedFormat)),
    rows: normalizedRows,
    columns: normalizedColumns,
    sourceFormat: resolvedFormat,
    dataSourceRef: normalizeString(dataSourceRef || buildStaticDatasetDataSourceRef(normalizedId, resolvedFormat)),
  };
}

function buildJsonDatasetSeed(dataset = null, {
  fallbackId = "",
  fileName = "",
  forcedId = "",
} = {}) {
  const normalizedDataset = dataset && typeof dataset === "object" && !Array.isArray(dataset) ? dataset : null;
  if (!normalizedDataset) {
    throw new Error("Each forge-data dataset must be a JSON object.");
  }
  const rawRows = Array.isArray(normalizedDataset.data) ? normalizedDataset.data : [];
  const rows = normalizeDatasetRows(rawRows);
  if (rawRows.length === 0) {
    throw new Error("Each forge-data dataset must contain a non-empty data array of row objects.");
  }
  if (rows.length !== rawRows.length) {
    throw new Error("Each forge-data dataset must contain only row objects in its data array.");
  }
  return buildDatasetSeed({
    id: forcedId || normalizedDataset.id || fallbackId || fileName,
    label: normalizeString(
      normalizedDataset.label
      || normalizedDataset.title
      || humanizeLabel(normalizedDataset.id)
      || "",
    ),
    fileName,
    description: normalizeString(normalizedDataset.description),
    rows,
    columns: normalizedDataset.columns,
    format: "json",
    dataSourceRef: normalizedDataset.dataSourceRef,
  });
}

function extractForgeDataJsonBlocks(text = "") {
  const source = String(text || "");
  const matches = [...source.matchAll(/```forge-data\s*([\s\S]*?)```/g)];
  return matches.map((match) => normalizeString(match?.[1] || "")).filter(Boolean);
}

function assertUniqueStaticDatasetIds(datasets = []) {
  const seen = new Set();
  (Array.isArray(datasets) ? datasets : []).forEach((dataset) => {
    const datasetId = assertStaticDatasetIdAllowed(dataset?.id || "");
    if (seen.has(datasetId)) {
      throw new Error(`Static dataset id '${datasetId}' appears more than once in the imported file.`);
    }
    seen.add(datasetId);
  });
}

export function normalizeReportBuilderStaticDatasets(datasets = []) {
  const seen = new Set();
  return (Array.isArray(datasets) ? datasets : [])
    .map((dataset) => {
      if (!dataset || typeof dataset !== "object" || Array.isArray(dataset)) {
        return null;
      }
      const rows = normalizeDatasetRows(dataset?.rows);
      const fallbackLabel = humanizeLabel(dataset?.label || dataset?.fileName || dataset?.id || "");
      const id = sanitizeId(dataset?.id || dataset?.label || dataset?.fileName || `static_${seen.size + 1}`);
      if (!id || seen.has(id)) {
        return null;
      }
      seen.add(id);
      const columns = normalizeColumns(dataset?.columns, rows);
      const format = normalizeStaticDatasetFormat(dataset?.sourceFormat || dataset?.format || dataset?.kindLabel);
      const label = normalizeString(dataset?.label || fallbackLabel || id) || id;
      const description = normalizeString(dataset?.description || buildDatasetDescription(label, rows, columns, format));
      const dataSourceRef = normalizeString(dataset?.dataSourceRef || buildStaticDatasetDataSourceRef(id, format))
        || buildStaticDatasetDataSourceRef(id, format);
      return {
        id,
        label,
        description,
        dataSourceRef,
        kindLabel: buildStaticDatasetKindLabel(format),
        sourceFormat: format,
        rows,
        columns,
        rowCount: rows.length,
        columnCount: columns.length,
        columnOptions: columns.map((column) => ({
          key: normalizeString(column?.key),
          label: normalizeString(column?.label || column?.key),
          kind: normalizeString(column?.kind || "dimension") || "dimension",
        })),
        valueFieldOptions: buildFieldOptions(columns, "measure"),
        secondaryFieldOptions: buildFieldOptions(columns, "dimension"),
      };
    })
    .filter(Boolean);
}

export function buildReportBuilderStaticDatasetOptions(datasets = []) {
  return normalizeReportBuilderStaticDatasets(datasets).map((dataset) => ({
    value: dataset.id,
    label: dataset.label,
    description: dataset.description,
    kindLabel: dataset.kindLabel,
    dataSourceRef: dataset.dataSourceRef,
    columnOptions: cloneValue(dataset.columnOptions),
    valueFieldOptions: cloneValue(dataset.valueFieldOptions),
    secondaryFieldOptions: cloneValue(dataset.secondaryFieldOptions),
  }));
}

export function buildReportBuilderStaticDatasetDeclarations(datasets = []) {
  return normalizeReportBuilderStaticDatasets(datasets).map((dataset) => ({
    id: dataset.id,
    dataSourceRef: dataset.dataSourceRef,
    request: {
      kind: buildStaticDatasetRequestKind(dataset?.sourceFormat),
      format: normalizeStaticDatasetFormat(dataset?.sourceFormat),
      rowCount: dataset.rowCount,
      columnKeys: dataset.columns.map((column) => column.key),
    },
  }));
}

export function buildReportBuilderStaticDatasetPayloadMap(datasets = []) {
  return normalizeReportBuilderStaticDatasets(datasets).reduce((acc, dataset) => {
    acc[dataset.id] = {
      rows: cloneValue(dataset.rows),
      hasMore: false,
      diagnostics: [],
    };
    return acc;
  }, {});
}

export function applyReportBuilderStaticDatasetFieldHints(datasets = [], fieldHints = {}) {
  const normalizedHints = fieldHints && typeof fieldHints === "object" && !Array.isArray(fieldHints)
    ? fieldHints
    : {};
  return normalizeReportBuilderStaticDatasets(datasets).map((dataset) => {
    const datasetHints = normalizedHints[dataset.id] && typeof normalizedHints[dataset.id] === "object" && !Array.isArray(normalizedHints[dataset.id])
      ? normalizedHints[dataset.id]
      : null;
    if (!datasetHints) {
      return dataset;
    }
    const hintedColumns = (Array.isArray(dataset.columns) ? dataset.columns : []).map((column) => {
      const hintedKind = normalizeString(datasetHints[normalizeString(column?.key)]).toLowerCase();
      if (!["dimension", "measure"].includes(hintedKind)) {
        return column;
      }
      return {
        ...column,
        kind: hintedKind,
      };
    });
    return normalizeReportBuilderStaticDatasets([{
      ...dataset,
      columns: hintedColumns,
    }])[0] || dataset;
  });
}

export function buildReportBuilderStaticDatasetFromCsvFile({
  fileName = "",
  csv = "",
  id = "",
} = {}) {
  const normalizedCsv = String(csv || "");
  const parsed = csvParse(normalizedCsv, autoType);
  const rows = Array.isArray(parsed) ? parsed.map((row) => cloneValue(row)) : [];
  const columns = Array.isArray(parsed?.columns) ? parsed.columns : [];
  if (columns.length === 0) {
    throw new Error("The CSV file does not include any columns.");
  }
  const label = normalizeString(
    humanizeLabel(normalizeString(fileName).replace(/\.[^.]+$/, ""))
    || "Imported CSV",
  ) || "Imported CSV";
  return normalizeReportBuilderStaticDatasets([buildDatasetSeed({
    id: id || label || `static_${Date.now()}`,
    label,
    fileName,
    rows,
    columns: columns.map((key) => ({
      key,
      label: humanizeLabel(key) || key,
      kind: inferColumnKind(rows, key),
    })),
    format: "csv",
  })])[0] || null;
}

export function buildReportBuilderStaticDatasetsFromJsonFile({
  fileName = "",
  json = "",
  id = "",
} = {}) {
  const normalizedJson = String(json || "").trim();
  if (!normalizedJson) {
    throw new Error("The JSON file is empty.");
  }
  const forgeDataBlocks = extractForgeDataJsonBlocks(normalizedJson);
  if (forgeDataBlocks.length > 0) {
    if (id && forgeDataBlocks.length > 1) {
      throw new Error("A single replacement target cannot be populated from multiple forge-data datasets.");
    }
    const datasets = forgeDataBlocks.map((block, index) => buildJsonDatasetSeed(JSON.parse(block), {
        fallbackId: `${normalizeString(fileName).replace(/\.[^.]+$/, "") || "dataset"}_${index + 1}`,
        fileName,
        forcedId: id && forgeDataBlocks.length === 1 ? id : "",
      }));
    assertUniqueStaticDatasetIds(datasets);
    return normalizeReportBuilderStaticDatasets(datasets);
  }
  const parsed = JSON.parse(normalizedJson);
  if (Array.isArray(parsed)) {
    const rows = normalizeDatasetRows(parsed);
    if (parsed.length === 0) {
      throw new Error("The JSON array does not contain any rows.");
    }
    if (rows.length !== parsed.length) {
      throw new Error("The JSON array must contain only row objects.");
    }
    return normalizeReportBuilderStaticDatasets([buildDatasetSeed({
      id: id || normalizeString(fileName).replace(/\.[^.]+$/, "") || `static_${Date.now()}`,
      label: humanizeLabel(normalizeString(fileName).replace(/\.[^.]+$/, "")) || "Imported JSON",
      fileName,
      rows,
      format: "json",
    })]);
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    if (Array.isArray(parsed.datasets)) {
      if (id && parsed.datasets.length > 1) {
        throw new Error("A single replacement target cannot be populated from multiple JSON datasets.");
      }
      const datasets = parsed.datasets.map((dataset, index) => buildJsonDatasetSeed(dataset, {
          fallbackId: `${normalizeString(fileName).replace(/\.[^.]+$/, "") || "dataset"}_${index + 1}`,
          fileName,
          forcedId: id && parsed.datasets.length === 1 ? id : "",
        }));
      assertUniqueStaticDatasetIds(datasets);
      return normalizeReportBuilderStaticDatasets(datasets);
    }
    if (Array.isArray(parsed.data)) {
      return normalizeReportBuilderStaticDatasets([buildJsonDatasetSeed(parsed, {
        fallbackId: normalizeString(fileName).replace(/\.[^.]+$/, "") || "dataset",
        fileName,
        forcedId: id,
      })]);
    }
  }
  throw new Error("The JSON file must contain a forge-data block, a dataset object with a data array, or an array of row objects.");
}
