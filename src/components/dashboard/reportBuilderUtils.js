import { resolveKey } from "../../utils/selector.js";

function clone(value) {
    if (Array.isArray(value)) {
        return value.map((item) => clone(item));
    }
    if (value && typeof value === "object") {
        const result = {};
        Object.entries(value).forEach(([key, item]) => {
            result[key] = clone(item);
        });
        return result;
    }
    return value;
}

function setNestedValue(target, path, value) {
    const parts = String(path || "")
        .split(".")
        .map((entry) => entry.trim())
        .filter(Boolean);
    if (!parts.length) {
        return target;
    }
    let current = target;
    for (let i = 0; i < parts.length - 1; i += 1) {
        const part = parts[i];
        if (!current[part] || typeof current[part] !== "object" || Array.isArray(current[part])) {
            current[part] = {};
        }
        current = current[part];
    }
    current[parts[parts.length - 1]] = value;
    return target;
}

function normalizeArray(values = []) {
    return Array.isArray(values) ? values.filter(Boolean) : [];
}

function formatDateISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function resolveRelativeDateRangeDefault(seed = {}) {
    const preset = String(seed?.preset || "").trim().toLowerCase();
    if (!preset) {
        return null;
    }
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(end);
    switch (preset) {
        case "last7days":
        case "last_7_days":
        case "7d":
            start.setDate(end.getDate() - 6);
            break;
        case "last30days":
        case "last_30_days":
        case "30d":
            start.setDate(end.getDate() - 29);
            break;
        case "today":
            break;
        default:
            return null;
    }
    return {
        start: formatDateISO(start),
        end: formatDateISO(end),
    };
}

function defaultSelectedIds(items = [], fallbackCount = 1) {
    const explicit = normalizeArray(items)
        .filter((item) => item?.default)
        .map((item) => String(item.id || "").trim())
        .filter(Boolean);
    if (explicit.length > 0) {
        return explicit;
    }
    return normalizeArray(items)
        .slice(0, fallbackCount)
        .map((item) => String(item?.id || "").trim())
        .filter(Boolean);
}

function defaultStaticFilterValue(filter = {}) {
    if (filter.type === "dateRange") {
        const seeded = filter.default && typeof filter.default === "object" ? filter.default : {};
        const relative = resolveRelativeDateRangeDefault(seeded);
        if (relative) {
            return relative;
        }
        return {
            start: seeded.start || "",
            end: seeded.end || "",
        };
    }
    const defaults = normalizeArray(filter.options)
        .filter((option) => option?.default)
        .map((option) => option.value);
    if (filter.multiple) {
        return defaults;
    }
    return defaults[0] ?? "";
}

function normalizeDynamicRow(row = {}, group = {}, index = 0) {
    const filters = normalizeArray(group.filters);
    const firstFilterId = String(filters[0]?.id || "").trim();
    const rowId = String(row.id || `row_${index + 1}`).trim();
    return {
        id: rowId || `row_${index + 1}`,
        filterId: String(row.filterId || firstFilterId).trim(),
        selections: normalizeArray(row.selections).map((entry) => ({
            value: entry?.value,
            label: entry?.label,
            group: entry?.group || "",
            record: entry?.record ?? null,
        })),
    };
}

function rowHasSelections(row = {}) {
    return Array.isArray(row?.selections) && row.selections.length > 0;
}

function normalizeDynamicGroupRows(rows = [], group = {}) {
    const normalizedRows = normalizeArray(rows).map((row, index) => normalizeDynamicRow(row, group, index));
    const selectedRows = normalizedRows.filter((row) => rowHasSelections(row));
    const firstDraftRow = normalizedRows.find((row) => !rowHasSelections(row)) || null;
    return firstDraftRow ? [...selectedRows, firstDraftRow] : selectedRows;
}

function firstResolvedValue(record = null, selectors = []) {
    for (const selector of selectors) {
        const key = String(selector || "").trim();
        if (!key) continue;
        const value = resolveKey(record, key);
        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }
    return undefined;
}

