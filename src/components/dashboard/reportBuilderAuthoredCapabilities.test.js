import assert from "node:assert/strict";

import { buildReportBuilderAuthoredCapabilityViewModel } from "./reportBuilderAuthoredCapabilities.js";

assert.deepEqual(buildReportBuilderAuthoredCapabilityViewModel({
    compiledRuntimePreviewModel: null,
    authoredKpiValueFieldOptions: [],
}), {
    scope: {
        known: false,
        supported: false,
        paramIds: [],
        disabledReason: "Add filters becomes available once the current builder state compiles shared scope parameters.",
    },
    refinement: {
        known: false,
        supported: false,
        hasFieldSupport: false,
        hasActiveRuntimeRefinements: false,
        hasActiveDrillTransitions: false,
        disabledReason: "Add refinements becomes available once the current builder state exposes runtime refinement-capable dimensions.",
    },
    chart: {
        known: false,
        supported: false,
        chartSpec: null,
        disabledReason: "Add chart becomes available once the current builder state compiles compatible chart fields.",
    },
    table: {
        known: false,
        supported: false,
        columnKeys: [],
        disabledReason: "Add table becomes available once the current builder state compiles authored table columns.",
    },
    geo: {
        known: false,
        supported: false,
        geoKey: "",
        metricKey: "",
        disabledReason: "Add geo becomes available once the current builder state compiles compatible geo keys and metrics.",
    },
    kpi: {
        known: false,
        supported: false,
        optionCount: 0,
        disabledReason: "Add KPI becomes available once the current builder state exposes KPI value fields.",
    },
    actions: [
        { id: "markdownBlock", label: "Add narrative", icon: "annotation", disabled: false, disabledReason: "" },
        { id: "filterBarBlock", label: "Add filters", icon: "filter", disabled: true, disabledReason: "Add filters becomes available once the current builder state compiles shared scope parameters." },
        { id: "refinementBarBlock", label: "Add refinements", icon: "changes", disabled: true, disabledReason: "Add refinements becomes available once the current builder state exposes runtime refinement-capable dimensions." },
        { id: "geoMapBlock", label: "Add geo", icon: "map", disabled: true, disabledReason: "Add geo becomes available once the current builder state compiles compatible geo keys and metrics." },
        { id: "chartBlock", label: "Add chart", icon: "timeline-line-chart", disabled: true, disabledReason: "Add chart becomes available once the current builder state compiles compatible chart fields." },
        { id: "tableBlock", label: "Add table", icon: "th", disabled: true, disabledReason: "Add table becomes available once the current builder state compiles authored table columns." },
        { id: "kpiBlock", label: "Add KPI", icon: "dashboard", disabled: true, disabledReason: "Add KPI becomes available once the current builder state exposes KPI value fields." },
    ],
    actionGroups: [
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
    ],
    notes: [],
    showDisabledHint: false,
    disabledHintText: "",
});

assert.deepEqual(buildReportBuilderAuthoredCapabilityViewModel({
    compiledRuntimePreviewModel: {
        scopeCapability: { supported: true, paramIds: ["dateRange"] },
        refinementCapability: {
            supported: true,
            hasFieldSupport: true,
            hasActiveRuntimeRefinements: false,
            hasActiveDrillTransitions: false,
        },
        chartCapability: {
            supported: true,
            chartSpec: { type: "line", xField: "channelV2", yFields: ["avails"] },
        },
        tableCapability: {
            supported: true,
            columnKeys: ["channelV2", "avails"],
        },
        geoCapability: {
            supported: true,
            geoKey: "country",
            metricKey: "avails",
        },
    },
    authoredKpiValueFieldOptions: [{ value: "avails", label: "Avails" }],
}), {
    scope: {
        known: true,
        supported: true,
        paramIds: ["dateRange"],
        disabledReason: "Add filters becomes available once the current builder state compiles shared scope parameters.",
    },
    refinement: {
        known: true,
        supported: true,
        hasFieldSupport: true,
        hasActiveRuntimeRefinements: false,
        hasActiveDrillTransitions: false,
        disabledReason: "Add refinements becomes available once the current builder state exposes runtime refinement-capable dimensions.",
    },
    chart: {
        known: true,
        supported: true,
        chartSpec: { type: "line", xField: "channelV2", yFields: ["avails"] },
        disabledReason: "Add chart becomes available once the current builder state compiles compatible chart fields.",
    },
    table: {
        known: true,
        supported: true,
        columnKeys: ["channelV2", "avails"],
        disabledReason: "Add table becomes available once the current builder state compiles authored table columns.",
    },
    geo: {
        known: true,
        supported: true,
        geoKey: "country",
        metricKey: "avails",
        disabledReason: "Add geo becomes available once the current builder state compiles compatible geo keys and metrics.",
    },
    kpi: {
        known: true,
        supported: true,
        optionCount: 1,
        disabledReason: "Add KPI becomes available once the current builder state exposes KPI value fields.",
    },
    actions: [
        { id: "markdownBlock", label: "Add narrative", icon: "annotation", disabled: false, disabledReason: "" },
        { id: "filterBarBlock", label: "Add filters", icon: "filter", disabled: false, disabledReason: "Add filters becomes available once the current builder state compiles shared scope parameters." },
        { id: "refinementBarBlock", label: "Add refinements", icon: "changes", disabled: false, disabledReason: "Add refinements becomes available once the current builder state exposes runtime refinement-capable dimensions." },
        { id: "geoMapBlock", label: "Add geo", icon: "map", disabled: false, disabledReason: "Add geo becomes available once the current builder state compiles compatible geo keys and metrics." },
        { id: "chartBlock", label: "Add chart", icon: "timeline-line-chart", disabled: false, disabledReason: "Add chart becomes available once the current builder state compiles compatible chart fields." },
        { id: "tableBlock", label: "Add table", icon: "th", disabled: false, disabledReason: "Add table becomes available once the current builder state compiles authored table columns." },
        { id: "kpiBlock", label: "Add KPI", icon: "dashboard", disabled: false, disabledReason: "Add KPI becomes available once the current builder state exposes KPI value fields." },
    ],
    actionGroups: [
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
    ],
    notes: [],
    showDisabledHint: false,
    disabledHintText: "",
});

