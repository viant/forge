import { buildReportRuntimeTableActionDescriptors } from "./reportRuntimeTableActionModel.js";
import { buildReportRuntimeTableActionExecutions } from "./reportRuntimeTableExecutionModel.js";
import { formatRefinementActionLabel } from "./reportRuntimeChartActionModel.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function disambiguateTableActionEntries(actionEntries = []) {
  const entries = Array.isArray(actionEntries) ? actionEntries : [];
  const duplicateCounts = entries.reduce((acc, entry) => {
    const label = normalizeString(entry?.label);
    if (!label) {
      return acc;
    }
    acc.set(label, (acc.get(label) || 0) + 1);
    return acc;
  }, new Map());
  return entries.map((entry) => {
    const label = normalizeString(entry?.label);
    if (!label || (duplicateCounts.get(label) || 0) <= 1) {
      return entry;
    }
    const fieldLabel = normalizeString(entry?.field?.label);
    if (!fieldLabel) {
      return entry;
    }
    const nextLabel = (() => {
      const fallback = normalizeString(formatRefinementActionLabel(entry?.kind, fieldLabel));
      if (fallback && fallback !== label) {
        return fallback;
      }
      return `${label} • ${fieldLabel}`;
    })();
    return {
      ...entry,
      label: nextLabel,
      descriptor: {
        ...(entry?.descriptor || {}),
        label: nextLabel,
      },
    };
  });
}

export function buildReportRuntimeTableInteractionState({
  blockId = "",
  fields = [],
  providerActionsByField = new Map(),
} = {}) {
  const rawActionEntries = (Array.isArray(fields) ? fields : []).flatMap((field) => {
    const descriptors = buildReportRuntimeTableActionDescriptors({
      blockId,
      field,
      providerActionsByField,
    });
    return descriptors.map((descriptor) => ({
      id: descriptor.id,
      label: descriptor.label,
      kind: descriptor.kind,
      publishSelection: false,
      field,
      descriptor,
    }));
  });
  const actionEntries = disambiguateTableActionEntries(rawActionEntries);

  return {
    descriptors: actionEntries.map((entry) => entry.descriptor),
    actionEntries,
    actions: actionEntries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      kind: entry.kind,
      publishSelection: entry.publishSelection,
      resolveExecution(item = {}) {
        return resolveReportRuntimeTableInteractionExecution({
          blockId,
          actionEntries: [entry],
          actionId: entry.id,
          item,
        });
      },
    })),
  };
}

export function resolveReportRuntimeTableInteractionExecution({
  blockId = "",
  actionEntries = [],
  actionId = "",
  item = {},
} = {}) {
  const entry = (Array.isArray(actionEntries) ? actionEntries : []).find((candidate) => normalizeString(candidate?.id) === normalizeString(actionId));
  if (!entry) {
    return null;
  }
  const executions = buildReportRuntimeTableActionExecutions({
    blockId,
    descriptors: [entry.descriptor],
    field: entry.field,
    item,
  });
  return executions[0] || null;
}
