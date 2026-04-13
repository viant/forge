export function appendTargetContextQuery(queryParams, targetContext = {}) {
    if (!queryParams || !targetContext || typeof targetContext !== 'object') return queryParams;
    const platform = String(targetContext.platform || '').trim();
    const formFactor = String(targetContext.formFactor || '').trim();
    const surface = String(targetContext.surface || '').trim();
    const capabilities = Array.isArray(targetContext.capabilities)
        ? targetContext.capabilities.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
    if (platform) queryParams.append('platform', platform);
    if (formFactor) queryParams.append('formFactor', formFactor);
    if (surface) queryParams.append('surface', surface);
    capabilities.forEach((value) => queryParams.append('capabilities', value));
    return queryParams;
}
