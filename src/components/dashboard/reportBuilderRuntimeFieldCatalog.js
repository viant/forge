import { normalizeReportBuilderOptionDefinitions } from "./reportBuilderOptions.js";
import { normalizePresentationClampConfig } from "../../utils/presentationText.js";
import {hydrateReportRequestEnvelope} from "../../reporting/reportRequestEnvelope.js";

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
  const source = Array.isArray(values)
    ? values
    : (typeof values === "string" ? values.split(/[\s,]+/) : []);
  return source.flatMap((value) => (
    typeof value === "string" ? value.split(/[\s,]+/) : [value]
  )).map(normalizeString).filter(Boolean);
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

function normalizeTablePresentation(value = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const labelClamp = normalizePresentationClampConfig(value?.labelClamp || value?.LabelClamp);
  const collapsible = value?.collapsible === true || value?.Collapsible === true;
  return {
    ...(collapsible ? { collapsible: true } : {}),
    ...(collapsible && (value?.defaultCollapsed === true || value?.DefaultCollapsed === true) ? { defaultCollapsed: true } : {}),
    ...(labelClamp ? { labelClamp } : {}),
  };
}

export function applyReportBuilderRuntimeFieldCatalog(config = {}, windowForm = {}) {
  const next = clone(config) || {};
  if (next.request?.envelope) delete next.request.envelopeContext;
  const definition = windowForm?.reportDefinition || {};
  const finish = () => next.request?.envelope && definition?.fieldCatalog
    ? hydrateReportRequestEnvelope(next,windowForm,definition) : next;
  if (next?.runtimeFieldCatalog?.enabled !== true) {
    return finish();
  }
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
      options: windowForm?.Options,
      tablePresentation: windowForm?.TablePresentation,
    };
  next.reportOptions = normalizeReportBuilderOptionDefinitions(catalog?.options);
  const tablePresentation = normalizeTablePresentation(
    catalog?.tablePresentation
    || catalog?.TablePresentation
    || definition?.tablePresentation
    || definition?.TablePresentation,
  );
  if (tablePresentation && Object.keys(tablePresentation).length > 0) {
    next.tablePresentation = tablePresentation;
  }
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
    return finish();
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
  if (Number.isSafeInteger(catalog?.maxRows) && catalog.maxRows>0) {
    next.request={...(next.request || {}),maxRows:Math.min(Number.isSafeInteger(next.request?.maxRows) && next.request.maxRows>0 ? next.request.maxRows : catalog.maxRows,catalog.maxRows)};
  }

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
    const parameter = (Array.isArray(catalog?.parameters) ? catalog.parameters : [])
      .find(item => item?.name === "campaignIds");
    const choices = Array.isArray(parameter?.choices) ? parameter.choices : [];
    const seen = new Set();
    const options = choices.filter(choice => {
      if (!Number.isSafeInteger(choice?.value) || choice.value <= 0 || seen.has(choice.value)) return false;
      seen.add(choice.value);return true;
    }).map(choice => ({value:choice.value,label:normalizeString(choice.label) || `Campaign ${choice.value}`}));
    const lazyChoicesRef = normalizeString(next.campaignChoicesDataSourceRef);
    predicates.push({
      id: "campaignIds",
      label: "Campaign",
      pinned: true,
      paramPath: "filters.campaignIds",
      multiple: true,
      emitArray: true,
      // Choices are presentation metadata. The producer must reauthorize IDs
      // on execution; missing/empty choices never enable free-form identifiers.
      manualEntry: false,
      options,
      ...(lazyChoicesRef ? {optionsDataSourceRef:lazyChoicesRef,optionsFetchMode:"onFocus",optionValueField:"value",optionLabelField:"label"} : {}),
      prefill: ["campaignIds", "campaignId"],
    });
  }
  next.predicates = predicates;
  next.groupBy = {
    default: normalizeList(catalog?.defaultDimensions)[0] || dimensions[0]?.name || "",
    options: dimensions.map((column) => ({ value: column.name, label: column.label, dimensionId: column.name })),
  };
  return finish();
}
