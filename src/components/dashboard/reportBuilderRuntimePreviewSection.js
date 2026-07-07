import React from "react";
import {
  ReportBuilderScopeSummary,
  ReportBuilderSemanticBindingChips,
  ReportBuilderSemanticFieldGroups,
} from "./reportBuilderComponents.jsx";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeItems(values = []) {
  return (Array.isArray(values) ? values : []).filter(Boolean);
}

export function ReportBuilderAuthoredRuntimePreviewHeader({ state = null } = {}) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return null;
  }
  const chips = normalizeItems(state.semanticBindingChips);
  const fieldGroups = normalizeItems(state.semanticBindingFieldGroups);
  const scopeItems = normalizeItems(state.scopeSummaryItems);
  return React.createElement(
    "div",
    { className: "forge-report-builder__runtime-preview-header" },
    React.createElement("div", { className: "forge-report-builder__runtime-preview-eyebrow" }, normalizeString(state.eyebrow)),
    React.createElement("h4", { className: "forge-report-builder__runtime-preview-title" }, normalizeString(state.title)),
    normalizeString(state.subtitle)
      ? React.createElement("div", { className: "forge-report-builder__runtime-preview-description" }, normalizeString(state.subtitle))
      : null,
    React.createElement("p", { className: "forge-report-builder__runtime-preview-description" }, normalizeString(state.description)),
    chips.length > 0
      ? React.createElement(ReportBuilderSemanticBindingChips, {
          bindingState: state,
          marginTop: 10,
        })
      : null,
    fieldGroups.length > 0
      ? React.createElement(ReportBuilderSemanticFieldGroups, {
          bindingState: state,
          marginTop: 10,
        })
      : null,
    scopeItems.length > 0
      ? React.createElement(ReportBuilderScopeSummary, {
          summaryState: state,
          marginTop: 10,
        })
      : null,
  );
}
