import {
  createDrillMetadataProvider,
  dedupeRefinementActions,
  normalizeDetailTarget,
  normalizeDrillHierarchy,
  normalizeRefinementActions,
  resolveRefinementActionIdentityKey,
} from "../../reporting/drillMetadataProvider.js";
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

function hasAnyDetailProviderMethods(provider = null) {
  return !!provider && (
    typeof provider.getDrillHierarchy === "function"
    || typeof provider.getDetailTarget === "function"
    || typeof provider.listAvailableRefinements === "function"
  );
}

function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeDetailProviderHierarchyResult(payload = null) {
  return payload ? normalizeDrillHierarchy(payload) : null;
}

function normalizeDetailProviderTargetResult(payload = null) {
  return payload ? normalizeDetailTarget(payload) : null;
}

function normalizeDetailProviderActionsResult(payload = null) {
  return normalizeRefinementActions(payload || []);
}

function mergeDetailProviders(primaryProvider = null, fallbackProvider = null) {
  if (!hasAnyDetailProviderMethods(primaryProvider)) {
    return fallbackProvider;
  }
  if (!hasAnyDetailProviderMethods(fallbackProvider)) {
    return hasDetailProviderMethods(primaryProvider)
      ? primaryProvider
      : null;
  }
  const getDrillHierarchy = (typeof primaryProvider?.getDrillHierarchy === "function" || typeof fallbackProvider?.getDrillHierarchy === "function")
    ? async (fieldRef = "", options = {}) => {
      const primary = typeof primaryProvider?.getDrillHierarchy === "function"
        ? normalizeDetailProviderHierarchyResult(await primaryProvider.getDrillHierarchy(fieldRef, options))
        : null;
      if (primary) {
        return primary;
      }
      return typeof fallbackProvider?.getDrillHierarchy === "function"
        ? normalizeDetailProviderHierarchyResult(await fallbackProvider.getDrillHierarchy(fieldRef, options))
        : null;
    }
    : null;
  const getDetailTarget = (typeof primaryProvider?.getDetailTarget === "function" || typeof fallbackProvider?.getDetailTarget === "function")
    ? async (targetRef = "", options = {}) => {
      const primary = typeof primaryProvider?.getDetailTarget === "function"
        ? normalizeDetailProviderTargetResult(await primaryProvider.getDetailTarget(targetRef, options))
        : null;
      const fallback = typeof fallbackProvider?.getDetailTarget === "function"
        ? normalizeDetailProviderTargetResult(await fallbackProvider.getDetailTarget(targetRef, options))
        : null;
      if (!primary) {
        return fallback;
      }
      if (!fallback) {
        return primary;
      }
      return {
        ...fallback,
        ...primary,
        parameters: {
          ...(fallback?.parameters && typeof fallback.parameters === "object" && !Array.isArray(fallback.parameters) ? fallback.parameters : {}),
          ...(primary?.parameters && typeof primary.parameters === "object" && !Array.isArray(primary.parameters) ? primary.parameters : {}),
        },
      };
    }
    : null;
  const listAvailableRefinements = (typeof primaryProvider?.listAvailableRefinements === "function" || typeof fallbackProvider?.listAvailableRefinements === "function")
    ? async (blockKind = "", fieldRef = "", options = {}) => {
      const primary = typeof primaryProvider?.listAvailableRefinements === "function"
        ? normalizeDetailProviderActionsResult(await primaryProvider.listAvailableRefinements(blockKind, fieldRef, options))
        : null;
      const fallback = typeof fallbackProvider?.listAvailableRefinements === "function"
        ? normalizeDetailProviderActionsResult(await fallbackProvider.listAvailableRefinements(blockKind, fieldRef, options))
        : null;
      const primaryActions = Array.isArray(primary) ? primary : [];
      const fallbackActions = Array.isArray(fallback) ? fallback : [];
      const fallbackKeys = new Set(
        fallbackActions
          .map((action) => resolveRefinementActionIdentityKey(action))
          .filter(Boolean),
      );
      const primaryUniqueActions = primaryActions.filter((action) => {
        const identityKey = resolveRefinementActionIdentityKey(action);
        return identityKey && !fallbackKeys.has(identityKey);
      });
      return {
        actions: dedupeRefinementActions([
          ...primaryUniqueActions,
          ...fallbackActions,
        ]),
      };
    }
    : null;
  if (!getDrillHierarchy || !getDetailTarget || !listAvailableRefinements) {
    return null;
  }
  return createDrillMetadataProvider({
    getDrillHierarchy,
    getDetailTarget,
    listAvailableRefinements,
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
  if (!hasAnyDetailProviderMethods(semanticModelHandler)) {
    return fallbackProvider;
  }
  return mergeDetailProviders(
    semanticModelHandler,
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
    title: normalizeString(resolvedDetailTarget?.title) || "Resolved detail target",
    description: normalizeString(resolvedDetailTarget?.description) || description,
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
