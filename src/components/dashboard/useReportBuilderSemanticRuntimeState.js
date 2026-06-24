import React from "react";

import {
  applyReportBuilderSemanticConfig,
  buildReportBuilderSemanticSummary,
  buildReportBuilderSemanticValidationRequest,
  resolveReportBuilderSemanticModelProvider,
  resolveReportBuilderSemanticSummary,
} from "./reportBuilderSemantic.js";
import { useReportBuilderSemanticModelState } from "./useReportBuilderSemanticModelState.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

export function resolveReportBuilderSemanticRuntimeFallbackPreference({
  preferFallbackMetadata = null,
  providerAvailable = false,
  modelLoading = false,
  modelError = "",
  model = null,
} = {}) {
  if (preferFallbackMetadata != null) {
    return preferFallbackMetadata === true;
  }
  if (model && typeof model === "object" && !Array.isArray(model)) {
    return false;
  }
  return providerAvailable === true
    && modelLoading === true
    && !normalizeString(modelError);
}

export function resolveReportBuilderSemanticRuntimeFallbackAllowance({
  allowFallbackMetadata = null,
  providerAvailable = false,
  modelLoading = false,
  modelError = "",
  model = null,
} = {}) {
  if (allowFallbackMetadata != null) {
    return allowFallbackMetadata === true;
  }
  if (model && typeof model === "object" && !Array.isArray(model)) {
    return true;
  }
  return providerAvailable === true
    && modelLoading === true
    && !normalizeString(modelError);
}

export function resolveReportBuilderSemanticRuntimeState({
  config = {},
  state = {},
  binding = null,
  model = null,
  providerAvailable = false,
  modelLoading = false,
  modelError = "",
  fallbackSummary = null,
  fallbackFingerprint = "",
  allowFallbackMetadata = null,
  preferFallbackMetadata = null,
} = {}) {
  const semanticDisplayConfig = applyReportBuilderSemanticConfig(config, binding, model);
  const semanticSummary = buildReportBuilderSemanticSummary({
    config: semanticDisplayConfig,
    state,
    binding,
    model,
  });
  const semanticValidationRequest = buildReportBuilderSemanticValidationRequest(
    semanticDisplayConfig,
    state,
    binding,
  );
  const semanticValidationFingerprint = semanticValidationRequest
    ? JSON.stringify(semanticValidationRequest)
    : "";
  return {
    semanticDisplayConfig,
    semanticSummary,
    semanticValidationRequest,
    semanticValidationFingerprint,
    resolvedSemanticSummary: resolveReportBuilderSemanticSummary({
      currentSummary: semanticSummary,
      fallbackSummary,
      currentFingerprint: semanticValidationFingerprint,
      fallbackFingerprint,
      allowFallbackMetadata: resolveReportBuilderSemanticRuntimeFallbackAllowance({
        allowFallbackMetadata,
        providerAvailable,
        modelLoading,
        modelError,
        model,
      }),
      preferFallbackMetadata: resolveReportBuilderSemanticRuntimeFallbackPreference({
        preferFallbackMetadata,
        providerAvailable,
        modelLoading,
        modelError,
        model,
      }),
    }),
  };
}

export function useReportBuilderSemanticRuntimeState({
  builderContext = {},
  config = {},
  state = {},
  binding = null,
  configSemanticModel = null,
  reloadKey = "",
  fallbackSummary = null,
  fallbackFingerprint = "",
  preferFallbackMetadata = null,
} = {}) {
  const semanticModelRef = React.useMemo(
    () => normalizeString(binding?.modelRef),
    [binding?.modelRef],
  );
  const semanticModelProvider = React.useMemo(
    () => resolveReportBuilderSemanticModelProvider(builderContext),
    [builderContext?.handlers?.semanticModel],
  );
  const semanticModelState = useReportBuilderSemanticModelState({
    binding,
    configSemanticModel,
    semanticModelProvider,
    semanticModelRef,
    reloadKey,
  });
  const runtimeState = React.useMemo(
    () => resolveReportBuilderSemanticRuntimeState({
      config,
      state,
      binding,
      model: semanticModelState.model,
      providerAvailable: !!semanticModelProvider,
      modelLoading: semanticModelState.loading,
      modelError: semanticModelState.error,
      fallbackSummary,
      fallbackFingerprint,
      allowFallbackMetadata: null,
      preferFallbackMetadata,
    }),
    [binding, config, fallbackFingerprint, fallbackSummary, preferFallbackMetadata, semanticModelProvider, semanticModelState.error, semanticModelState.loading, semanticModelState.model, state],
  );
  return {
    semanticModelRef,
    semanticModelProvider,
    semanticModelState,
    ...runtimeState,
  };
}
