import React from "react";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function hasSemanticModelStateValue(state = {}) {
  return !!state?.loading || !!normalizeString(state?.error) || !!state?.model;
}

export function buildReportBuilderSemanticModelReloadKey(session = null) {
  if (!session || typeof session !== "object" || Array.isArray(session)) {
    return "";
  }
  const reportId = normalizeString(session?.reportId);
  const documentVersion = Number(session?.documentVersion || 0) || 0;
  if (!reportId || documentVersion < 1) {
    return "";
  }
  return `${reportId}::${documentVersion}`;
}

export function resolveReportBuilderSemanticModelSeedState({
  binding = null,
  configSemanticModel = null,
  semanticModelProvider = null,
  semanticModelRef = "",
  currentState = {},
} = {}) {
  if (binding?.mode !== "semantic") {
    return hasSemanticModelStateValue(currentState)
      ? { loading: false, error: "", model: null }
      : currentState;
  }
  if (configSemanticModel && typeof configSemanticModel === "object") {
    return {
      loading: false,
      error: "",
      model: configSemanticModel,
    };
  }
  if (!semanticModelProvider) {
    return {
      loading: false,
      error: "",
      model: null,
    };
  }
  if (!semanticModelRef) {
    return {
      loading: false,
      error: "",
      model: null,
    };
  }
  return {
    loading: true,
    error: "",
    model: currentState.model && currentState.model.modelRef === semanticModelRef ? currentState.model : null,
  };
}

export function useReportBuilderSemanticModelState({
  binding = null,
  configSemanticModel = null,
  semanticModelProvider = null,
  semanticModelRef = "",
  reloadKey = "",
} = {}) {
  const [semanticModelState, setSemanticModelState] = React.useState(() => resolveReportBuilderSemanticModelSeedState({
    binding,
    configSemanticModel,
    semanticModelProvider,
    semanticModelRef,
    currentState: {
      loading: false,
      error: "",
      model: null,
    },
  }));

  React.useEffect(() => {
    const seedState = resolveReportBuilderSemanticModelSeedState({
      binding,
      configSemanticModel,
      semanticModelProvider,
      semanticModelRef,
      currentState: semanticModelState,
    });
    if (seedState !== semanticModelState) {
      setSemanticModelState(seedState);
    }
    if (seedState.loading !== true) {
      return undefined;
    }
    let cancelled = false;
    semanticModelProvider.getModel(semanticModelRef)
      .then((payload) => {
        if (cancelled) return;
        setSemanticModelState({
          loading: false,
          error: "",
          model: payload,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setSemanticModelState({
          loading: false,
          error: error?.message || "Failed to load semantic model.",
          model: null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [binding?.mode, configSemanticModel, semanticModelProvider, semanticModelRef, reloadKey]);

  return semanticModelState;
}
