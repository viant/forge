function normalizeString(value = "") {
    return String(value || "").trim();
}

function normalizeBoolean(value) {
    return value === true;
}

function normalizeArray(value = []) {
    return Array.isArray(value) ? value : [];
}

function normalizeScopeCapability(capability = null) {
    const paramIds = normalizeArray(capability?.paramIds)
        .map((entry) => normalizeString(entry))
        .filter(Boolean);
    return {
        known: !!capability,
        supported: normalizeBoolean(capability?.supported),
        paramIds,
        disabledReason: "Add filters becomes available once the current builder state compiles shared scope parameters.",
    };
}

function normalizeRefinementCapability(capability = null) {
    return {
        known: !!capability,
        supported: normalizeBoolean(capability?.supported),
        hasFieldSupport: normalizeBoolean(capability?.hasFieldSupport),
        hasActiveRuntimeRefinements: normalizeBoolean(capability?.hasActiveRuntimeRefinements),
        hasActiveDrillTransitions: normalizeBoolean(capability?.hasActiveDrillTransitions),
        disabledReason: "Add refinements becomes available once the current builder state exposes runtime refinement-capable dimensions.",
    };
}

function normalizeChartCapability(capability = null) {
    const chartSpec = capability?.chartSpec && typeof capability.chartSpec === "object" && !Array.isArray(capability.chartSpec)
        ? capability.chartSpec
        : null;
    return {
        known: !!capability,
        supported: normalizeBoolean(capability?.supported),
        chartSpec,
        disabledReason: "Add chart becomes available once the current builder state compiles compatible chart fields.",
    };
}

function normalizeTableCapability(capability = null) {
    const columnKeys = normalizeArray(capability?.columnKeys)
        .map((entry) => normalizeString(entry))
        .filter(Boolean);
    return {
        known: !!capability,
        supported: normalizeBoolean(capability?.supported),
        columnKeys,
        disabledReason: "Add table becomes available once the current builder state compiles authored table columns.",
    };
}

function normalizeGeoCapability(capability = null) {
    return {
        known: !!capability,
        supported: normalizeBoolean(capability?.supported),
        geoKey: normalizeString(capability?.geoKey),
        metricKey: normalizeString(capability?.metricKey),
        disabledReason: "Add geo becomes available once the current builder state compiles compatible geo keys and metrics.",
    };
}

function normalizeKpiCapability(options = [], {
    known = false,
} = {}) {
    const optionCount = normalizeArray(options).length;
    return {
        known: known === true || optionCount > 0,
        supported: optionCount > 0,
        optionCount,
        disabledReason: "Add KPI becomes available once the current builder state exposes KPI value fields.",
    };
}

function buildAuthoredCapabilityNotes({
    scope = null,
    refinement = null,
    chart = null,
    table = null,
    geo = null,
    kpi = null,
} = {}) {
    const notes = [];
    if (kpi?.known && !kpi.supported) {
        notes.push({
            id: "kpi",
            message: "KPI blocks require at least one available measure in the current builder.",
        });
    }
    if (scope?.known && !scope.supported) {
        notes.push({
            id: "scope",
            message: "Filter bar blocks require at least one configured shared scope parameter in the current builder.",
        });
    }
    if (refinement?.known && !refinement.supported) {
        notes.push({
            id: "refinement",
            message: "Refinement blocks require runtime refinement-capable dimensions in the current builder.",
        });
    }
    if (chart?.known && !chart.supported) {
        notes.push({
            id: "chart",
            message: "Chart blocks require compatible compiled chart fields in the current builder.",
        });
    }
    if (table?.known && !table.supported) {
        notes.push({
            id: "table",
            message: "Table blocks require compatible compiled authored columns in the current builder.",
        });
    }
    if (geo?.known && !geo.supported) {
        notes.push({
            id: "geo",
            message: "Geo map blocks require compatible compiled geo keys and measures in the current builder.",
        });
    }
    return notes;
}

function buildAuthoredCapabilityActions({
    scope = null,
    refinement = null,
    chart = null,
    table = null,
    geo = null,
    kpi = null,
} = {}) {
    return [
        {
            id: "markdownBlock",
            label: "Add narrative",
            icon: "annotation",
            disabled: false,
            disabledReason: "",
        },
        {
            id: "filterBarBlock",
            label: "Add filters",
            icon: "filter",
            disabled: !scope?.supported,
            disabledReason: scope?.disabledReason || "",
        },
        {
            id: "refinementBarBlock",
            label: "Add refinements",
            icon: "changes",
            disabled: !refinement?.supported,
            disabledReason: refinement?.disabledReason || "",
        },
        {
            id: "geoMapBlock",
            label: "Add geo",
            icon: "map",
            disabled: !geo?.supported,
            disabledReason: geo?.disabledReason || "",
        },
        {
            id: "chartBlock",
            label: "Add chart",
            icon: "timeline-line-chart",
            disabled: !chart?.supported,
            disabledReason: chart?.disabledReason || "",
        },
        {
            id: "tableBlock",
            label: "Add table",
            icon: "th",
            disabled: !table?.supported,
            disabledReason: table?.disabledReason || "",
        },
        {
            id: "kpiBlock",
            label: "Add KPI",
            icon: "dashboard",
            disabled: !kpi?.supported,
            disabledReason: kpi?.disabledReason || "",
        },
    ];
}

function buildAuthoredActionGroups() {
    return [
        {
            id: "document",
            title: "Report Document",
            description: "Narrative, chart, table, and KPI building blocks for the report canvas.",
            actionIds: ["markdownBlock", "chartBlock", "tableBlock", "kpiBlock"],
        },
        {
            id: "runtime",
            title: "Filters & Runtime",
            description: "Filter, refinement, and geo controls that shape the live preview experience.",
            actionIds: ["filterBarBlock", "refinementBarBlock", "geoMapBlock"],
        },
    ];
}

export function buildReportBuilderAuthoredCapabilityViewModel({
    compiledRuntimePreviewModel = null,
    authoredKpiValueFieldOptions = [],
} = {}) {
    const compiledKnown = !!compiledRuntimePreviewModel;
    const scope = normalizeScopeCapability(compiledRuntimePreviewModel?.scopeCapability || null);
    const refinement = normalizeRefinementCapability(compiledRuntimePreviewModel?.refinementCapability || null);
    const chart = normalizeChartCapability(compiledRuntimePreviewModel?.chartCapability || null);
    const table = normalizeTableCapability(compiledRuntimePreviewModel?.tableCapability || null);
    const geo = normalizeGeoCapability(compiledRuntimePreviewModel?.geoCapability || null);
    const kpi = normalizeKpiCapability(authoredKpiValueFieldOptions, {
        known: compiledKnown,
    });
    const notes = buildAuthoredCapabilityNotes({
        scope,
        refinement,
        chart,
        table,
        geo,
        kpi,
    });
    const actions = buildAuthoredCapabilityActions({
        scope,
        refinement,
        chart,
        table,
        geo,
        kpi,
    });
    const actionGroups = buildAuthoredActionGroups();
    const showDisabledHint = notes.length > 0;

    return {
        scope,
        refinement,
        chart,
        table,
        geo,
        kpi,
        actions,
        actionGroups,
        notes,
        showDisabledHint,
        disabledHintText: showDisabledHint
            ? "Hover a disabled option to see which builder fields or shared scope parameters still need to be present."
            : "",
    };
}
