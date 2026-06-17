import { createDrillMetadataProvider } from "../../reporting/drillMetadataProvider.js";
import { normalizeReportRuntimeHostIntent } from "../../reporting/reportRuntimeHostIntent.js";
import { resolveReportRuntimeDetailTarget } from "../../reporting/reportRuntimeDetailTarget.js";
import { buildReportRuntimeDetailDiagnosticMessage } from "./reportRuntimeDetailDiagnosticModel.js";
import { resolveReportRuntimeDrillMetadataProvider } from "./reportRuntimeDrillProvider.js";

function hasDetailProviderMethods(provider = null) {
  return !!provider
    && typeof provider.getDrillHierarchy === "function"
    && typeof provider.getDetailTarget === "function"
    && typeof provider.listAvailableRefinements === "function";
}

function normalizeString(value = "") {
  return String(value || "").trim();
}

function dedupeRefinementActions(actions = []) {
  const seen = new Set();
  return (Array.isArray(actions) ? actions : []).filter((action) => {
    const id = normalizeString(action?.id);
    if (!id || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function mergeDetailProviders(primaryProvider = null, fallbackProvider = null) {
  if (!hasDetailProviderMethods(primaryProvider)) {
    return fallbackProvider;
  }
  if (!hasDetailProviderMethods(fallbackProvider)) {
    return primaryProvider;
  }
  return createDrillMetadataProvider({
    async getDrillHierarchy(fieldRef = "", options = {}) {
      const primary = await primaryProvider.getDrillHierarchy(fieldRef, options);
      return primary || fallbackProvider.getDrillHierarchy(fieldRef, options);
    },
    async getDetailTarget(targetRef = "", options = {}) {
      const primary = await primaryProvider.getDetailTarget(targetRef, options);
      return primary || fallbackProvider.getDetailTarget(targetRef, options);
    },
    async listAvailableRefinements(blockKind = "", fieldRef = "", options = {}) {
      const primary = await primaryProvider.listAvailableRefinements(blockKind, fieldRef, options);
      const fallback = await fallbackProvider.listAvailableRefinements(blockKind, fieldRef, options);
      const primaryActions = Array.isArray(primary) ? primary : (Array.isArray(primary?.actions) ? primary.actions : []);
      const fallbackActions = Array.isArray(fallback) ? fallback : (Array.isArray(fallback?.actions) ? fallback.actions : []);
      return {
        actions: dedupeRefinementActions([
          ...primaryActions,
          ...fallbackActions,
        ]),
      };
    },
  });
}

export function resolveReportRuntimePreviewDetailProvider({
  semanticModelHandler = null,
  reportSpec = {},
} = {}) {
  const fallbackProvider = resolveReportRuntimeDrillMetadataProvider({
    reportSpec,
    runtimeHandlers: null,
  });
  if (!hasDetailProviderMethods(semanticModelHandler)) {
    return fallbackProvider;
  }
  return mergeDetailProviders(
    createDrillMetadataProvider(semanticModelHandler),
    fallbackProvider,
  );
}

export function resetReportRuntimeDetailState({
  setHostIntent = null,
  setDetailDiagnostic = null,
} = {}) {
  if (typeof setHostIntent === "function") {
    setHostIntent(null);
  }
  if (typeof setDetailDiagnostic === "function") {
    setDetailDiagnostic(null);
  }
}

function setReportRuntimeDetailErrorState({
  setHostIntent = null,
  setDetailDiagnostic = null,
  message = "",
} = {}) {
  resetReportRuntimeDetailState({
    setHostIntent,
    setDetailDiagnostic,
  });
  const normalizedMessage = String(message || "").trim();
  if (!normalizedMessage || typeof setDetailDiagnostic !== "function") {
    return null;
  }
  const nextDiagnostic = {
    code: "detailTargetError",
    severity: "warning",
    message: normalizedMessage,
  };
  setDetailDiagnostic(nextDiagnostic);
  return nextDiagnostic;
}

function setReportRuntimeResolvedDetailState({
  setHostIntent = null,
  setDetailDiagnostic = null,
  resolvedDetailTarget = null,
  description = "",
} = {}) {
  if (!resolvedDetailTarget || typeof resolvedDetailTarget !== "object") {
    resetReportRuntimeDetailState({
      setHostIntent,
      setDetailDiagnostic,
    });
    return {
      hostIntent: null,
      detailDiagnostic: null,
    };
  }
  const nextHostIntent = normalizeReportRuntimeHostIntent({
    intentKind: "detailTarget",
    title: "Resolved detail target",
    description,
    ...resolvedDetailTarget,
  });
  if (typeof setHostIntent === "function") {
    setHostIntent(nextHostIntent);
  }
  const detailDiagnosticMessage = buildReportRuntimeDetailDiagnosticMessage(resolvedDetailTarget);
  const nextDetailDiagnostic = detailDiagnosticMessage
    ? {
      code: "detailTargetPartial",
      severity: "warning",
      message: detailDiagnosticMessage,
    }
    : null;
  if (typeof setDetailDiagnostic === "function") {
    setDetailDiagnostic(nextDetailDiagnostic);
  }
  return {
    hostIntent: nextHostIntent,
    detailDiagnostic: nextDetailDiagnostic,
  };
}

export function createReportRuntimeDetailTargetOpener({
  drillMetadataProvider = null,
  setHostIntent = null,
  setDetailDiagnostic = null,
  description = "Ready for host routing from the authored runtime preview.",
} = {}) {
  return async function openReportRuntimeDetailTarget({ action, item, value }) {
    const targetRef = action?.targetRef;
    if (!targetRef || !drillMetadataProvider) {
      setReportRuntimeDetailErrorState({
        setHostIntent,
        setDetailDiagnostic,
        message: targetRef
          ? `Failed to resolve detail target ${targetRef}. No compatible detail-target provider is configured.`
          : "Failed to resolve the requested detail target.",
      });
      return null;
    }
    try {
      const detailTarget = await drillMetadataProvider.getDetailTarget(targetRef, {
        row: item,
        value,
      });
      if (!detailTarget) {
        setReportRuntimeDetailErrorState({
          setHostIntent,
          setDetailDiagnostic,
          message: `No detail target resolved for ${targetRef}.`,
        });
        return null;
      }
      const resolvedDetailTarget = resolveReportRuntimeDetailTarget(detailTarget, {
        row: item,
        runtimeValue: value,
        selectionRows: Array.isArray(item?.selectionRows) ? item.selectionRows : [],
      });
      setReportRuntimeResolvedDetailState({
        setHostIntent,
        setDetailDiagnostic,
        resolvedDetailTarget,
        description,
      });
      return resolvedDetailTarget;
    } catch (detailError) {
      setReportRuntimeDetailErrorState({
        setHostIntent,
        setDetailDiagnostic,
        message: `Failed to resolve detail target ${targetRef}. ${String(detailError?.message || detailError || "")}`.trim(),
      });
      return null;
    }
  };
}

export function buildReportRuntimeHandlers({
  applyRefinement = null,
  applyDrillTransition = null,
  removeRefinement = null,
  clearRefinements = null,
  undoRefinements = null,
  redoRefinements = null,
  canUndoRefinements = false,
  canRedoRefinements = false,
  clearHostIntent = null,
  clearDetailDiagnostic = null,
  clearDetailState = null,
  openDetailTarget = null,
  drillMetadataProvider = null,
} = {}) {
  return {
    ...(typeof applyRefinement === "function" ? { applyRefinement } : {}),
    ...(typeof applyDrillTransition === "function" ? { applyDrillTransition } : {}),
    ...(typeof removeRefinement === "function" ? { removeRefinement } : {}),
    ...(typeof clearRefinements === "function" ? { clearRefinements } : {}),
    ...(typeof undoRefinements === "function"
      ? {
        undoRefinements,
        canUndoRefinements: canUndoRefinements === true,
      }
      : {}),
    ...(typeof redoRefinements === "function"
      ? {
        redoRefinements,
        canRedoRefinements: canRedoRefinements === true,
      }
      : {}),
    ...(typeof clearHostIntent === "function" ? { clearHostIntent } : {}),
    ...(typeof clearDetailDiagnostic === "function" ? { clearDetailDiagnostic } : {}),
    ...(typeof clearDetailState === "function" ? { clearDetailState } : {}),
    ...(typeof openDetailTarget === "function" ? { openDetailTarget } : {}),
    ...(hasDetailProviderMethods(drillMetadataProvider) ? { drillMetadataProvider } : {}),
  };
}
