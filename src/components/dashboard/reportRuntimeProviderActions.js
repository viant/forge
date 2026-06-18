import {
  resolveReportRuntimeChartActionFields,
  resolveReportRuntimeFieldActionKey,
  resolveReportRuntimeRefinementFields,
} from "./reportRuntimeModel.js";

function normalizeString(value = "") {
  return String(value || "").trim();
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
      Promise.resolve().then(() => provider.listAvailableRefinements(block.kind, field.valueKey, {
        reportSpec,
        block,
      }))
    )),
  );
  requests.forEach(({ block, field }, index) => {
    const settled = settledResults[index];
    const key = resolveReportRuntimeFieldActionKey(block.id, field.valueKey);
    if (settled?.status === "fulfilled") {
      providerActionsByField.set(
        key,
        Array.isArray(settled.value) ? settled.value : [],
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
