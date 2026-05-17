export function isSemanticDashboardBlock(container = {}) {
    return typeof container?.kind === 'string' && container.kind.startsWith('dashboard.');
}

export function isDashboardRootContainer(container = {}, context = null) {
    if (context?.dashboardKey) {
        return false;
    }
    if (isSemanticDashboardBlock(container)) {
        return false;
    }
    return container?.kind === 'dashboard' || !!container?.dashboard;
}

export function shouldSkipGenericNonVisualEarlyReturn(container = {}) {
    return isSemanticDashboardBlock(container);
}
