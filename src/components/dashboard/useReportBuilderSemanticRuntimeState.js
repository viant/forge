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

export function resolveReportBuilderSemanticRuntimeState({
  config = {},
  state = {},
  binding = null,
  model = null,
  fallbackSummary = null,
  fallbackFingerprint = "",
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
      preferFallbackMetadata: preferFallbackMetadata == null ? !model : preferFallbackMetadata === true,
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
      fallbackSummary,
      fallbackFingerprint,
      preferFallbackMetadata,
    }),
    [binding, config, fallbackFingerprint, fallbackSummary, preferFallbackMetadata, semanticModelState.model, state],
  );
  return {
    semanticModelRef,
    semanticModelProvider,
    semanticModelState,
    ...runtimeState,
  };
}
