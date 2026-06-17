function normalizeString(value = "") {
  return String(value || "").trim();
}

export function buildReportRuntimeDiagnosticsViewModel(diagnostics = []) {
  const normalizedDiagnostics = (Array.isArray(diagnostics) ? diagnostics : [])
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }
      const severity = normalizeString(entry?.severity || "info").toLowerCase();
      const code = normalizeString(entry?.code || "diagnostic");
      if (code === "runtimeRefinementUnsupported") {
        return null;
      }
      const blockId = normalizeString(entry?.blockId);
      const path = normalizeString(entry?.path);
      const suggestedFix = normalizeString(entry?.suggestedFix);
      return {
        code,
        severity,
        message: normalizeString(entry?.message || entry?.code || "Unknown runtime diagnostic."),
        ...(blockId ? { blockId } : {}),
        ...(path ? { path } : {}),
        ...(suggestedFix ? { suggestedFix } : {}),
      };
    })
    .filter(Boolean);
  return {
    hasDiagnostics: normalizedDiagnostics.length > 0,
    diagnostics: normalizedDiagnostics,
  };
}

export function buildReportRuntimeHostIntentViewModel(hostIntent = null, {
  canClearHostIntent = false,
} = {}) {
  if (!hostIntent || typeof hostIntent !== "object" || Array.isArray(hostIntent)) {
    return {
      hasHostIntent: false,
      hostIntent: null,
      canClearHostIntent: false,
    };
  }
  const parameters = hostIntent?.parameters && typeof hostIntent.parameters === "object" && !Array.isArray(hostIntent.parameters)
    ? Object.entries(hostIntent.parameters)
    : [];
  return {
    hasHostIntent: true,
    hostIntent: {
      title: normalizeString(hostIntent?.title || "Resolved Host Intent"),
      description: normalizeString(hostIntent?.description || "Ready for host/runtime routing outside Forge."),
      intentKind: normalizeString(hostIntent?.intentKind),
      navigationMode: normalizeString(hostIntent?.navigationMode),
      targetRef: normalizeString(hostIntent?.targetRef),
      parameters: parameters.map(([key, value]) => ({
        key,
        value: String(value ?? ""),
      })),
    },
    canClearHostIntent: canClearHostIntent === true,
  };
}