function compactLookupRecord(filterDef = {}, record = {}) {
    if (!record || typeof record !== "object") {
        return null;
    }
    const selectors = [
        filterDef.valueSelector,
        filterDef.labelSelector,
        filterDef.groupSelector,
        ...(Array.isArray(filterDef.recordSelectors) ? filterDef.recordSelectors : []),
    ].map((entry) => String(entry || "").trim()).filter(Boolean);
    const compact = {};
    selectors.forEach((selector) => {
        const value = resolveKey(record, selector);
        if (value === undefined || value === null || value === "") {
            return;
        }
        compact[selector] = value;
    });
    return Object.keys(compact).length > 0 ? compact : null;
}

function isVisibleField(entry = {}) {
    if (!entry || typeof entry !== "object") {
        return false;
    }
    if (entry.hidden === true) {
        return false;
    }
    if (entry.visible === false) {
        return false;
    }
    if (entry.expose === false) {
        return false;
    }
    return true;
}

export function getVisibleReportBuilderMeasures(config = {}) {
    return normalizeArray(config.measures).filter((entry) => isVisibleField(entry));
}

export function getComputedReportBuilderMeasures(config = {}) {
    return normalizeArray(config.computedMeasures).filter((entry) => isVisibleField(entry));
}

export function getSelectableReportBuilderMeasures(config = {}) {
    return [
        ...getVisibleReportBuilderMeasures(config),
        ...getComputedReportBuilderMeasures(config),
    ];
}

export function getVisibleReportBuilderDimensions(config = {}) {
    return normalizeArray(config.dimensions).filter((entry) => isVisibleField(entry));
}

export function resolveReportBuilderMeasure(config = {}, id = "") {
    const targetId = String(id || "").trim();
    if (!targetId) {
        return null;
    }
    return getSelectableReportBuilderMeasures(config).find(
        (entry) => String(entry?.id || "").trim() === targetId,
    ) || null;
}

function normalizeComputedMeasure(definition = {}) {
    if (!definition || typeof definition !== "object") {
        return null;
    }
    const compute = definition.compute || {};
    return {
        ...definition,
        key: definition.key || definition.id,
        dependencies: normalizeArray(definition.dependencies || compute.dependencies).map((entry) => String(entry).trim()).filter(Boolean),
        compute,
    };
}

export function applyReportBuilderComputedMeasures(rows = [], config = {}) {
    const computedMeasures = getComputedReportBuilderMeasures(config).map((entry) => normalizeComputedMeasure(entry)).filter(Boolean);
    if (computedMeasures.length === 0) {
        return Array.isArray(rows) ? rows : [];
    }
    return normalizeArray(rows).map((row) => {
        const next = { ...(row || {}) };
        computedMeasures.forEach((definition) => {
            const outputKey = String(definition.key || definition.id || "").trim();
            if (!outputKey) {
                return;
            }
            const compute = definition.compute || {};
            switch (String(compute.type || "").trim().toLowerCase()) {
                case "ratio": {
                    const numeratorKey = String(compute.numerator || "").trim();
                    const denominatorKey = String(compute.denominator || "").trim();
                    const numerator = Number(resolveKey(next, numeratorKey));
                    const denominator = Number(resolveKey(next, denominatorKey));
                    const scale = Number(compute.scale || 1);
                    const decimals = Number.isFinite(Number(compute.decimals)) ? Number(compute.decimals) : null;
                    let value = 0;
                    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
                        value = (numerator / denominator) * scale;
                    }
                    if (decimals != null) {
                        value = Number(value.toFixed(decimals));
                    }
                    next[outputKey] = value;
                    break;
                }
                default:
                    break;
            }
        });
        return next;
    });
}