assert.deepEqual(buildReportBuilderAuthoredCapabilityViewModel({
    compiledRuntimePreviewModel: {
        scopeCapability: { supported: true, paramIds: ["dateRange"] },
        refinementCapability: {
            supported: false,
            hasFieldSupport: false,
            hasActiveRuntimeRefinements: false,
            hasActiveDrillTransitions: false,
        },
        chartCapability: {
            supported: true,
            chartSpec: { type: "line", xField: "eventDate", yFields: ["avails"] },
        },
        tableCapability: {
            supported: true,
            columnKeys: ["eventDate", "avails"],
        },
        geoCapability: {
            supported: true,
            geoKey: "country",
            metricKey: "avails",
        },
    },
    authoredKpiValueFieldOptions: [{ value: "avails", label: "Avails" }],
}), {
    scope: {
        known: true,
        supported: true,
        paramIds: ["dateRange"],
        disabledReason: "Add filters becomes available once the current builder state compiles shared scope parameters.",
    },
    refinement: {
        known: true,
        supported: false,
        hasFieldSupport: false,
        hasActiveRuntimeRefinements: false,
        hasActiveDrillTransitions: false,
        disabledReason: "Add refinements becomes available once the current builder state exposes runtime refinement-capable dimensions.",
    },
    chart: {
        known: true,
        supported: true,
        chartSpec: { type: "line", xField: "eventDate", yFields: ["avails"] },
        disabledReason: "Add chart becomes available once the current builder state compiles compatible chart fields.",
    },
    table: {
        known: true,
        supported: true,
        columnKeys: ["eventDate", "avails"],
        disabledReason: "Add table becomes available once the current builder state compiles authored table columns.",
    },
    geo: {
        known: true,
        supported: true,
        geoKey: "country",
        metricKey: "avails",
        disabledReason: "Add geo becomes available once the current builder state compiles compatible geo keys and metrics.",
    },
    kpi: {
        known: true,
        supported: true,
        optionCount: 1,
        disabledReason: "Add KPI becomes available once the current builder state exposes KPI value fields.",
    },
    actions: [
        { id: "markdownBlock", label: "Add narrative", icon: "annotation", disabled: false, disabledReason: "" },
        { id: "filterBarBlock", label: "Add filters", icon: "filter", disabled: false, disabledReason: "Add filters becomes available once the current builder state compiles shared scope parameters." },
        { id: "refinementBarBlock", label: "Add refinements", icon: "changes", disabled: true, disabledReason: "Add refinements becomes available once the current builder state exposes runtime refinement-capable dimensions." },
        { id: "geoMapBlock", label: "Add geo", icon: "map", disabled: false, disabledReason: "Add geo becomes available once the current builder state compiles compatible geo keys and metrics." },
        { id: "chartBlock", label: "Add chart", icon: "timeline-line-chart", disabled: false, disabledReason: "Add chart becomes available once the current builder state compiles compatible chart fields." },
        { id: "tableBlock", label: "Add table", icon: "th", disabled: false, disabledReason: "Add table becomes available once the current builder state compiles authored table columns." },
        { id: "kpiBlock", label: "Add KPI", icon: "dashboard", disabled: false, disabledReason: "Add KPI becomes available once the current builder state exposes KPI value fields." },
    ],
    actionGroups: [
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
    ],
    notes: [
        {
            id: "refinement",
            message: "Refinement blocks require runtime refinement-capable dimensions in the current builder.",
        },
    ],
    showDisabledHint: true,
    disabledHintText: "Hover a disabled option to see which builder fields or shared scope parameters still need to be present.",
});

console.log("reportBuilderAuthoredCapabilities ✓ normalizes compiled authored block capability state");
