function normalizeTargetKey(targetContext = {}) {
    const capabilities = Array.isArray(targetContext?.capabilities)
        ? targetContext.capabilities.map((item) => String(item || '').trim()).filter(Boolean).sort()
        : [];
    return JSON.stringify({
        platform: String(targetContext?.platform || '').trim(),
        formFactor: String(targetContext?.formFactor || '').trim(),
        surface: String(targetContext?.surface || '').trim(),
        capabilities,
    });
}

export function isAuthorizationDataSource(context = null) {
    const dataSourceRef = String(context?.identity?.dataSourceRef || '').trim();
    const configuredRef = String(context?.metadata?.authorization?.dataSourceRef || '').trim();
    return dataSourceRef === 'resource_authorization' || (!!configuredRef && dataSourceRef === configuredRef);
}

export function isCurrentTargetMetadataReady(context = null) {
    if (!context?.metadata || isAuthorizationDataSource(context)) return true;
    if (context.metadata.__provisionalInline === true) return false;
    const metadataTargetKey = String(context.metadata.__targetKey || '').trim();
    const targetContext = context?._globalServices?.__connectorRuntime?.targetContext
        || context?.services?.__connectorRuntime?.targetContext
        || {};
    const currentTargetKey = normalizeTargetKey(targetContext);
    return !metadataTargetKey || metadataTargetKey === currentTargetKey;
}

export function reconcileFetchForMetadataReadiness(context = null, input = {}, control = {}) {
    if ((!input?.fetch && !input?.refresh) || isCurrentTargetMetadataReady(context)) return null;
    return {
        input: {...(input || {}), fetch: false, refresh: false},
        control: control?.loading === true
            ? {...(control || {}), loading: false, stale: false}
            : control,
    };
}
