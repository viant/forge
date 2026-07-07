import {
  resolveReportRuntimeChartActionFields,
  resolveReportRuntimeFieldLabel,
  resolveReportRuntimeFieldActionKey,
  resolveReportRuntimeRefinementFields,
} from "./reportRuntimeModel.js";
import { formatRefinementActionLabel } from "./reportRuntimeChartActionModel.js";
import { normalizeDrillHierarchy, normalizeRefinementActions } from "../../reporting/drillMetadataProvider.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function resolveDrillHierarchyNextLabel(hierarchy = null, fieldValueKey = "", nextFieldRef = "") {
  const normalizedHierarchy = normalizeDrillHierarchy(hierarchy);
  const normalizedFieldValueKey = normalizeString(fieldValueKey);
  const normalizedNextFieldRef = normalizeString(nextFieldRef);
  const levels = Array.isArray(normalizedHierarchy?.levels) ? normalizedHierarchy.levels : [];
  const currentIndex = levels.findIndex((level) => normalizeString(level?.field) === normalizedFieldValueKey);
  if (currentIndex === -1) {
    return "";
  }
  const nextLevel = levels[currentIndex + 1] || null;
  if (!nextLevel || normalizeString(nextLevel?.field) !== normalizedNextFieldRef) {
    return "";
  }
  return normalizeString(nextLevel?.label || normalizedNextFieldRef);
}

function normalizeRuntimeProviderActions({
  actions = [],
  reportSpec = {},
  block = {},
  field = {},
  hierarchy = null,
} = {}) {
  const normalizedActions = normalizeRefinementActions(actions);
  if (normalizedActions.length === 0) {
    return [];
  }
  const fieldLabel = normalizeString(field?.label || field?.valueKey || "Field");
  const genericDrillLabel = normalizeString(formatRefinementActionLabel("drill", fieldLabel)).toLowerCase();
  return normalizedActions.map((action) => {
    const normalizedKind = normalizeString(action?.kind).toLowerCase();
    if (normalizedKind !== "drill") {
      return action;
    }
    const nextFieldRef = normalizeString(action?.nextFieldRef);
    if (!nextFieldRef) {
      return action;
    }
    const currentLabel = normalizeString(action?.label);
    if (currentLabel && currentLabel.toLowerCase() !== genericDrillLabel) {
      return action;
    }
    const nextLabel = resolveDrillHierarchyNextLabel(hierarchy, field?.valueKey, nextFieldRef)
      || resolveReportRuntimeFieldLabel(reportSpec, block?.datasetRef, nextFieldRef, "");
    if (!nextLabel) {
      return action;
    }
    return {
      ...action,
      label: `Drill to ${nextLabel}`,
    };
  });
}

function resolveProviderActionFields(reportSpec = {}, block = {}) {
  return normalizeString(block?.kind) === "chartBlock"
    ? resolveReportRuntimeChartActionFields(reportSpec, block)
    : resolveReportRuntimeRefinementFields(reportSpec, block);
}

function cloneProviderActionsByField(providerActionsByField = new Map()) {
  return new Map(
    providerActionsByField instanceof Map
      ? Array.from(providerActionsByField.entries()).map(([key, actions]) => [key, Array.isArray(actions) ? actions.slice() : []])
      : [],
  );
}

function cloneProviderDiagnostics(providerDiagnostics = []) {
  return (Array.isArray(providerDiagnostics) ? providerDiagnostics : [])
    .map((diagnostic) => (diagnostic && typeof diagnostic === "object" && !Array.isArray(diagnostic)
      ? { ...diagnostic }
      : diagnostic));
}

export function buildIdleReportRuntimeProviderActionsState() {
  return {
    providerActionsByField: new Map(),
    providerDiagnostics: [],
    loading: false,
  };
}

export function buildPendingReportRuntimeProviderActionsState(currentState = {}) {
  return {
    providerActionsByField: cloneProviderActionsByField(currentState?.providerActionsByField),
    providerDiagnostics: cloneProviderDiagnostics(currentState?.providerDiagnostics),
    loading: true,
  };
}

export function buildResolvedReportRuntimeProviderActionsState({
  providerActionsByField = new Map(),
  providerDiagnostics = [],
} = {}) {
  return {
    providerActionsByField: cloneProviderActionsByField(providerActionsByField),
    providerDiagnostics: cloneProviderDiagnostics(providerDiagnostics),
    loading: false,
  };
}

export async function resolveReportRuntimeProviderActions({
  provider = null,
  reportSpec = {},
  blocks = [],
} = {}) {
  if (!provider || typeof provider.listAvailableRefinements !== "function") {
    return {
      providerActionsByField: new Map(),
      providerDiagnostics: [],
    };
  }
  const providerActionsByField = new Map();
  const providerDiagnostics = [];
  const supportedBlocks = (Array.isArray(blocks) ? blocks : [])
    .filter((block) => ["tableBlock", "chartBlock"].includes(normalizeString(block?.kind)));
  const requests = supportedBlocks.flatMap((block) => (
    resolveProviderActionFields(reportSpec, block).map((field) => ({
      block,
      field,
    }))
  ));
  const settledResults = await Promise.allSettled(
    requests.map(({ block, field }) => (
      Promise.resolve().then(async () => {
        const actions = await provider.listAvailableRefinements(block.kind, field.valueKey, {
          reportSpec,
          block,
        });
        let hierarchy = null;
        if (typeof provider?.getDrillHierarchy === "function") {
          try {
            hierarchy = await provider.getDrillHierarchy(field.valueKey, {
              reportSpec,
              block,
            });
          } catch (_) {
            hierarchy = null;
          }
        }
        return {
          actions,
          hierarchy,
        };
      })
    )),
  );
  requests.forEach(({ block, field }, index) => {
    const settled = settledResults[index];
    const key = resolveReportRuntimeFieldActionKey(block.id, field.valueKey);
    if (settled?.status === "fulfilled") {
      const payload = settled.value && typeof settled.value === "object" && !Array.isArray(settled.value)
        ? settled.value
        : { actions: settled.value, hierarchy: null };
      providerActionsByField.set(
        key,
        normalizeRuntimeProviderActions({
          actions: Array.isArray(payload?.actions) ? payload.actions : payload?.actions,
          reportSpec,
          block,
          field,
          hierarchy: payload?.hierarchy || null,
        }),
      );
      return;
    }
    providerActionsByField.set(key, []);
    providerDiagnostics.push({
      code: "actionProviderFailed",
      blockId: normalizeString(block?.id),
      path: `reportRuntime.blocks.${normalizeString(block?.id)}.actions.${normalizeString(field?.valueKey)}`,
      severity: "warning",
      message: `Failed to load refinement actions for ${field.label}. ${String(settled?.reason?.message || settled?.reason || "")}`.trim(),
      suggestedFix: "Retry the action provider or continue without runtime refinements for this block.",
    });
  });
  return {
    providerActionsByField,
    providerDiagnostics,
  };
}

export async function loadReportRuntimeProviderActions({
  provider = null,
  reportSpec = {},
  blocks = [],
  resolver = resolveReportRuntimeProviderActions,
} = {}) {
  try {
    return await resolver({
      provider,
      reportSpec,
      blocks,
    });
  } catch (error) {
    return {
      providerActionsByField: new Map(),
      providerDiagnostics: [{
        code: "actionProviderFailed",
        severity: "warning",
        message: `Failed to load refinement actions. ${String(error?.message || error || "")}`.trim(),
        suggestedFix: "Retry the action provider or continue without runtime refinements for this runtime surface.",
      }],
    };
  }
}
