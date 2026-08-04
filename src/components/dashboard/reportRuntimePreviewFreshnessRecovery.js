function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeRetryCount(value = 0) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export const REPORT_RUNTIME_PREVIEW_MAX_DEFERRED_RETRIES = 1;

export function resolveReportRuntimePreviewFreshnessRecovery({
  deferred = false,
  requestKey = "",
  recoveryState = null,
  maxDeferredRetries = REPORT_RUNTIME_PREVIEW_MAX_DEFERRED_RETRIES,
} = {}) {
  const normalizedRequestKey = normalizeString(requestKey);
  const resetState = Object.freeze({ requestKey: "", retryCount: 0 });
  if (deferred !== true) {
    return Object.freeze({ action: "accept", recoveryState: resetState });
  }
  if (!normalizedRequestKey) {
    return Object.freeze({ action: "fail", recoveryState: resetState });
  }
  const retryLimit = normalizeRetryCount(maxDeferredRetries);
  const priorRetryCount = normalizeString(recoveryState?.requestKey) === normalizedRequestKey
    ? normalizeRetryCount(recoveryState?.retryCount)
    : 0;
  if (priorRetryCount >= retryLimit) {
    return Object.freeze({
      action: "fail",
      recoveryState: Object.freeze({
        requestKey: normalizedRequestKey,
        retryCount: priorRetryCount,
      }),
    });
  }
  return Object.freeze({
    action: "retry",
    recoveryState: Object.freeze({
      requestKey: normalizedRequestKey,
      retryCount: priorRetryCount + 1,
    }),
  });
}

export function buildReportRuntimePreviewFreshnessError({
  requestKey = "",
  scope = "runtime preview",
} = {}) {
  const normalizedScope = normalizeString(scope) || "runtime preview";
  const normalizedRequestKey = normalizeString(requestKey);
  const error = new Error(
    `The ${normalizedScope} returned deferred cache data twice without a fresh terminal result.`
      + (normalizedRequestKey ? ` Request key: ${normalizedRequestKey}.` : ""),
  );
  error.code = "runtimePreviewFreshnessUnavailable";
  return error;
}
