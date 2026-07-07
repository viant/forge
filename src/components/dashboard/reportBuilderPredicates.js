import { resolveKey } from "../../utils/selector.js";
import { getScopeParamValue, setScopeParamValue } from "../../reporting/scopeStateModel.js";
import { normalizeDynamicGroupRows } from "./reportBuilderDynamicRows.js";

// Unified predicate model.
//
// A source declares scope/filtering intent once via `config.predicates` (plus
// optional `config.predicateGroups` and `config.predicateBuckets`) instead of
// hand-writing the legacy split of `staticFilters`, `dynamicFilterGroups` and
// `dynamicFilterFamilies`.
//
// `predicateBuckets` declares presentation metadata (label, description,
// order) for the buckets referenced by neutral predicates, so no residual
// `dynamicFilterGroups` shell is needed:
//   predicateBuckets:
//     - { id: "scope", label: "Scope", description: "Add one scope line at a time." }
//
// Predicate declaration shape:
//   {
//     id: "publisher",
//     label: "Publisher",
//     group: "inventory",              // predicateGroups membership (grouped predicates)
//     pinned: true,                    // always-on scope predicate (kind: "value" | "dateRange")
//     kind: "dateRange",               // pinned kinds; dateRange implies pinned
//     required, multiple, options, default, presentation, semanticRef,
//     paramPath / startParamPath / endParamPath,
//     bucket: "scope",                 // dynamic group for neutral (non-directional) predicates
//     include: true | { paramPath, filterId, label, ...overrides },
//     exclude: true | { paramPath, filterId, label, ...overrides },
//     dialogId, lookup, targetingFeatureKey,
//     valueSelector, labelSelector, recordSelectors, groupSelector,
//     emitArray, manualEntry, manualValueType, manualPlaceholder, placeholder,
//     requestMapping, handledByHook,
//     prefill: "path" | ["path", ...] | { path } | { start, end } | { include, exclude },
//   }
//
// Every prefill key ("path", "start", "end", "include", "exclude") accepts a
// single path or an ordered list of fallback paths; the first path resolving a
// non-empty value wins. A bare array is shorthand for { path: [...] }. This
// lets one declaration serve payload variants (e.g. nested scope.audienceIds
// vs top-level audienceIds) without a custom hook.
//
// Predicates are lowered onto the existing runtime structures so request
// shaping, lookup hydration, persistence and the filter UI keep operating on
// one battle-tested representation.

const DIRECTION_FILTER_FIELDS = [
    "semanticRef",
    "dialogId",
    "multiple",
    "emitArray",
    "manualEntry",
    "manualValueType",
    "manualPlaceholder",
    "placeholder",
    "valueSelector",
    "labelSelector",
    "recordSelectors",
    "groupSelector",
    "targetingFeatureKey",
    "lookup",
    "requestMapping",
    "handledByHook",
];

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeArray(value) {
    if (Array.isArray(value)) {
        return value.filter((entry) => entry !== undefined && entry !== null && entry !== "");
    }
    if (value === undefined || value === null || value === "") {
        return [];
    }
    return [value];
}

