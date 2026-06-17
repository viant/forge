function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

export function mergeReportBuilderReopenedConfig(baseConfig = {}, reopenedConfig = null) {
    if (!isPlainObject(reopenedConfig)) {
        return baseConfig;
    }
    const nextConfig = {
        ...(isPlainObject(baseConfig) ? baseConfig : {}),
        ...cloneValue(reopenedConfig),
    };
    if (!Array.isArray(nextConfig.reportDocumentSavedPayloads) && Array.isArray(baseConfig?.reportDocumentSavedPayloads)) {
        nextConfig.reportDocumentSavedPayloads = cloneValue(baseConfig.reportDocumentSavedPayloads);
    }
    if (!Array.isArray(nextConfig.reportDocumentListEntries) && Array.isArray(baseConfig?.reportDocumentListEntries)) {
        nextConfig.reportDocumentListEntries = cloneValue(baseConfig.reportDocumentListEntries);
    }
    if (!Array.isArray(nextConfig.reportDocumentTemplates) && Array.isArray(baseConfig?.reportDocumentTemplates)) {
        nextConfig.reportDocumentTemplates = cloneValue(baseConfig.reportDocumentTemplates);
    }
    return nextConfig;
}