export function buildReportBuilderDefaultState(config = {}) {
    const measures = getSelectableReportBuilderMeasures(config);
    const dimensions = getVisibleReportBuilderDimensions(config);
    const staticFilters = normalizeArray(config.staticFilters);
    const dynamicFilterGroups = normalizeArray(config.dynamicFilterGroups);

    const selectedMeasures = defaultSelectedIds(measures);
    const selectedDimensions = defaultSelectedIds(
        dimensions.filter((entry) => entry?.default || entry?.chartAxis || entry?.required),
        0,
    );
    const dimensionFallback = selectedDimensions.length > 0 ? selectedDimensions : defaultSelectedIds(dimensions);

    const groupByDefault = String(config?.groupBy?.default || "").trim();
    const viewModes = normalizeArray(config?.result?.viewModes);
    const defaultViewMode = String(
        config?.result?.defaultMode || viewModes[0] || "chart",
    ).trim() || "chart";
    const orderFields = normalizeArray(config?.result?.orderFields || config?.orderFields);
    const defaultOrder = orderFields.find((entry) => entry?.default) || orderFields[0] || null;
    const defaultPageSize = Number(
        config?.result?.pageSize || config?.request?.limit || 50,
    ) || 50;

    const defaultStaticFilters = {};
    staticFilters.forEach((filter) => {
        const key = String(filter.id || filter.field || "").trim();
        if (!key) return;
        defaultStaticFilters[key] = defaultStaticFilterValue(filter);
    });

    const defaultDynamicGroups = {};
    dynamicFilterGroups.forEach((group) => {
        const key = String(group.id || "").trim();
        if (!key) return;
        const seededRows = normalizeArray(group.defaultRows).map((row, index) => normalizeDynamicRow(row, group, index));
        defaultDynamicGroups[key] = seededRows;
    });

    return {
        selectedMeasures,
        primaryMeasure: String(config?.primaryMeasure || selectedMeasures[0] || "").trim(),
        selectedDimensions: dimensionFallback,
        viewMode: defaultViewMode,
        groupBy: groupByDefault,
        page: 1,
        pageSize: defaultPageSize,
        orderField: String(defaultOrder?.value || defaultOrder?.field || "").trim(),
        orderDir: String(defaultOrder?.defaultDirection || "desc").trim().toLowerCase() || "desc",
        staticFilters: defaultStaticFilters,
        dynamicGroups: defaultDynamicGroups,
    };
}

export function mergeReportBuilderState(config = {}, persisted = {}) {
    const defaults = buildReportBuilderDefaultState(config);
    const dynamicFilterGroups = normalizeArray(config.dynamicFilterGroups);
    const next = {
        ...defaults,
        ...clone(persisted || {}),
        staticFilters: {
            ...defaults.staticFilters,
            ...(persisted?.staticFilters || {}),
        },
        dynamicGroups: {
            ...defaults.dynamicGroups,
        },
    };

    dynamicFilterGroups.forEach((group) => {
        const groupId = String(group.id || "").trim();
        if (!groupId) return;
        const persistedRows = normalizeArray(persisted?.dynamicGroups?.[groupId]);
        next.dynamicGroups[groupId] = normalizeDynamicGroupRows(persistedRows, group);
    });

    next.selectedMeasures = normalizeArray(next.selectedMeasures).map((entry) => String(entry).trim()).filter(Boolean);
    next.selectedDimensions = normalizeArray(next.selectedDimensions).map((entry) => String(entry).trim()).filter(Boolean);
    next.primaryMeasure = String(next.primaryMeasure || next.selectedMeasures[0] || defaults.primaryMeasure || "").trim();
    next.viewMode = String(next.viewMode || defaults.viewMode || "chart").trim() || "chart";
    next.groupBy = String(next.groupBy || defaults.groupBy || "").trim();
    next.page = Math.max(1, Number(next.page || defaults.page || 1) || 1);
    next.pageSize = Math.max(1, Number(next.pageSize || defaults.pageSize || 50) || 50);
    next.orderField = String(next.orderField || defaults.orderField || "").trim();
    next.orderDir = String(next.orderDir || defaults.orderDir || "desc").trim().toLowerCase() || "desc";

    if (!next.selectedMeasures.includes(next.primaryMeasure)) {
        next.primaryMeasure = next.selectedMeasures[0] || "";
    }
    return next;
}

