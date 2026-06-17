function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

const SUPPORTED_REPORT_RUNTIME_HOST_INTENT_KINDS = new Set(["detailTarget"]);

export function normalizeReportRuntimeHostIntent(intent = {}) {
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) {
    return null;
  }
  const intentKind = normalizeString(intent.intentKind).trim();
  const targetRef = normalizeString(intent.targetRef);
  const navigationMode = normalizeString(intent.navigationMode);
  if (!SUPPORTED_REPORT_RUNTIME_HOST_INTENT_KINDS.has(intentKind) || !targetRef || !navigationMode) {
    return null;
  }
  return {
    intentKind,
    targetRef,
    navigationMode,
    parameters: intent.parameters && typeof intent.parameters === "object" && !Array.isArray(intent.parameters)
      ? cloneValue(intent.parameters)
      : {},
    ...(normalizeString(intent.title) ? { title: normalizeString(intent.title) } : {}),
    ...(normalizeString(intent.description) ? { description: normalizeString(intent.description) } : {}),
  };
}
