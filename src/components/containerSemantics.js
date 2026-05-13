export function isSemanticDashboardBlock(container = {}) {
    return typeof container?.kind === 'string' && container.kind.startsWith('dashboard.');
}

export function shouldSkipGenericNonVisualEarlyReturn(container = {}) {
    return isSemanticDashboardBlock(container);
}