export function sanitizeReportBuilderState(config = {}, state = {}) {
    const next = clone(state || {});
    const dynamicGroups = Array.isArray(next.dynamicGroups) ? {} : { ...(next.dynamicGroups || {}) };
    normalizeArray(config?.dynamicFilterGroups).forEach((group) => {
        const groupId = String(group?.id || "").trim();
        if (!groupId) return;
        dynamicGroups[groupId] = normalizeDynamicGroupRows(next?.dynamicGroups?.[groupId], group);
    });
    next.dynamicGroups = dynamicGroups;
    return next;
}

export function buildReportBuilderRequest(config = {}, state = {}) {
    const requestConfig = config.request || {};
    const resultConfig = config.result || {};
    const measures = normalizeArray(config.measures);
    const computedMeasures = normalizeArray(config.computedMeasures).map((entry) => normalizeComputedMeasure(entry)).filter(Boolean);
    const dimensions = normalizeArray(config.dimensions);
    const staticFilters = normalizeArray(config.staticFilters);
    const dynamicFilterGroups = normalizeArray(config.dynamicFilterGroups);
    const groupByOptions = normalizeArray(config?.groupBy?.options);
    const orderFields = normalizeArray(resultConfig.orderFields || config.orderFields);

    const request = clone(requestConfig.baseParameters || {});

    normalizeArray(state.selectedMeasures).forEach((id) => {
        const match = measures.find((item) => String(item?.id || "").trim() === String(id).trim());
        if (match) {
            setNestedValue(request, match.paramPath || `measures.${match.id}`, true);
            return;
        }
        const computed = computedMeasures.find((item) => String(item?.id || "").trim() === String(id).trim());
        if (!computed) return;
        computed.dependencies.forEach((dependencyId) => {
            const dependency = measures.find((item) => String(item?.id || "").trim() === String(dependencyId).trim());
            if (!dependency) return;
            setNestedValue(request, dependency.paramPath || `measures.${dependency.id}`, true);
        });
    });

    const selectedDimensionIds = new Set(
        normalizeArray(state.selectedDimensions).map((entry) => String(entry).trim()).filter(Boolean),
    );
    const groupByValue = String(state.groupBy || "").trim();
    if (groupByValue) {
        const groupByOption = groupByOptions.find((entry) => String(entry?.value || "").trim() === groupByValue);
        const dimensionId = String(groupByOption?.dimensionId || groupByValue).trim();
        if (dimensionId) {
            selectedDimensionIds.add(dimensionId);
        }
        if (groupByOption?.paramPath) {
            setNestedValue(request, groupByOption.paramPath, groupByOption.paramValue ?? true);
        }
    }

    Array.from(selectedDimensionIds).forEach((id) => {
        const match = dimensions.find((item) => String(item?.id || "").trim() === id);
        if (!match) return;
        setNestedValue(request, match.paramPath || `dimensions.${match.id}`, true);
    });

    staticFilters.forEach((filter) => {
        const filterId = String(filter.id || filter.field || "").trim();
        if (!filterId) return;
        const value = state?.staticFilters?.[filterId];
        if (filter.type === "dateRange") {
            if (value?.start && (filter.startParamPath || filter.paramPaths?.start)) {
                setNestedValue(request, filter.startParamPath || filter.paramPaths.start, value.start);
            }
            if (value?.end && (filter.endParamPath || filter.paramPaths?.end)) {
                setNestedValue(request, filter.endParamPath || filter.paramPaths.end, value.end);
            }
            return;
        }
        if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
            return;
        }
        const paramPath = filter.paramPath || `filters.${filterId}`;
        setNestedValue(request, paramPath, clone(value));
    });

    const dynamicAggregates = {};
    dynamicFilterGroups.forEach((group) => {
        const groupId = String(group.id || "").trim();
        if (!groupId) return;
        const rows = normalizeArray(state?.dynamicGroups?.[groupId]);
        rows.forEach((row) => {
            const filterDef = normalizeArray(group.filters).find((entry) => String(entry?.id || "").trim() === String(row.filterId || "").trim());
            if (!filterDef) return;
            if (filterDef.requestMapping === "hook" || filterDef.handledByHook === true) {
                return;
            }
            const paramPath = String(filterDef.paramPath || `filters.${filterDef.id}`).trim();
            const values = normalizeArray(row.selections).map((entry) => entry?.value).filter((entry) => entry !== undefined && entry !== null && entry !== "");
            if (!paramPath || values.length === 0) return;
            const emitArray = filterDef.emitArray === true || filterDef.valueMode === "array";
            if (filterDef.multiple === false && !emitArray) {
                dynamicAggregates[paramPath] = values[0];
                return;
            }
            dynamicAggregates[paramPath] = [
                ...normalizeArray(dynamicAggregates[paramPath]),
                ...values,
            ];
        });
    });

    Object.entries(dynamicAggregates).forEach(([paramPath, values]) => {
        if (Array.isArray(values)) {
            const unique = Array.from(new Set(values.map((entry) => JSON.stringify(entry)))).map((entry) => JSON.parse(entry));
            setNestedValue(request, paramPath, unique);
            return;
        }
        setNestedValue(request, paramPath, values);
    });

    const pageSize = Math.max(1, Number(state.pageSize || resultConfig.pageSize || requestConfig.limit || 50) || 50);
    const page = Math.max(1, Number(state.page || 1) || 1);
    request.limit = pageSize;
    request.offset = (page - 1) * pageSize;
    if (requestConfig.offset != null) {
        request.offset = requestConfig.offset;
    }
    if (requestConfig.timeoutMs != null) {
        request.timeoutMs = requestConfig.timeoutMs;
    }
    const selectedOrder = orderFields.find((entry) => {
        const value = String(entry?.value || entry?.field || "").trim();
        return value && value === String(state.orderField || "").trim();
    });
    if (selectedOrder) {
        const dir = String(state.orderDir || selectedOrder.defaultDirection || "desc").trim().toLowerCase() || "desc";
        if (Array.isArray(selectedOrder.orderBy) && selectedOrder.orderBy.length > 0) {
            request.orderBy = clone(selectedOrder.orderBy).map((entry) => String(entry).replace(/\$\{dir\}/g, dir));
        } else if (selectedOrder.orderByDesc && dir === "desc") {
            request.orderBy = [selectedOrder.orderByDesc];
        } else if (selectedOrder.orderByAsc && dir === "asc") {
            request.orderBy = [selectedOrder.orderByAsc];
        } else {
            const field = String(selectedOrder.field || selectedOrder.value || "").trim();
            if (field) {
                request.orderBy = [`${field} ${dir}`];
            }
        }
    } else if (requestConfig.orderBy) {
        request.orderBy = clone(requestConfig.orderBy);
    }
    return request;
}

