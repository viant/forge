import { validateSemanticBinding } from "../../semantic/modelValidation.js";
import { createReportBuilderDrillMetadataProvider } from "../../reporting/reportBuilderDrillMetadata.js";

import { buildPreviewAudienceFeatureDiagnostics } from "./previewSemanticAudienceFeatures.js";
import { applyPreviewDetailTargetBehavior } from "./previewDetailTargetBehaviors.js";
import { incrementReportBuilderPreviewMetric } from "./previewMetrics.js";
import {
  applyPreviewSemanticModelBehavior,
  hasQueuedPreviewSemanticModelBehavior,
  persistPreviewSemanticModelBehaviors,
} from "./previewSemanticModel.js";
import {
  validatePreviewSemanticSelectionParameters,
} from "./previewSemanticParameterValidation.js";
import {
  applyPreviewSemanticValidationBehavior,
  persistPreviewSemanticValidationBehaviors,
} from "./previewSemanticValidation.js";
import { applyPreviewRuntimeActionBehavior } from "./previewRuntimeActionBehaviors.js";

function clonePreviewValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeString(value = "") {
  return String(value || "").trim();
}

function buildSemanticModelResolutionDiagnostics(modelRef = "", error = null) {
  const normalizedRef = normalizeString(modelRef);
  const message = normalizeString(error?.message || error);
  if (!message || message === `Unknown semantic model '${normalizedRef}'.`) {
    return [{
      code: "unknownModel",
      severity: "error",
      path: "selection.modelRef",
      message: `Unknown semantic model '${modelRef}'.`,
    }];
  }
  return [{
    code: "semanticModelError",
    severity: "error",
    path: "selection.modelRef",
    message,
    suggestedFix: "Retry loading the semantic model or choose a different semantic binding.",
  }];
}

function resolveMaybeFunction(value = null) {
  return typeof value === "function" ? value() : value;
}

export function createPreviewSemanticDiagnostics(errors = []) {
  return (Array.isArray(errors) ? errors : []).map((error) => ({
    code: error?.code || "invalidSelection",
    severity: "error",
    path: error?.field || "",
    message: error?.message || "Semantic selection is invalid.",
  }));
}

function persistSemanticModelBehaviorState(getStorage = null, metrics = null) {
  persistPreviewSemanticModelBehaviors(
    resolveMaybeFunction(getStorage),
    metrics?.semanticModelBehaviors || [],
  );
}

function persistSemanticValidationBehaviorState(getStorage = null, metrics = null) {
  persistPreviewSemanticValidationBehaviors(
    resolveMaybeFunction(getStorage),
    metrics?.semanticValidationBehaviors || [],
  );
}

