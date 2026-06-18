function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeGeneration(value = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function shouldApplyReportBuilderChartQuerySettlement({
  mounted = true,
  currentRequestKey = "",
  requestedRequestKey = "",
  currentGeneration = 0,
  requestGeneration = 0,
} = {}) {
  if (!mounted) {
    return false;
  }
  return normalizeString(currentRequestKey) === normalizeString(requestedRequestKey)
    && normalizeGeneration(currentGeneration) === normalizeGeneration(requestGeneration);
}

export function shouldReleaseReportBuilderChartQueryInFlightKey({
  inFlightRequestKey = "",
  requestedRequestKey = "",
  currentGeneration = 0,
  requestGeneration = 0,
} = {}) {
  return normalizeString(inFlightRequestKey) === normalizeString(requestedRequestKey)
    && normalizeGeneration(currentGeneration) === normalizeGeneration(requestGeneration);
}

export function resolveReportBuilderChartQueryEffectAction({
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

  if (normalizedInFlightRequestKey === normalizedRequestKey) {
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

export function resolveReportBuilderChartQueryDispatchPlan({
  transitionType = "",
  inFlightRequestKey = "",
  requestKey = "",
  currentGeneration = 0,
} = {}) {
  const normalizedTransitionType = normalizeString(transitionType);
  const effectAction = resolveReportBuilderChartQueryEffectAction({
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

export function resolveReportBuilderChartQuerySettlementPlan({
  mounted = true,
  currentRequestKey = "",
  requestedRequestKey = "",
  currentGeneration = 0,
  requestGeneration = 0,
  inFlightRequestKey = "",
} = {}) {
  const shouldApply = shouldApplyReportBuilderChartQuerySettlement({
    mounted,
    currentRequestKey,
    requestedRequestKey,
    currentGeneration,
    requestGeneration,
  });
  return {
    shouldApply,
    shouldReleaseInFlight: shouldApply && shouldReleaseReportBuilderChartQueryInFlightKey({
      inFlightRequestKey,
      requestedRequestKey,
      currentGeneration,
      requestGeneration,
    }),
  };
}
