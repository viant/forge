function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeString(value = "") {
  return String(value || "").trim();
}

function humanize(value = "") {
  return normalizeString(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeList(values = []) {
  return (Array.isArray(values) ? values : []).map(normalizeString).filter(Boolean);
}

function normalizeFormat(column = {}) {
  const explicit = normalizeString(column?.format);
  if (explicit) return explicit;
  const name = normalizeString(column?.name).toLowerCase();
  const type = normalizeString(column?.type).toLowerCase();
  if (type === "date" || name.endsWith("date")) return "date";
  if (/spend|revenue|sales|cost|cpm|price|amount/.test(name)) return "currency";
  if (/rate|ratio|percent|percentage|lift|ctr/.test(name)) return "percent";
  if (type === "integer" || type === "number") return "compactNumber";
  return "";
}

export function applyReportBuilderRuntimeFieldCatalog(config = {}, windowForm = {}) {
  const next = clone(config) || {};
  if (next?.runtimeFieldCatalog?.enabled !== true) {
    return next;
  }
  const definition = windowForm?.reportDefinition || {};
  const nestedCatalog = definition?.fieldCatalog || windowForm?.fieldCatalog || windowForm?.FieldCatalog || {};
  const catalog = Array.isArray(nestedCatalog?.columns)
    ? nestedCatalog
    : {
      columns: windowForm?.Columns,
      defaultDimensions: windowForm?.DefaultDimensions,
      defaultMeasures: windowForm?.DefaultMeasures,
      allowedFilters: windowForm?.AllowedFilters,
      allowedSorts: windowForm?.AllowedSorts,
      defaultDatePreset: windowForm?.DefaultDatePreset,
      maxRows: windowForm?.MaxRows,
    };
  const columns = (Array.isArray(catalog?.columns) ? catalog.columns : [])
    .map((column) => ({
      name: normalizeString(column?.name),
      role: normalizeString(column?.role).toLowerCase(),
      type: normalizeString(column?.type).toLowerCase(),
      format: normalizeFormat(column),
      label: normalizeString(column?.label) || humanize(column?.name),
    }))
    .filter((column) => column.name && (column.role === "dimension" || column.role === "measure"));
  if (columns.length === 0) {
    return next;
  }

  const defaultDimensions = new Set(normalizeList(catalog?.defaultDimensions));
  const defaultMeasures = new Set(normalizeList(catalog?.defaultMeasures));
  const dimensions = columns.filter((column) => column.role === "dimension");
  const measures = columns.filter((column) => column.role === "measure");
  next.dimensions = dimensions.map((column) => ({
    id: column.name,
    key: column.name,
    label: column.label,
    ...(column.format ? { format: column.format } : {}),
    ...(defaultDimensions.has(column.name) ? { default: true } : {}),
    paramPath: `dimensions.${column.name}`,
  }));
  next.measures = measures.map((column) => ({
    id: column.name,
    key: column.name,
    label: column.label,
    ...(column.format ? { format: column.format } : {}),
    ...(defaultMeasures.has(column.name) ? { default: true } : {}),
    paramPath: `measures.${column.name}`,
  }));
  next.primaryMeasure = normalizeList(catalog?.defaultMeasures)[0] || measures[0]?.name || "";

  const allowedSorts = new Set(normalizeList(catalog?.allowedSorts));
  next.result = {
    ...(next.result || {}),
    orderFields: columns
      .filter((column) => allowedSorts.has(column.name))
      .map((column) => ({
        value: column.name,
        field: column.name,
        label: column.label,
        defaultDirection: column.role === "measure" ? "desc" : "asc",
      })),
  };

  const allowedFilters = new Set(normalizeList(catalog?.allowedFilters));
  const predicates = [];
  if (allowedFilters.has("from") || allowedFilters.has("to") || allowedFilters.has("dateRange")) {
    predicates.push({
      id: "dateRange",
      label: "Date Range",
      kind: "dateRange",
      startParamPath: "filters.from",
      endParamPath: "filters.to",
      prefill: { start: ["from", "From"], end: ["to", "To"] },
      ...(normalizeString(catalog?.defaultDatePreset)
        ? { default: { preset: normalizeString(catalog.defaultDatePreset) } }
        : {}),
    });
  }
  if (allowedFilters.has("campaignIds")) {
    predicates.push({
      id: "campaignIds",
      label: "Campaign",
      bucket: "scope",
      paramPath: "filters.campaignIds",
      multiple: true,
      emitArray: true,
      manualEntry: true,
      manualValueType: "int",
      manualPlaceholder: "Enter campaign id",
      prefill: ["campaignIds", "campaignId"],
    });
  }
  next.predicates = predicates;
  next.groupBy = {
    default: normalizeList(catalog?.defaultDimensions)[0] || dimensions[0]?.name || "",
    options: dimensions.map((column) => ({ value: column.name, label: column.label, dimensionId: column.name })),
  };
  return next;
}
