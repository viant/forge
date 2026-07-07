function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeGeneration(value = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function resolveReportRuntimePreviewRowsEffectAction({
  transitionType = "",
  inFlightRequestKey = "",
  requestKey = "",
  currentGeneration = 0,
} = {}) {
  const normalizedTransitionType = normalizeString(transitionType);
  const normalizedInFlightRequestKey = normalizeString(inFlightRequestKey);
  const normalizedRequestKey = normalizeString(requestKey);
  const normalizedCurrentGeneration = normalizeGeneration(currentGeneration);

  if (normalizedTransitionType === "reset" || normalizedTransitionType === "unavailable") {
    return {
      issueFetch: false,
      nextGeneration: normalizedCurrentGeneration + 1,
      nextInFlightRequestKey: "",
      requestGeneration: normalizedCurrentGeneration + 1,
    };
  }

  if (normalizedTransitionType !== "start") {
    return {
      issueFetch: false,
      nextGeneration: normalizedCurrentGeneration,
      nextInFlightRequestKey: normalizedInFlightRequestKey,
      requestGeneration: normalizedCurrentGeneration,
    };
  }

  if (!normalizedRequestKey || normalizedInFlightRequestKey === normalizedRequestKey) {
    return {
      issueFetch: false,
      nextGeneration: normalizedCurrentGeneration,
      nextInFlightRequestKey: normalizedInFlightRequestKey,
      requestGeneration: normalizedCurrentGeneration,
    };
  }

  return {
    issueFetch: true,
    nextGeneration: normalizedCurrentGeneration + 1,
    nextInFlightRequestKey: normalizedRequestKey,
    requestGeneration: normalizedCurrentGeneration + 1,
  };
}

export function resolveReportRuntimePreviewRowsDispatchPlan({
  transitionType = "",
  inFlightRequestKey = "",
  requestKey = "",
  currentGeneration = 0,
} = {}) {
  const normalizedTransitionType = normalizeString(transitionType);
  const effectAction = resolveReportRuntimePreviewRowsEffectAction({
    transitionType: normalizedTransitionType,
    inFlightRequestKey,
    requestKey,
    currentGeneration,
  });

  if (normalizedTransitionType === "noop") {
    return {
      applyState: false,
      issueFetch: false,
      nextGeneration: effectAction.nextGeneration,
      nextInFlightRequestKey: effectAction.nextInFlightRequestKey,
      requestGeneration: effectAction.requestGeneration,
    };
  }

  if (normalizedTransitionType === "start" && !effectAction.issueFetch) {
    return {
      applyState: false,
      issueFetch: false,
      nextGeneration: effectAction.nextGeneration,
      nextInFlightRequestKey: effectAction.nextInFlightRequestKey,
      requestGeneration: effectAction.requestGeneration,
    };
  }

  return {
    applyState: true,
    issueFetch: effectAction.issueFetch,
    nextGeneration: effectAction.nextGeneration,
    nextInFlightRequestKey: effectAction.nextInFlightRequestKey,
    requestGeneration: effectAction.requestGeneration,
  };
}

export function resolveReportRuntimePreviewRowsSettlementPlan({
  mounted = true,
  currentRequestKey = "",
  requestedRequestKey = "",
  currentGeneration = 0,
  requestGeneration = 0,
  inFlightRequestKey = "",
} = {}) {
  const normalizedCurrentRequestKey = normalizeString(currentRequestKey);
  const normalizedRequestedRequestKey = normalizeString(requestedRequestKey);
  const normalizedCurrentGeneration = normalizeGeneration(currentGeneration);
  const normalizedRequestGeneration = normalizeGeneration(requestGeneration);
  const shouldApply = !!mounted
    && normalizedCurrentRequestKey === normalizedRequestedRequestKey
    && normalizedCurrentGeneration === normalizedRequestGeneration;
  return {
    shouldApply,
    shouldReleaseInFlight: shouldApply
      && normalizeString(inFlightRequestKey) === normalizedRequestedRequestKey
      && normalizedCurrentGeneration === normalizedRequestGeneration,
  };
}