export function createDemoSemanticModelHandler({
  semanticModel = null,
  drillMetadata = {},
  staticFilters = [],
  getMetrics = null,
  getStorage = null,
} = {}) {
  const fallbackSemanticModel = semanticModel && typeof semanticModel === "object" && !Array.isArray(semanticModel)
    ? clonePreviewValue(semanticModel)
    : null;
  const configBackedDrillProvider = createReportBuilderDrillMetadataProvider(drillMetadata);
  const pendingModelRequests = new Map();
  const resolvedModelCache = new Map();

  async function resolveDemoSemanticModel(modelRef = "") {
    const normalizedRef = normalizeString(modelRef);
    const metrics = resolveMaybeFunction(getMetrics);
    if (metrics) {
      incrementReportBuilderPreviewMetric(metrics, "getModelCount");
    }
    let behaviorResult = null;
    try {
      behaviorResult = await applyPreviewSemanticModelBehavior(metrics, normalizedRef);
    } finally {
      persistSemanticModelBehaviorState(getStorage, metrics);
    }
    if (behaviorResult && typeof behaviorResult === "object" && !Array.isArray(behaviorResult)) {
      const payload = clonePreviewValue(behaviorResult);
      resolvedModelCache.set(normalizedRef, clonePreviewValue(payload));
      return payload;
    }
    if (resolvedModelCache.has(normalizedRef)) {
      return clonePreviewValue(resolvedModelCache.get(normalizedRef));
    }
    if (normalizedRef && normalizedRef === normalizeString(fallbackSemanticModel?.modelRef)) {
      const payload = clonePreviewValue(fallbackSemanticModel);
      resolvedModelCache.set(normalizedRef, clonePreviewValue(payload));
      return payload;
    }
    throw new Error(`Unknown semantic model '${modelRef}'.`);
  }

  async function loadDemoSemanticModel(modelRef = "") {
    const normalizedRef = normalizeString(modelRef);
    if (
      normalizedRef
      && resolvedModelCache.has(normalizedRef)
      && !hasQueuedPreviewSemanticModelBehavior(resolveMaybeFunction(getMetrics), normalizedRef)
    ) {
      return clonePreviewValue(resolvedModelCache.get(normalizedRef));
    }
    if (!pendingModelRequests.has(normalizedRef)) {
      const request = resolveDemoSemanticModel(normalizedRef)
        .finally(() => {
          pendingModelRequests.delete(normalizedRef);
        });
      pendingModelRequests.set(normalizedRef, request);
    }
    return pendingModelRequests.get(normalizedRef)
      .then((payload) => clonePreviewValue(payload));
  }

  function invalidateModelCache(modelRef = "") {
    const normalizedRef = normalizeString(modelRef);
    if (normalizedRef) {
      resolvedModelCache.delete(normalizedRef);
      pendingModelRequests.delete(normalizedRef);
      return 1;
    }
    const clearedCount = resolvedModelCache.size;
    resolvedModelCache.clear();
    pendingModelRequests.clear();
    return clearedCount;
  }

  return {
    async listModels(namespace = "") {
      if (!fallbackSemanticModel) {
        return {
          rows: [],
          nextCursor: "",
        };
      }
      return {
        rows: [
          {
            modelRef: fallbackSemanticModel.modelRef,
            label: fallbackSemanticModel.label,
            version: fallbackSemanticModel.version,
            namespace,
            status: "active",
          },
        ],
        nextCursor: "",
      };
    },
    async getModel(modelRef = "") {
      return loadDemoSemanticModel(modelRef);
    },
    invalidateModelCache,
    async validateSelection(modelRef = "", selection = {}) {
      const metrics = resolveMaybeFunction(getMetrics);
      if (metrics) {
        incrementReportBuilderPreviewMetric(metrics, "validateSelectionCount");
      }
      const normalizedRef = normalizeString(modelRef);
      let behaviorResult = null;
      try {
        behaviorResult = await applyPreviewSemanticValidationBehavior(metrics, normalizedRef, selection);
      } finally {
        persistSemanticValidationBehaviorState(getStorage, metrics);
      }
      if (behaviorResult) {
        return behaviorResult;
      }
      let resolvedSemanticModel = null;
      try {
        resolvedSemanticModel = await loadDemoSemanticModel(normalizedRef);
      } catch (error) {
        return {
          valid: false,
          normalizedSelection: null,
          diagnostics: buildSemanticModelResolutionDiagnostics(modelRef, error),
        };
      }
      const validation = validateSemanticBinding({
        mode: "semantic",
        modelRef: normalizedRef,
        entity: selection?.entity,
        selectedDimensions: selection?.dimensions,
        selectedMeasures: selection?.measures,
      }, resolvedSemanticModel);
      if (validation.valid) {
        const dimensions = validation.normalizedBinding?.selectedDimensions || [];
        const measures = validation.normalizedBinding?.selectedMeasures || [];
        const parameterValidation = validatePreviewSemanticSelectionParameters({
          model: resolvedSemanticModel,
          entityId: validation.normalizedBinding?.entity,
          parameters: selection?.parameters || {},
          staticFilters,
        });
        if (Array.isArray(parameterValidation.diagnostics) && parameterValidation.diagnostics.length > 0) {
          return {
            valid: false,
            normalizedSelection: {
              entity: validation.normalizedBinding.entity,
              dimensions,
              measures,
              parameters: parameterValidation.parameters,
            },
            diagnostics: parameterValidation.diagnostics,
          };
        }
        const audienceDiagnostics = buildPreviewAudienceFeatureDiagnostics({
          dimensions,
          measures,
        });
        if (audienceDiagnostics.length > 0) {
          return {
            valid: false,
            normalizedSelection: {
              entity: validation.normalizedBinding.entity,
              dimensions,
              measures,
              parameters: parameterValidation.parameters,
            },
            diagnostics: audienceDiagnostics,
          };
        }
        return {
          valid: true,
          normalizedSelection: {
            entity: validation.normalizedBinding.entity,
            dimensions,
            measures,
            parameters: parameterValidation.parameters,
          },
          diagnostics: [],
        };
      }
      return {
        valid: validation.valid,
        normalizedSelection: validation.normalizedBinding
          ? {
            entity: validation.normalizedBinding.entity,
            dimensions: validation.normalizedBinding.selectedDimensions,
            measures: validation.normalizedBinding.selectedMeasures,
            parameters: selection?.parameters || {},
          }
          : null,
        diagnostics: createPreviewSemanticDiagnostics(validation.errors),
      };
    },
    async getDrillHierarchy(fieldRef = "") {
      return configBackedDrillProvider.getDrillHierarchy(fieldRef);
    },
    async getDetailTarget(targetRef = "") {
      const metrics = resolveMaybeFunction(getMetrics);
      const overridden = await applyPreviewDetailTargetBehavior(metrics, {
        targetRef,
      });
      if (overridden !== undefined) {
        return overridden;
      }
      return configBackedDrillProvider.getDetailTarget(targetRef);
    },
    async listAvailableRefinements(blockKind = "", fieldRef = "") {
      const fallbackActionPayload = await configBackedDrillProvider.listAvailableRefinements(blockKind, fieldRef);
      const fallbackActions = Array.isArray(fallbackActionPayload?.actions)
        ? fallbackActionPayload.actions
        : (Array.isArray(fallbackActionPayload) ? fallbackActionPayload : []);
      const metrics = resolveMaybeFunction(getMetrics);
      return {
        actions: await applyPreviewRuntimeActionBehavior(metrics, blockKind, fieldRef, fallbackActions),
      };
    },
  };
}

