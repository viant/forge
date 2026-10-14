// An upstream denial after protected UI preflight invalidates prior results.
// Ordinary unprotected datasource errors retain their existing local behavior.
export function isDatasetScopedDenial(error) {
 return Number(error?.status)===403 && error?.code==='datasource_denied' && error?.scope==='dataset';
}

// A canonical datasource failure clears its affected data. An unclassified
// 403 does not prove that the window artifact or identity was denied.
export function isDataSourceLocalDenial(error, context = null) {
    return isDatasetScopedDenial(error) || ((context?.identity?.canonicalDelivery === true || context?.identity?.windowOpenOnly === true)
        && Number(error?.status) === 403 && !isWindowAuthorizationFailure(error, context));
}

export function isWindowAuthorizationFailure(error, context = null) {
    const status = Number(error?.status);
    const rootResourceChanged=status===409 && ['conflict','resource_stale','resource_changed'].includes(error?.code);
    if (context?.identity?.windowOpenOnly === true && status === 403) {
        return error?.code === 'resource_denied'
            && ['window','artifact','namespace','identity'].includes(error?.scope);
    }
    if (context?.identity?.canonicalDelivery === true && status === 403) {
        return error?.code === 'resource_denied'
            && ['window', 'artifact', 'namespace', 'identity'].includes(error?.scope);
    }
    return !isDatasetScopedDenial(error) && (status === 401 || status === 403 || rootResourceChanged);
}

export function isProtectedUpstreamDenial(context,error) {
    return isWindowAuthorizationFailure(error, context)
        && !!(context?.identity?.protectedWindow || context?.metadata?.authorization || context?.metadata?.authorizationSnapshot)
        && !!String(context?.identity?.windowId || '').trim();
}