function pascalCase(value = "") {
    const normalized = String(value || "").trim();
    if (!normalized) return "";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function normalizePrefillPaths(value) {
    return normalizeArray(value)
        .map((entry) => String(entry || "").trim())
        .filter(Boolean);
}

function normalizePredicatePrefill(entry) {
    const raw = entry?.prefill;
    if (typeof raw === "string" || Array.isArray(raw)) {
        const paths = normalizePrefillPaths(raw);
        return paths.length > 0 ? { path: paths } : null;
    }
    if (!isPlainObject(raw)) {
        return null;
    }
    const prefill = {};
    ["path", "start", "end", "include", "exclude"].forEach((key) => {
        const paths = normalizePrefillPaths(raw[key]);
        if (paths.length > 0) {
            prefill[key] = paths;
        }
    });
    return Object.keys(prefill).length > 0 ? prefill : null;
}

function buildPredicateDirection(entry = {}, predicate = {}, direction = "", spec = {}) {
    const overrides = isPlainObject(spec) ? spec : {};
    const fallbackFilterId = direction ? `${direction}${pascalCase(predicate.id)}` : predicate.id;
    const filterId = String(overrides.filterId || fallbackFilterId).trim();
    const paramPath = String(
        overrides.paramPath
        || (direction ? entry?.[`${direction}ParamPath`] : entry?.paramPath)
        || `filters.${filterId}`,
    ).trim();
    const filter = {
        id: filterId,
        label: String(overrides.label || predicate.label || filterId).trim(),
        paramPath,
    };
    DIRECTION_FILTER_FIELDS.forEach((field) => {
        const value = overrides[field] !== undefined ? overrides[field] : entry?.[field];
        if (value !== undefined) {
            filter[field] = clone(value);
        }
    });
    // Row predicates aggregate selections; arrays are the sensible default.
    if (filter.multiple === undefined) {
        filter.multiple = true;
    }
    if (filter.emitArray === undefined && filter.multiple !== false) {
        filter.emitArray = true;
    }
    const overridePaths = normalizePrefillPaths(overrides.prefill);
    const prefillPaths = overridePaths.length > 0
        ? overridePaths
        : (direction ? predicate.prefill?.[direction] : predicate.prefill?.path) || [];
    return {
        direction,
        groupId: direction || predicate.bucket,
        filter,
        prefillPaths,
    };
}

export function normalizeReportBuilderPredicates(config = {}) {
    return normalizeArray(config?.predicates).map((entry) => {
        if (!isPlainObject(entry)) {
            return null;
        }
        const id = String(entry.id || "").trim();
        if (!id) {
            return null;
        }
        const kind = String(entry.kind || "").trim().toLowerCase() === "daterange" ? "dateRange" : "value";
        const pinned = entry.pinned === true || kind === "dateRange";
        const predicate = {
            id,
            label: String(entry.label || id).trim(),
            description: String(entry.description || "").trim(),
            group: String(entry.group || "").trim(),
            kind,
            pinned,
            required: entry.required === true,
            multiple: entry.multiple,
            presentation: String(entry.presentation || "").trim(),
            semanticRef: String(entry.semanticRef || "").trim(),
            options: Array.isArray(entry.options) ? clone(entry.options) : undefined,
            default: entry.default !== undefined ? clone(entry.default) : undefined,
            paramPath: String(entry.paramPath || "").trim(),
            startParamPath: String(entry.startParamPath || "").trim(),
            endParamPath: String(entry.endParamPath || "").trim(),
            bucket: String(entry.bucket || "scope").trim() || "scope",
            prefill: normalizePredicatePrefill(entry),
            directions: [],
        };
        if (!pinned) {
            const hasInclude = entry.include !== undefined && entry.include !== false;
            const hasExclude = entry.exclude !== undefined && entry.exclude !== false;
            if (hasInclude) {
                predicate.directions.push(buildPredicateDirection(entry, predicate, "include", entry.include));
            }
            if (hasExclude) {
                predicate.directions.push(buildPredicateDirection(entry, predicate, "exclude", entry.exclude));
            }
            if (!hasInclude && !hasExclude) {
                predicate.directions.push(buildPredicateDirection(entry, predicate, "", {}));
            }
        }
        return predicate;
    }).filter(Boolean);
}

export function normalizeReportBuilderPredicateGroups(config = {}) {
    return normalizeArray(config?.predicateGroups).map((entry, index) => {
        if (!isPlainObject(entry)) {
            return null;
        }
        const id = String(entry.id || "").trim();
        if (!id) {
            return null;
        }
        return {
            id,
            label: String(entry.label || id).trim(),
            description: String(entry.description || "").trim(),
            icon: String(entry.icon || "").trim(),
            order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : index,
        };
    }).filter(Boolean);
}

export function normalizeReportBuilderPredicateBuckets(config = {}) {
    return normalizeArray(config?.predicateBuckets).map((entry, index) => {
        if (!isPlainObject(entry)) {
            return null;
        }
        const id = String(entry.id || "").trim();
        if (!id) {
            return null;
        }
        return {
            id,
            label: String(entry.label || id).trim(),
            description: String(entry.description || "").trim(),
            order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : index,
        };
    }).filter(Boolean);
}

export function hasReportBuilderPredicates(config = {}) {
    return normalizeReportBuilderPredicates(config).length > 0;
}

export function listReportBuilderPinnedPredicates(config = {}) {
    return normalizeReportBuilderPredicates(config).filter((predicate) => predicate.pinned);
}

function lowerPinnedPredicate(predicate) {
    const filter = {
        id: predicate.id,
        label: predicate.label,
    };
    if (predicate.description) {
        filter.description = predicate.description;
    }
    if (predicate.semanticRef) {
        filter.semanticRef = predicate.semanticRef;
    }
    if (predicate.kind === "dateRange") {
        filter.type = "dateRange";
        if (predicate.startParamPath) {
            filter.startParamPath = predicate.startParamPath;
        }
        if (predicate.endParamPath) {
            filter.endParamPath = predicate.endParamPath;
        }
    } else if (predicate.paramPath) {
        filter.paramPath = predicate.paramPath;
    }
    if (predicate.required) {
        filter.required = true;
    }
    if (predicate.multiple !== undefined) {
        filter.multiple = predicate.multiple === true;
    }
    if (predicate.presentation) {
        filter.presentation = predicate.presentation;
    }
    if (predicate.options !== undefined) {
        filter.options = clone(predicate.options);
    }
    if (predicate.default !== undefined) {
        filter.default = clone(predicate.default);
    }
    return filter;
}

// Effective pinned scope-param filter list for the authoring/report metadata
// layer. When pinned predicates exist they are the native source of scope
// params; `config.staticFilters` entries only contribute as residual
// unmatched filters, or as enrichment layered onto a matching pinned entry
// (e.g. semantic overlay metadata applied after lowering). Non-predicate
// configs fall back to legacy `config.staticFilters` unchanged.
export function resolveReportBuilderScopeParamFilters(config = {}) {
    const staticFilters = normalizeArray(config?.staticFilters).map((entry) => clone(entry));
    const pinnedPredicates = listReportBuilderPinnedPredicates(config);
    if (pinnedPredicates.length === 0) {
        return staticFilters;
    }
    const indexById = new Map();
    staticFilters.forEach((entry, index) => {
        const id = String(entry?.id || entry?.field || "").trim();
        if (id && !indexById.has(id)) {
            indexById.set(id, index);
        }
    });
    const filters = [...staticFilters];
    pinnedPredicates.forEach((predicate) => {
        const lowered = lowerPinnedPredicate(predicate);
        if (indexById.has(predicate.id)) {
            const index = indexById.get(predicate.id);
            filters[index] = { ...lowered, ...filters[index] };
            return;
        }
        indexById.set(predicate.id, filters.length);
        filters.push(lowered);
    });
    return filters;
}

function groupSeed(groupId = "", bucket = null) {
    if (bucket) {
        return {
            id: bucket.id,
            label: bucket.label,
            ...(bucket.description ? { description: bucket.description } : {}),
            filters: [],
        };
    }
    if (groupId === "include") {
        return { id: "include", label: "Include", filters: [] };
    }
    if (groupId === "exclude") {
        return { id: "exclude", label: "Exclude", filters: [] };
    }
    return { id: groupId, label: pascalCase(groupId), filters: [] };
}

// Shared canonical builder for the effective dynamic filter groups and
// families: legacy `dynamicFilterGroups` / `dynamicFilterFamilies` overlays
// win where they collide, and predicate declarations fill in the rest. Both
// lowering and the live resolvers derive from this single pass so the two
// paths cannot drift.
function buildEffectiveDynamicFilters(config = {}, predicates = []) {
    const dynamicFilterGroups = normalizeArray(config.dynamicFilterGroups).map((entry) => ({
        ...clone(entry),
        filters: normalizeArray(entry?.filters).map((filter) => clone(filter)),
    }));
    const groupById = new Map(dynamicFilterGroups.map((entry) => [String(entry?.id || "").trim(), entry]));
    const declaredBuckets = normalizeReportBuilderPredicateBuckets(config);
    const bucketById = new Map(declaredBuckets.map((entry) => [entry.id, entry]));
    const ensureGroup = (groupId) => {
        const id = String(groupId || "").trim();
        if (!id) return null;
        if (!groupById.has(id)) {
            const seeded = groupSeed(id, bucketById.get(id) || null);
            dynamicFilterGroups.push(seeded);
            groupById.set(id, seeded);
        }
        return groupById.get(id);
    };
    // Declared buckets seed groups up-front so bucket order and metadata match
    // the declaration, exactly as hand-written dynamicFilterGroups shells did.
    [...declaredBuckets]
        .sort((left, right) => left.order - right.order)
        .forEach((bucket) => ensureGroup(bucket.id));

    const familyMembership = new Map();
    const registerFamilyMember = (predicate, direction) => {
        if (!predicate.group || !direction.direction) {
            return;
        }
        if (!familyMembership.has(predicate.group)) {
            familyMembership.set(predicate.group, { includeFilterIds: [], excludeFilterIds: [] });
        }
        const membership = familyMembership.get(predicate.group);
        const key = direction.direction === "include" ? "includeFilterIds" : "excludeFilterIds";
        if (!membership[key].includes(direction.filter.id)) {
            membership[key].push(direction.filter.id);
        }
    };

    predicates.forEach((predicate) => {
        if (predicate.pinned) {
            return;
        }
        predicate.directions.forEach((direction) => {
            const group = ensureGroup(direction.groupId);
            if (!group) {
                return;
            }
            const exists = group.filters.some((entry) => String(entry?.id || "").trim() === direction.filter.id);
            if (!exists) {
                group.filters.push(clone(direction.filter));
            }
            registerFamilyMember(predicate, direction);
        });
    });

    const dynamicFilterFamilies = normalizeArray(config.dynamicFilterFamilies).map((entry) => clone(entry));
    const familyIds = new Set(dynamicFilterFamilies.map((entry) => String(entry?.id || "").trim()).filter(Boolean));
    const declaredGroups = normalizeReportBuilderPredicateGroups(config);
    const declaredGroupIds = new Set(declaredGroups.map((entry) => entry.id));
    const orderedFamilyIds = [
        ...declaredGroups.map((entry) => entry.id),
        ...Array.from(familyMembership.keys()).filter((id) => !declaredGroupIds.has(id)),
    ];
    orderedFamilyIds.forEach((groupId) => {
        const membership = familyMembership.get(groupId);
        if (!membership || familyIds.has(groupId)) {
            return;
        }
        const declared = declaredGroups.find((entry) => entry.id === groupId);
        const family = {
            id: groupId,
            label: declared?.label || pascalCase(groupId),
            includeFilterIds: membership.includeFilterIds,
            excludeFilterIds: membership.excludeFilterIds,
        };
        if (declared?.description) {
            family.description = declared.description;
        }
        if (declared?.icon) {
            family.icon = declared.icon;
        }
        if (declared) {
            family.order = declared.order;
        }
        dynamicFilterFamilies.push(family);
        familyIds.add(groupId);
    });

    return { dynamicFilterGroups, dynamicFilterFamilies };
}

export function lowerReportBuilderPredicates(config = {}) {
    const predicates = normalizeReportBuilderPredicates(config);
    if (predicates.length === 0) {
        return config;
    }

    const staticFilters = normalizeArray(config.staticFilters).map((entry) => clone(entry));
    const staticFilterIds = new Set(staticFilters.map((entry) => String(entry?.id || entry?.field || "").trim()).filter(Boolean));
    predicates.forEach((predicate) => {
        if (predicate.pinned && !staticFilterIds.has(predicate.id)) {
            staticFilters.push(lowerPinnedPredicate(predicate));
            staticFilterIds.add(predicate.id);
        }
    });

    const { dynamicFilterGroups, dynamicFilterFamilies } = buildEffectiveDynamicFilters(config, predicates);

    return {
        ...config,
        staticFilters,
        dynamicFilterGroups,
        dynamicFilterFamilies,
    };
}

// Effective dynamic filter groups for the live runtime layer, resolved
// canonical-first from predicate declarations plus compatibility overlays.
// Raw canonical configs (predicates / predicateBuckets / predicateGroups)
// resolve to the same structures lowering produces; already-lowered configs
// resolve to their existing groups unchanged (the shared builder is
// idempotent), and legacy non-predicate configs pass through their
// hand-written `dynamicFilterGroups`.
export function resolveReportBuilderDynamicFilterGroups(config = {}) {
    const predicates = normalizeReportBuilderPredicates(config);
    if (predicates.length === 0) {
        return normalizeArray(config?.dynamicFilterGroups);
    }
    return buildEffectiveDynamicFilters(config, predicates).dynamicFilterGroups;
}

// Effective dynamic filter families, mirroring
// resolveReportBuilderDynamicFilterGroups for `dynamicFilterFamilies`.
export function resolveReportBuilderDynamicFilterFamilies(config = {}) {
    const predicates = normalizeReportBuilderPredicates(config);
    if (predicates.length === 0) {
        return normalizeArray(config?.dynamicFilterFamilies);
    }
    return buildEffectiveDynamicFilters(config, predicates).dynamicFilterFamilies;
}

function resolvePrefillValue(source, paths) {
    for (const path of normalizePrefillPaths(paths)) {
        const value = resolveKey(source, path);
        if (value === undefined || value === null || value === "") {
            continue;
        }
        // An empty list carries no selections; keep trying fallback paths.
        if (Array.isArray(value) && value.length === 0) {
            continue;
        }
        return value;
    }
    return undefined;
}

function projectPrefillScalar(entry, valueSelector = "value") {
    if (!isPlainObject(entry)) {
        return entry;
    }
    const projected = resolveKey(entry, valueSelector) ?? entry.value ?? entry.id;
    return projected === undefined || projected === null || projected === "" ? undefined : projected;
}

function prefillPinnedValue(predicate, source) {
    const value = resolvePrefillValue(source, predicate.prefill?.path);
    if (value === undefined) {
        return undefined;
    }
    if (predicate.multiple === true || Array.isArray(value)) {
        const values = normalizeArray(value)
            .map((entry) => projectPrefillScalar(entry))
            .filter((entry) => entry !== undefined);
        return values.length > 0 ? values : undefined;
    }
    return projectPrefillScalar(value);
}

function prefillDateRangeValue(predicate, source, current) {
    const prefill = predicate.prefill || {};
    let start = resolvePrefillValue(source, prefill.start);
    let end = resolvePrefillValue(source, prefill.end);
    if (start === undefined && end === undefined && prefill.path) {
        const range = resolvePrefillValue(source, prefill.path);
        if (isPlainObject(range)) {
            start = range.start ?? range.from;
            end = range.end ?? range.to;
        }
    }
    if (start === undefined && end === undefined) {
        return undefined;
    }
    const base = isPlainObject(current) ? current : {};
    return {
        start: start !== undefined ? String(start) : String(base.start || ""),
        end: end !== undefined ? String(end) : String(base.end || ""),
    };
}

function buildPrefillSelections(rawValue) {
    return normalizeArray(rawValue).map((entry) => {
        if (isPlainObject(entry)) {
            return entry;
        }
        return { value: entry };
    });
}

export function applyReportBuilderPredicatePrefill(config = {}, state = {}, windowForm = {}) {
    const predicates = normalizeReportBuilderPredicates(config);
    if (predicates.length === 0) {
        return state;
    }
    const source = windowForm?.prefill;
    if (!isPlainObject(source)) {
        return state;
    }
    const groupById = new Map(
        resolveReportBuilderDynamicFilterGroups(config).map((entry) => [String(entry?.id || "").trim(), entry]),
    );

    let changed = false;
    let next = clone(state) || {};

    predicates.forEach((predicate) => {
        if (!predicate.prefill && predicate.directions.every((direction) => direction.prefillPaths.length === 0)) {
            return;
        }
        if (predicate.pinned) {
            const value = predicate.kind === "dateRange"
                ? prefillDateRangeValue(predicate, source, getScopeParamValue(next, predicate.id))
                : prefillPinnedValue(predicate, source);
            if (value === undefined) {
                return;
            }
            next = setScopeParamValue(next, predicate.id, value);
            changed = true;
            return;
        }
        predicate.directions.forEach((direction) => {
            if (direction.prefillPaths.length === 0) {
                return;
            }
            const rawValue = resolvePrefillValue(source, direction.prefillPaths);
            if (rawValue === undefined) {
                return;
            }
            const group = groupById.get(direction.groupId);
            if (!group) {
                return;
            }
            const candidate = {
                id: `prefill_${direction.filter.id}`,
                filterId: direction.filter.id,
                enabled: true,
                selections: buildPrefillSelections(rawValue),
            };
            const normalizedRows = normalizeDynamicGroupRows([candidate], group);
            if (normalizedRows.length === 0) {
                return;
            }
            const existingRows = normalizeArray(next?.dynamicGroups?.[direction.groupId])
                .filter((row) => String(row?.filterId || "").trim() !== direction.filter.id);
            next.dynamicGroups = {
                ...(next.dynamicGroups || {}),
                [direction.groupId]: [...existingRows, ...normalizedRows],
            };
            changed = true;
        });
    });

    return changed ? next : state;
}
