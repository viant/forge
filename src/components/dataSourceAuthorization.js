// An upstream denial after protected UI preflight invalidates prior results.
// Ordinary unprotected datasource errors retain their existing local behavior.
export function isDatasetScopedDenial(error) {
 return Number(error?.status)===403 && error?.code==='datasource_denied' && error?.scope==='dataset';
}

export function isWindowAuthorizationFailure(error) {
    const status = Number(error?.status);
    const rootResourceChanged=status===409 && ['conflict','resource_stale','resource_changed'].includes(error?.code);
    return !isDatasetScopedDenial(error) && (status === 401 || status === 403 || rootResourceChanged);
}

export function isProtectedUpstreamDenial(context,error) {
    return isWindowAuthorizationFailure(error)
        && !!(context?.metadata?.authorization || context?.metadata?.authorizationSnapshot)
        && !!String(context?.identity?.windowId || '').trim();
}
