import {
    resolveResultIdentityChip,
    resolveTablePresetTransitionText,
} from "./reportBuilderResultIdentity.js";
import { resolveScopeParamId } from "../../reporting/scopeStateModel.js";

export function formatCompactDateRangeSummary(value = {}) {
    const start = String(value?.start || "").trim();
    const end = String(value?.end || "").trim();
    if (!start && !end) {
        return "";
    }
    if (start && end) {
        return `${start} to ${end}`;
    }
    return start || end;
}

function pluralizedCount(count = 0, label = "") {
    const numeric = Number(count || 0);
    return `${numeric} ${label}${numeric === 1 ? "" : "s"}`;
}

export {
    resolveResultIdentityChip,
    resolveTablePresetTransitionText,
};

export function resolveCompactStatusText({
    loading = false,
    error = null,
    canShowResults = false,
    explicitChartMode = false,
    hasValidChartSpec = false,
    viewMode = "",
    chartTitle = "",
    rowCount = 0,
    canRunReport = false,
    readinessReason = "",
    readinessMessage = "",
    activeTablePresetTitle = "",
    modifiedTablePresetTitle = "",
} = {}) {
    const presetTransitionText = resolveTablePresetTransitionText({
        canShowResults,
        readinessReason,
        readinessMessage,
        activeTablePresetTitle,
        modifiedTablePresetTitle,
    });
    if (loading) {
        return "Refreshing report data.";
    }
    if (error) {
        return "Report refresh failed.";
    }
    if (canShowResults) {
        if (explicitChartMode && hasValidChartSpec && viewMode === "chart") {
            return chartTitle
                ? `Showing ${chartTitle}.`
                : "Showing chart results.";
        }
        if (presetTransitionText) {
            return presetTransitionText;
        }
        return `Showing ${pluralizedCount(rowCount, "row")}.`;
    }
    if (canRunReport) {
        if (presetTransitionText) {
            return presetTransitionText;
        }
        return "Ready to run the report.";
    }
    if (presetTransitionText) {
        return presetTransitionText;
    }
    if (readinessReason === "scope") {
        return "Choose a scope to continue.";
    }
    return "Set the required filters to continue.";
}

export function resolveCompactSummaryItems({
    requiredStaticFilters = [],
    scopeParamValues = {},
    selectedMeasures = [],
    selectedDimensions = [],
    totalActiveFilterCount = 0,
    hasValidChartSpec = false,
    canShowResults = false,
    viewMode = "",
    activeTablePresetTitle = "",
    modifiedTablePresetTitle = "",
    limit = 5,
} = {}) {
    const items = [];
    const identityChip = resolveResultIdentityChip({
        showingChartView: hasValidChartSpec && viewMode === "chart",
        canShowResults,
        activeTablePresetTitle,
        modifiedTablePresetTitle,
    });
    const dateRangeFilter = requiredStaticFilters.find((filter) => String(filter?.type || "").trim() === "dateRange");
    const dateRangeKey = dateRangeFilter ? resolveScopeParamId(dateRangeFilter) : "";
    if (dateRangeKey) {
        const summary = formatCompactDateRangeSummary(scopeParamValues?.[dateRangeKey]);
        if (summary) {
            items.push(summary);
        }
    }
    if (selectedMeasures.length > 0) {
        items.push(pluralizedCount(selectedMeasures.length, "measure"));
    }
    if (selectedDimensions.length > 0) {
        items.push(pluralizedCount(selectedDimensions.length, "breakdown"));
    }
    if (totalActiveFilterCount > 0) {
        items.push(pluralizedCount(totalActiveFilterCount, "filter"));
    }
    if (identityChip) {
        items.unshift(identityChip);
    }
    return items.slice(0, limit);
}

export function resolveCompactSemanticSummaryItems({
  semanticBindingChips = [],
  semanticMetaChips = [],
  semanticTitle = "",
  limit = 2,
} = {}) {
  const bindingItems = (Array.isArray(semanticBindingChips) ? semanticBindingChips : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);
  if (bindingItems.length > 0) {
    return bindingItems;
  }
  const metaItems = (Array.isArray(semanticMetaChips) ? semanticMetaChips : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);
  if (metaItems.length > 0) {
    return metaItems;
  }
  const normalizedTitle = String(semanticTitle || "").trim();
  return normalizedTitle ? [normalizedTitle] : [];
}

export function resolveCompactSemanticActionLabel({
  semanticTitle = "",
  tone = "",
  diagnosticsCount = 0,
  activationCount = 0,
} = {}) {
  const normalizedTitle = String(semanticTitle || "").trim().toLowerCase();
  const normalizedTone = String(tone || "").trim().toLowerCase();
  if (normalizedTitle === "no data model configured" || normalizedTitle === "data model inactive") {
    return Number(activationCount || 0) > 0 ? "Activate data model" : "Data model setup";
  }
  if (normalizedTone === "danger" || (normalizedTone === "warning" && Number(diagnosticsCount || 0) > 0)) {
    return "Data model issues";
  }
  return "Data model";
}

export function resolveCompactSemanticHintText({
  semanticTitle = "",
  activationCount = 0,
} = {}) {
  const normalizedTitle = String(semanticTitle || "").trim().toLowerCase();
  const count = Number(activationCount || 0) || 0;
  if (normalizedTitle !== "no data model configured" && normalizedTitle !== "data model inactive") {
    return "";
  }
  if (count > 0) {
    return count === 1
      ? "A data-model report is ready to activate from this workspace."
      : `${count} data-model reports are ready to activate from this workspace.`;
  }
  return "Load a report file to switch this builder from raw mode to data-model mappings.";
}
