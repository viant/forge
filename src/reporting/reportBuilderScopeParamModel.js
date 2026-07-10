import {
  listReportBuilderPinnedPredicates,
  resolveReportBuilderScopeParamFilters,
} from "../components/dashboard/reportBuilderPredicates.js";
import { getScopeParamValue, resolveScopeParamId } from "./scopeStateModel.js";
import { normalizeReportBuilderPublishedDataSources } from "./reportBuilderPublishedDatasetModel.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function resolveScopeParamValue(filter = {}, state = {}, runtimeDatasetScopeParams = null, datasetRef = "") {
  const filterId = resolveScopeParamId(filter);
  if (!filterId) {
    return null;
  }
  const normalizedDatasetRef = normalizeString(datasetRef);
  const datasetScopedValues = normalizedDatasetRef
    && runtimeDatasetScopeParams
    && typeof runtimeDatasetScopeParams === "object"
    && !Array.isArray(runtimeDatasetScopeParams)
    && runtimeDatasetScopeParams[normalizedDatasetRef]
    && typeof runtimeDatasetScopeParams[normalizedDatasetRef] === "object"
    && !Array.isArray(runtimeDatasetScopeParams[normalizedDatasetRef])
      ? runtimeDatasetScopeParams[normalizedDatasetRef]
      : null;
  const rawValue = datasetScopedValues && Object.prototype.hasOwnProperty.call(datasetScopedValues, filterId)
    ? datasetScopedValues[filterId]
    : getScopeParamValue(state, filterId);
  if (filter?.type === "dateRange") {
    const start = normalizeString(rawValue?.start);
    const end = normalizeString(rawValue?.end);
    return start || end ? { start, end } : null;
  }
  if (Array.isArray(rawValue)) {
    return rawValue.length > 0 ? cloneValue(rawValue) : [];
  }
  return rawValue ?? null;
}

function collectPinnedPredicateScopeParams(config = {}, state = {}) {
  return listReportBuilderPinnedPredicates(config).map((predicate) => {
    const value = resolveScopeParamValue(
      { id: predicate.id, ...(predicate.kind === "dateRange" ? { type: "dateRange" } : {}) },
      state,
    );
    return {
      id: predicate.id,
      kind: predicate.kind === "dateRange"
        ? "dateRange"
        : (predicate.multiple === true ? "multiSelect" : "value"),
      label: normalizeString(predicate.label || predicate.id),
      ...(predicate.description ? { description: predicate.description } : {}),
      required: predicate.required === true,
      ...(predicate.multiple === true ? { multiple: true } : {}),
      ...(predicate.presentation ? { presentation: normalizeString(predicate.presentation) } : {}),
      ...(Array.isArray(predicate.options) ? { options: cloneValue(predicate.options) } : {}),
      value,
    };
  });
}

function collectLegacyStaticFilterScopeParams(config = {}, state = {}, excludedIds = new Set()) {
  return resolveReportBuilderScopeParamFilters(config)
    .map((filter) => {
      const id = normalizeString(filter?.id || filter?.field);
      if (!id || excludedIds.has(id)) {
        return null;
      }
      const value = resolveScopeParamValue(filter, state);
      const description = normalizeString(filter?.description);
      return {
        id,
        kind: normalizeString(filter?.type || (filter?.multiple ? "multiSelect" : "value")) || "value",
        label: normalizeString(filter?.label || id),
        ...(description ? { description } : {}),
        required: filter?.required === true,
        ...(filter?.multiple === true ? { multiple: true } : {}),
        ...(normalizeString(filter?.presentation) ? { presentation: normalizeString(filter.presentation) } : {}),
        ...(Array.isArray(filter?.options) ? { options: cloneValue(filter.options) } : {}),
        value,
      };
    })
    .filter(Boolean);
}

function collectConfiguredDataSourceScopeParams(config = {}, state = {}, excludedIds = new Set(), runtimeDatasetScopeParams = null) {
  const seen = new Set(excludedIds instanceof Set ? [...excludedIds] : []);
  const params = [];
  normalizeReportBuilderPublishedDataSources(config).forEach((source) => {
    const datasetRef = normalizeString(source?.id || source?.dataSourceRef || source?.value);
    if (!datasetRef) {
      return;
    }
    (Array.isArray(source?.scopeParamOptions) ? source.scopeParamOptions : []).forEach((option) => {
      const id = normalizeString(option?.id || option?.value);
      if (!id || seen.has(id)) {
        return;
      }
      seen.add(id);
      const kind = normalizeString(option?.kind || "value") || "value";
      const value = resolveScopeParamValue({
        id,
        ...(kind === "dateRange" ? { type: "dateRange" } : {}),
        ...(option?.multiple === true ? { multiple: true } : {}),
      }, state, runtimeDatasetScopeParams, datasetRef);
      params.push({
        id,
        kind,
        label: normalizeString(option?.label || id),
        ...(normalizeString(option?.description) ? { description: normalizeString(option.description) } : {}),
        required: option?.required === true,
        ...(option?.multiple === true ? { multiple: true } : {}),
        ...(normalizeString(option?.presentation) ? { presentation: normalizeString(option.presentation) } : {}),
        ...(Array.isArray(option?.options) ? { options: cloneValue(option.options) } : {}),
        datasetRef,
        value,
      });
    });
  });
  return params;
}

export function buildReportBuilderScopeParams(config = {}, state = {}, runtimeDatasetScopeParams = null) {
  const predicateParams = collectPinnedPredicateScopeParams(config, state);
  const predicateParamIds = new Set(predicateParams.map((param) => param.id));
  const legacyParams = collectLegacyStaticFilterScopeParams(config, state, predicateParamIds);
  const configuredSourceParams = collectConfiguredDataSourceScopeParams(
    config,
    state,
    new Set([...predicateParamIds, ...legacyParams.map((param) => param.id)]),
    runtimeDatasetScopeParams,
  );
  return [
    ...predicateParams,
    ...legacyParams,
    ...configuredSourceParams,
  ];
}
