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