export function resolveReportBuilderReadiness(config = {}, state = {}) {
    const selectedMeasures = normalizeArray(state?.selectedMeasures).map((entry) => String(entry).trim()).filter(Boolean);
    if (selectedMeasures.length === 0) {
        return { canRun: false, reason: "measure" };
    }

    const staticFilters = normalizeArray(config?.staticFilters);
    for (const filter of staticFilters) {
        if (!filter?.required) continue;
        const filterId = String(filter.id || filter.field || "").trim();
        if (!filterId) continue;
        const value = state?.staticFilters?.[filterId];
        if (filter.type === "dateRange") {
            if (!value?.start || !value?.end) {
                return { canRun: false, reason: "requiredFilter" };
            }
            continue;
        }
        if (filter.multiple) {
            if (!Array.isArray(value) || value.length === 0) {
                return { canRun: false, reason: "requiredFilter" };
            }
            continue;
        }
        if (value == null || value === "") {
            return { canRun: false, reason: "requiredFilter" };
        }
    }

    return { canRun: true, reason: "" };
}

export function canAutoFetchReportBuilder(config = {}, state = {}) {
    return resolveReportBuilderReadiness(config, state).canRun;
}

export function projectLookupSelection(filterDef = {}, record = {}) {
    const valueSelector = String(filterDef.valueSelector || filterDef.valueField || filterDef.field || "id").trim();
    const labelSelector = String(filterDef.labelSelector || filterDef.previewSelector || filterDef.labelField || valueSelector).trim();
    const groupSelector = String(filterDef.groupSelector || "").trim();
    const value = resolveKey(record, valueSelector);
    const label = resolveKey(record, labelSelector);
    const group = groupSelector ? resolveKey(record, groupSelector) : "";
    return {
        value,
        label: label == null || label === "" ? String(value ?? "") : String(label),
        group: group == null ? "" : String(group),
        record: compactLookupRecord(filterDef, record),
    };
}

