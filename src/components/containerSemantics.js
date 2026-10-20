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

// Datasource mounts keep their effects and contexts, but own no visual space.
const bindingKeys = new Set(['id', 'dataSourceRef', 'fetchData', 'fetchOnce', 'selectFirst', 'containers', 'items', 'on', 'className', 'sizingMode', 'visibleWhen', 'hiddenWhen']);
export function isDataSourceBindingContainer(container = {}) {
    if (container.items?.length || Object.keys(container).some(key => !bindingKeys.has(key))) return false;
    if (container.containers?.length) return container.containers.every(isDataSourceBindingContainer);
    return Boolean(container.dataSourceRef);
}
