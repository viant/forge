const stable = (value) => JSON.stringify(value ?? null);

export function normalizeReportFilterRefreshMode(value) {
    return value === "apply" ? "apply" : "automatic";
}

function effectiveDynamicGroups(groups = {}) {
    return Object.fromEntries(Object.entries(groups || {}).map(([id, rows]) => [id,
        (Array.isArray(rows) ? rows : []).filter((row) => Array.isArray(row?.selections) && row.selections.length > 0)
            .map((row) => ({ filterId: row.filterId, enabled: row.enabled !== false,
                selections: row.selections.map((selection) => selection?.value ?? selection) })),
    ]));
}

export function reportFilterValuesChanged(previous = {}, next = {}) {
    return stable(previous.scopeParams || previous.staticFilters) !== stable(next.scopeParams || next.staticFilters)
        || stable(previous.reportOptions) !== stable(next.reportOptions)
        || stable(effectiveDynamicGroups(previous.dynamicGroups)) !== stable(effectiveDynamicGroups(next.dynamicGroups));
}