export function projectLookupSelections(filterDef = {}, payload = null) {
    const records = Array.isArray(payload)
        ? payload
        : (payload == null ? [] : [payload]);
    return records
        .filter((record) => record && typeof record === "object")
        .map((record) => projectLookupSelection(filterDef, record));
}

export function buildReportBuilderColumns(config = {}, state = {}) {
    const measures = getSelectableReportBuilderMeasures(config);
    const dimensions = normalizeArray(config.dimensions);

    const selectedDimensions = normalizeArray(state.selectedDimensions)
        .map((id) => dimensions.find((entry) => String(entry?.id || "").trim() === String(id).trim()))
        .filter(Boolean)
        .map((entry) => ({
            key: entry.key || entry.id,
            label: entry.label || entry.id,
            kind: "dimension",
            format: entry.format,
        }));

    const selectedMeasures = normalizeArray(state.selectedMeasures)
        .map((id) => measures.find((entry) => String(entry?.id || "").trim() === String(id).trim()))
        .filter(Boolean)
        .map((entry) => ({
            key: entry.key || entry.id,
            label: entry.label || entry.id,
            kind: "measure",
            format: entry.format,
            align: entry.align || "right",
        }));

    return [...selectedDimensions, ...selectedMeasures];
}

export function addDynamicFilterRow(state = {}, group = {}) {
    const groupId = String(group.id || "").trim();
    if (!groupId) return state;
    const nextRows = normalizeArray(state?.dynamicGroups?.[groupId]).map((row, index) => normalizeDynamicRow(row, group, index));
    nextRows.push(normalizeDynamicRow({}, group, nextRows.length));
    return {
        ...state,
        dynamicGroups: {
            ...(state.dynamicGroups || {}),
            [groupId]: normalizeDynamicGroupRows(nextRows, group),
        },
    };
}

export function updateDynamicFilterRow(state = {}, group = {}, rowId = "", patch = {}) {
    const groupId = String(group.id || "").trim();
    if (!groupId || !rowId) return state;
    const nextRows = normalizeArray(state?.dynamicGroups?.[groupId]).map((row, index) => {
        const normalized = normalizeDynamicRow(row, group, index);
        if (normalized.id !== rowId) {
            return normalized;
        }
        return normalizeDynamicRow({
            ...normalized,
            ...patch,
        }, group, index);
    });
    return {
        ...state,
        dynamicGroups: {
            ...(state.dynamicGroups || {}),
            [groupId]: normalizeDynamicGroupRows(nextRows, group),
        },
    };
}

export function removeDynamicFilterRow(state = {}, group = {}, rowId = "") {
    const groupId = String(group.id || "").trim();
    if (!groupId || !rowId) return state;
    return {
        ...state,
        dynamicGroups: {
            ...(state.dynamicGroups || {}),
            [groupId]: normalizeDynamicGroupRows(
                normalizeArray(state?.dynamicGroups?.[groupId]).filter((row) => String(row?.id || "").trim() !== rowId),
                group,
            ),
        },
    };
}
