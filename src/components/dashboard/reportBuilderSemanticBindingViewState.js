import { normalizeReportBuilderSemanticSummary } from "./reportBuilderSemantic.js";
import {
  resolveReportRuntimeBindingSummary,
  resolveReportRuntimeBindingSummaryChips,
} from "./reportRuntimeModel.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeBinding(binding = null) {
  return binding && typeof binding === "object" && !Array.isArray(binding)
    ? cloneValue(binding)
    : null;
}

function normalizeFieldGroups(bindingSummary = null) {
  if (!bindingSummary || typeof bindingSummary !== "object" || Array.isArray(bindingSummary)) {
    return [];
  }
  const groups = [
    {
      id: "dimensions",
      title: `Selected dimensions (${Number(bindingSummary.dimensionCount || 0)})`,
      fields: Array.isArray(bindingSummary.selectedDimensions) ? bindingSummary.selectedDimensions : [],
    },
    {
      id: "measures",
      title: `Selected measures (${Number(bindingSummary.measureCount || 0)})`,
      fields: Array.isArray(bindingSummary.selectedMeasures) ? bindingSummary.selectedMeasures : [],
    },
    {
      id: "parameters",
      title: `Selected parameters (${Number(bindingSummary.parameterCount || 0)})`,
      fields: Array.isArray(bindingSummary.selectedParameters) ? bindingSummary.selectedParameters : [],
    },
  ];
  return groups
    .map((group) => ({
      id: normalizeString(group.id),
      title: normalizeString(group.title),
      fields: group.fields
        .filter((field) => field && typeof field === "object" && !Array.isArray(field))
        .map((field) => cloneValue(field)),
    }))
    .filter((group) => group.id && group.title && group.fields.length > 0);
}

export function buildReportBuilderSemanticBindingViewState({
  semanticSummary = null,
  binding = null,
} = {}) {
  const normalizedSummary = normalizeReportBuilderSemanticSummary(semanticSummary);
  const normalizedBinding = normalizeBinding(binding);
  const bindingSummary = resolveReportRuntimeBindingSummary({
    ...(normalizedSummary ? { semanticSummary: normalizedSummary } : {}),
    ...(normalizedBinding ? { binding: normalizedBinding } : {}),
  });
  if (!bindingSummary) {
    return null;
  }
  return {
    title: normalizeString(bindingSummary.title || "Semantic Binding") || "Semantic Binding",
    chips: resolveReportRuntimeBindingSummaryChips(bindingSummary),
    modelLabel: normalizeString(bindingSummary.modelLabel || bindingSummary.modelRef),
    entityLabel: normalizeString(bindingSummary.entityLabel || bindingSummary.entity),
    fieldGroups: normalizeFieldGroups(bindingSummary),
  };
}

export function buildReportBuilderSemanticBindingViewStateFromReportSpec(reportSpec = null) {
  const normalizedReportSpec = reportSpec && typeof reportSpec === "object" && !Array.isArray(reportSpec)
    ? reportSpec
    : null;
  if (!normalizedReportSpec) {
    return null;
  }
  return buildReportBuilderSemanticBindingViewState({
    semanticSummary: normalizedReportSpec.semanticSummary || null,
    binding: normalizedReportSpec.binding || null,
  });
}
