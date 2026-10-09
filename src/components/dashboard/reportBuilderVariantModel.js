function normalizeString(value = "") {
    return String(value || "").trim();
}

export function resolveReportBuilderVariant(container = {}, windowForm = {}) {
    const dashboard = container?.dashboard || {};
    const variants = dashboard?.reportBuilders && typeof dashboard.reportBuilders === "object"
        ? dashboard.reportBuilders
        : {};
    const requestedRef = normalizeString(windowForm?.reportBuilderRef);
    const defaultRef = normalizeString(dashboard?.reportBuilderRef || container?.reportBuilderRef);
    const builderRef = requestedRef || defaultRef;
    const variant = builderRef && variants[builderRef] && typeof variants[builderRef] === "object"
        ? variants[builderRef]
        : null;

    if (requestedRef && !variant && Object.keys(variants).length > 0) {
        return {
            builderRef: requestedRef,
            dataSourceRef: "",
            reportBuilder: {},
            missing: true,
        };
    }

    return {
        builderRef,
        dataSourceRef: normalizeString(variant?.dataSourceRef || container?.dataSourceRef),
        reportBuilder: variant?.reportBuilder
            || dashboard?.reportBuilder
            || container?.reportBuilder
            || container?.builder
            || {},
        label: normalizeString(variant?.label),
        missing: false,
    };
}

export function resolveReportBuilderVariantStateKey(container = {}, variant = {}) {
    const base = normalizeString(container?.stateKey || container?.id || "reportBuilder") || "reportBuilder";
    const builderRef = normalizeString(variant?.builderRef);
    return builderRef ? `${base}:${builderRef}` : base;
}

// A declared shared variant may retain reports saved before it was hosted under
// the shared container. Alias only its exact historical identity, never another
// container, arbitrary state namespace, or datasource.
export function resolveDeclaredReportBuilderSourceAliases(container = {}, builderIdentity = {}) {
    const containerId = normalizeString(container.id);
    const targetId = normalizeString(builderIdentity.containerId || containerId);
    const targetStateKey = normalizeString(builderIdentity.stateKey);
    const targetDataSource = normalizeString(builderIdentity.dataSourceRef || container.dataSourceRef);
    if (!containerId || targetId !== containerId || !targetStateKey || !targetDataSource) return [];
    const declared = container.dashboard?.reportBuilders || {};
    const defaultRef = normalizeString(container.dashboard?.reportBuilderRef || container.reportBuilderRef);
    const refs = new Set([...Object.keys(declared), ...(defaultRef ? [defaultRef] : [])]);
    for (const builderRef of refs) {
        const variant = resolveReportBuilderVariant(container, {reportBuilderRef: builderRef});
        if (variant.missing || variant.dataSourceRef !== targetDataSource
            || resolveReportBuilderVariantStateKey(container, variant) !== targetStateKey) continue;
        return [builderRef, `${builderRef}:${builderRef}`].map(stateKey => ({
            kind: 'dashboard.reportBuilder', containerId: builderRef,
            stateKey, dataSourceRef: targetDataSource,
        }));
    }
    return [];
}