export async function validateDemoSemanticRequest(request = {}, semanticModelHandler = null) {
  const semanticSelection = request?.semanticSelection;
  if (!semanticSelection) {
    return null;
  }
  if (!semanticModelHandler) {
    throw new Error("Semantic model provider unavailable.");
  }
  const unmappedDimensions = semanticSelection?.unmapped?.dimensions || [];
  const unmappedMeasures = semanticSelection?.unmapped?.measures || [];
  const unmappedParameters = semanticSelection?.unmapped?.parameters || [];
  if (unmappedDimensions.length > 0 || unmappedMeasures.length > 0 || unmappedParameters.length > 0) {
    throw new Error([
      unmappedDimensions.length > 0 ? `Unmapped semantic dimensions: ${unmappedDimensions.join(", ")}` : "",
      unmappedMeasures.length > 0 ? `Unmapped semantic measures: ${unmappedMeasures.join(", ")}` : "",
      unmappedParameters.length > 0 ? `Unmapped semantic parameters: ${unmappedParameters.join(", ")}` : "",
    ].filter(Boolean).join(" • "));
  }
  const result = await semanticModelHandler.validateSelection(semanticSelection.modelRef, {
    entity: semanticSelection.entity,
    dimensions: semanticSelection?.selection?.dimensions || [],
    measures: semanticSelection?.selection?.measures || [],
    parameters: semanticSelection?.parameters || {},
  });
  if (result?.valid) {
    return result;
  }
  const first = Array.isArray(result?.diagnostics) ? result.diagnostics[0] : null;
  throw new Error(first?.message || "Semantic selection is invalid.");
}
