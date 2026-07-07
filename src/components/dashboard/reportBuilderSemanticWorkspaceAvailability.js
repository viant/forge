function normalizeString(value = "") {
    return String(value || "").trim();
}

export function shouldShowReportBuilderSemanticWorkspace({
    binding = null,
    providerAvailable = false,
    configuredSemanticModel = null,
    activationCount = 0,
} = {}) {
    const normalizedBindingMode = normalizeString(binding?.mode).toLowerCase();
    if (normalizedBindingMode === "semantic") {
        return true;
    }
    if (providerAvailable === true) {
        return true;
    }
    if ((Number(activationCount || 0) || 0) > 0) {
        return true;
    }
    return !!configuredSemanticModel
        && typeof configuredSemanticModel === "object"
        && !Array.isArray(configuredSemanticModel);
}
