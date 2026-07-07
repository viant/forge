import assert from "node:assert/strict";

import {
    applyReportBuilderSemanticConfig,
    buildReportBuilderSemanticDiagnosticTargets,
    buildReportBuilderSemanticDiagnosticsNotice,
    buildReportBuilderSemanticFieldValidation,
    buildReportBuilderSemanticGovernanceNotice,
    buildReportBuilderSemanticRuntimeDiagnostics,
    normalizeReportBuilderSemanticSummary,
    buildReportBuilderSemanticSummary,
    buildReportBuilderSemanticSelection,
    buildReportBuilderSemanticValidationRequest,
    buildReportBuilderSemanticStatus,
    normalizeReportBuilderSemanticDiagnostics,
    resolveReportBuilderSemanticSummary,
    resolveReportBuilderSemanticSelections,
    resolveReportBuilderSemanticEntity,
    resolveSemanticGovernanceOptionLabel,
    resolveReportBuilderSemanticModelProvider,
    resolveSemanticGovernanceBadges,
    semanticFieldTitle,
    summarizeReportBuilderSemanticDiagnostics,
} from "./reportBuilderSemantic.js";

const model = {
    modelRef: "model://example/performance/delivery@v1",
    version: 1,
    label: "Ad Delivery",
    entities: [
        {
            id: "line_delivery",
            label: "Line Delivery",
            dimensions: [
                {
                    id: "event_date",
                    label: "Date",
                    description: "Event date",
                    dataType: "date",
                },
                {
                    id: "channel",
                    label: "Channel",
                    description: "Approved channel",
                    dataType: "string",
                },
            ],
            measures: [
                {
                    id: "spend",
                    label: "Spend",
                    description: "Certified spend metric",
                    format: "currency",
                    dataType: "number",
                    aggregation: "sum",
                    governance: {
                        status: "approved",
                        certification: "certified",
                        ownerRef: "team://example/performance",
                    },
                },
            ],
            parameters: [
                {
                    id: "reporting_window",
                    label: "Reporting Window",
                    description: "Approved reporting window",
                    dataType: "date",
                },
            ],
        },
    ],
};

const flatFieldModel = {
    modelRef: "model://example/performance/delivery@v1",
    version: 1,
    label: "Ad Delivery",
    entities: [
        {
            id: "line_delivery",
            label: "Line Delivery",
            fields: [
                {
                    id: "publisher",
                    label: "Publisher",
                    featureType: "dimension",
                    category: "Inventory",
                    definitionRef: "harmonizer://feature/publisher",
                    governance: {
                        status: "approved",
                        certification: "reviewed",
                        classification: "harmonizer.audience",
                    },
                },
                {
                    id: "audience_index",
                    label: "Audience Index",
                    featureType: "measure",
                    category: "Audience",
                    format: "number",
                    definitionRef: "harmonizer://feature/user.segment.index",
                    governance: {
                        status: "approved",
                        certification: "reviewed",
                        classification: "harmonizer.audience",
                    },
                },
                {
                    id: "audience_segment",
                    label: "Audience Segment",
                    featureType: "parameter",
                    category: "Audience",
                    definitionRef: "harmonizer://feature/user.segment",
                    governance: {
                        status: "approved",
                        classification: "harmonizer.audience",
                    },
                },
            ],
        },
    ],
};

const builderContext = {
    handlers: {
        semanticModel: {
            async listModels(namespace) {
                return [{ namespace }];
            },
            async getModel(modelRef) {
                return { modelRef };
            },
            async validateSelection(modelRef, selection) {
                return { modelRef, selection, valid: true };
            },
        },
    },
};

const provider = resolveReportBuilderSemanticModelProvider(builderContext);
assert.equal(typeof provider?.getModel, "function");

const rawConfig = { measures: [{ id: "totalSpend", label: "Total Spend" }] };
assert.equal(applyReportBuilderSemanticConfig(rawConfig, { mode: "raw" }, model), rawConfig);

assert.equal(resolveReportBuilderSemanticEntity(model, {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
}).label, "Line Delivery");
assert.equal(resolveReportBuilderSemanticEntity(flatFieldModel, {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
}).measures[0].id, "audience_index");

const overlaid = applyReportBuilderSemanticConfig({
    measures: [
        { id: "totalSpend", semanticRef: "spend", label: "Total Spend", paramPath: "measures.totalSpend" },
    ],
    dimensions: [
        { id: "eventDate", semanticRef: "event_date", label: "Event Date", paramPath: "dimensions.eventDate" },
    ],
    staticFilters: [
        { id: "dateRange", semanticRef: "reporting_window", label: "Date Range", type: "dateRange" },
    ],
    groupBy: {
        options: [
            { value: "eventDate", label: "Event Date", dimensionId: "eventDate" },
        ],
    },
}, {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
}, model);
assert.equal(overlaid.measures[0].label, "Spend");
assert.equal(overlaid.measures[0].format, "currency");
assert.equal(overlaid.measures[0].semanticRef, "spend");
assert.equal(overlaid.semanticModel.modelRef, "model://example/performance/delivery@v1");
assert.equal(overlaid.dimensions[0].label, "Date");
assert.equal(overlaid.staticFilters[0].label, "Reporting Window");
assert.equal(overlaid.staticFilters[0].description, "Approved reporting window");
assert.equal(overlaid.staticFilters[0].semanticDataType, "date");
assert.equal(overlaid.staticFilters[0].semanticRef, "reporting_window");
assert.equal(overlaid.groupBy.options[0].label, "Date");

// predicate-native configs overlay semantics onto pinned scope params without
// requiring the config to be lowered onto staticFilters first
const predicateOverlaid = applyReportBuilderSemanticConfig({
    measures: [
        { id: "totalSpend", semanticRef: "spend", label: "Total Spend", paramPath: "measures.totalSpend" },
    ],
    dimensions: [
        { id: "eventDate", semanticRef: "event_date", label: "Event Date", paramPath: "dimensions.eventDate" },
    ],
    predicates: [
        {
            id: "dateRange",
            label: "Date Range",
            kind: "dateRange",
            required: true,
            semanticRef: "reporting_window",
            startParamPath: "filters.from",
            endParamPath: "filters.to",
        },
    ],
    staticFilters: [
        { id: "legacyOnly", label: "Legacy Only" },
    ],
}, {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
}, model);
assert.deepEqual(predicateOverlaid.staticFilters.map((entry) => entry.id), ["legacyOnly", "dateRange"]);
assert.equal(predicateOverlaid.staticFilters[0].label, "Legacy Only");
assert.equal(predicateOverlaid.staticFilters[1].label, "Reporting Window");
assert.equal(predicateOverlaid.staticFilters[1].description, "Approved reporting window");
assert.equal(predicateOverlaid.staticFilters[1].semanticDataType, "date");
assert.equal(predicateOverlaid.staticFilters[1].semanticRef, "reporting_window");
assert.equal(predicateOverlaid.staticFilters[1].type, "dateRange");
assert.equal(predicateOverlaid.staticFilters[1].required, true);

const flatFieldOverlaid = applyReportBuilderSemanticConfig({
    measures: [
        { id: "audienceIndex", semanticRef: "audience_index", label: "Audience Index" },
    ],
    dimensions: [
        { id: "publisherId", semanticRef: "publisher", label: "Publisher" },
    ],
    staticFilters: [
        { id: "audienceSegmentFilter", semanticRef: "audience_segment", label: "Audience Segment", multiple: true },
    ],
}, {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
}, flatFieldModel);
assert.equal(flatFieldOverlaid.measures[0].category, "Audience");
assert.equal(flatFieldOverlaid.measures[0].definitionRef, "harmonizer://feature/user.segment.index");
assert.equal(flatFieldOverlaid.dimensions[0].category, "Inventory");
assert.equal(flatFieldOverlaid.staticFilters[0].definitionRef, "harmonizer://feature/user.segment");
assert.equal(flatFieldOverlaid.semanticModel.modelRef, "model://example/performance/delivery@v1");

const embeddedModelOnly = applyReportBuilderSemanticConfig({
    measures: [{ id: "spend", label: "Spend" }],
}, {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "missing_entity",
}, model);
assert.equal(embeddedModelOnly.semanticModel.modelRef, "model://example/performance/delivery@v1");
assert.equal(embeddedModelOnly.measures[0].label, "Spend");

assert.deepEqual(resolveReportBuilderSemanticSelections({
    measures: [{ id: "totalSpend", semanticRef: "spend" }],
    dimensions: [{ id: "eventDate", semanticRef: "event_date" }],
}, {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date"],
    selectedMeasures: ["spend"],
}), {
    hasExplicitDimensions: true,
    hasExplicitMeasures: true,
    selectedDimensions: ["eventDate"],
    selectedMeasures: ["totalSpend"],
});

assert.deepEqual(buildReportBuilderSemanticSelection({
    measures: [{ id: "totalSpend", semanticRef: "spend" }],
    dimensions: [{ id: "eventDate", semanticRef: "event_date" }, { id: "channelId", semanticRef: "channel" }],
    staticFilters: [{ id: "dateRange", type: "dateRange", semanticRef: "reporting_window" }],
    groupBy: {
        options: [
            { value: "channel", dimensionId: "channelId", label: "Channel" },
        ],
    },
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
}, {
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    selectedDimensions: ["eventDate"],
    selectedMeasures: ["totalSpend"],
    groupBy: "channel",
    scopeParams: {
        dateRange: {
            start: "2026-05-01",
            end: "2026-05-07",
        },
    },
}), {
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selection: {
        dimensions: ["event_date", "channel"],
        measures: ["spend"],
    },
    refinements: [],
    parameters: {
        reporting_window: {
            start: "2026-05-01",
            end: "2026-05-07",
        },
    },
});

// semantic parameter selection resolves pinned predicate params natively,
// without a lowered staticFilters shell on the config
assert.deepEqual(buildReportBuilderSemanticSelection({
    measures: [{ id: "totalSpend", semanticRef: "spend" }],
    dimensions: [{ id: "eventDate", semanticRef: "event_date" }],
    predicates: [
        {
            id: "dateRange",
            kind: "dateRange",
            semanticRef: "reporting_window",
            startParamPath: "filters.from",
            endParamPath: "filters.to",
        },
    ],
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
}, {
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    selectedDimensions: ["eventDate"],
    selectedMeasures: ["totalSpend"],
    scopeParams: {
        dateRange: {
            start: "2026-05-01",
            end: "2026-05-07",
        },
    },
}), {
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selection: {
        dimensions: ["event_date"],
        measures: ["spend"],
    },
    refinements: [],
    parameters: {
        reporting_window: {
            start: "2026-05-01",
            end: "2026-05-07",
        },
    },
});

assert.deepEqual(buildReportBuilderSemanticSelection({
    measures: [{ id: "totalSpend", semanticRef: "spend" }, { id: "ctr" }],
    dimensions: [{ id: "eventDate", semanticRef: "event_date" }, { id: "siteType" }],
    staticFilters: [{ id: "dateRange", type: "dateRange", semanticRef: "reporting_window" }],
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
}, {
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend", "ctr"],
    scopeParams: {
        dateRange: {
            start: "2026-05-01",
            end: "2026-05-07",
        },
    },
}), {
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selection: {
        dimensions: ["event_date"],
        measures: ["spend"],
    },
    unmapped: {
        dimensions: ["siteType"],
        measures: ["ctr"],
    },
    refinements: [],
    parameters: {
        reporting_window: {
            start: "2026-05-01",
            end: "2026-05-07",
        },
    },
});

assert.deepEqual(buildReportBuilderSemanticSelection({
    measures: [{ id: "totalSpend", semanticRef: "spend" }],
    dimensions: [{ id: "eventDate", semanticRef: "event_date" }],
    staticFilters: [
        { id: "dateRange", type: "dateRange", semanticRef: "reporting_window" },
        { id: "channelsFilter", multiple: true, semanticRef: "", label: "Channels" },
    ],
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
}, {
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    selectedDimensions: ["eventDate"],
    selectedMeasures: ["totalSpend"],
    scopeParams: {
        dateRange: {
            start: "2026-05-01",
            end: "2026-05-07",
        },
        channelsFilter: ["CTV"],
    },
}), {
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selection: {
        dimensions: ["event_date"],
        measures: ["spend"],
    },
    unmapped: {
        parameters: ["channelsFilter"],
    },
    refinements: [],
    parameters: {
        reporting_window: {
            start: "2026-05-01",
            end: "2026-05-07",
        },
    },
});

assert.deepEqual(buildReportBuilderSemanticValidationRequest({
    measures: [{ id: "totalSpend", semanticRef: "spend" }],
    dimensions: [{ id: "eventDate", semanticRef: "event_date" }, { id: "channelId", semanticRef: "channel" }],
    staticFilters: [{ id: "dateRange", type: "dateRange", semanticRef: "reporting_window" }],
    groupBy: {
        options: [
            { value: "channel", dimensionId: "channelId", label: "Channel" },
        ],
    },
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
}, {
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    selectedDimensions: ["eventDate"],
    selectedMeasures: ["totalSpend"],
    groupBy: "channel",
    scopeParams: {
        dateRange: {
            start: "2026-05-01",
            end: "2026-05-07",
        },
    },
}), {
    modelRef: "model://example/performance/delivery@v1",
    selection: {
        entity: "line_delivery",
        dimensions: ["event_date", "channel"],
        measures: ["spend"],
        parameters: {
            reporting_window: {
                start: "2026-05-01",
                end: "2026-05-07",
            },
        },
    },
});

assert.deepEqual(buildReportBuilderSemanticSummary({
    config: {
        measures: [{ id: "totalSpend", semanticRef: "spend", label: "Spend", format: "currency" }],
        computedMeasures: [
            {
                id: "ctr",
                label: "CTR",
                compute: {
                    type: "ratio",
                    numerator: "totalSpend",
                    denominator: "totalSpend",
                },
                dependencies: ["totalSpend"],
            },
        ],
        dimensions: [
            { id: "eventDate", semanticRef: "event_date", label: "Date" },
            { id: "channelId", semanticRef: "channel", label: "Channel" },
        ],
        staticFilters: [
            { id: "dateRange", type: "dateRange", semanticRef: "reporting_window", label: "Date Range" },
        ],
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["spend"],
        },
    },
    state: {
        selectedMeasures: ["ctr"],
        selectedDimensions: ["eventDate", "channelId"],
        scopeParams: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-07",
            },
        },
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["spend"],
        },
    },
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        selectedDimensions: ["event_date", "channel"],
        selectedMeasures: ["spend"],
    },
    model,
}), {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
        {
            id: "event_date",
            rawId: "eventDate",
            label: "Date",
            description: "Event date",
        },
        {
            id: "channel",
            rawId: "channelId",
            label: "Channel",
            description: "Approved channel",
        },
    ],
    selectedMeasures: [
        {
            id: "spend",
            rawId: "totalSpend",
            label: "Spend",
            description: "Certified spend metric",
            format: "currency",
            governance: {
                status: "approved",
                certification: "certified",
                ownerRef: "team://example/performance",
            },
        },
    ],
    selectedParameters: [
        {
            id: "reporting_window",
            rawId: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window",
        },
    ],
});

assert.deepEqual(normalizeReportBuilderSemanticSummary({
    kind: "semantic",
    modelRef: " model://example/performance/delivery@v1 ",
    modelLabel: " Ad Delivery ",
    entity: " line_delivery ",
    entityLabel: " Line Delivery ",
    selectedDimensions: [
        { id: " event_date ", rawId: " eventDate ", label: " Delivery Date " },
    ],
    selectedMeasures: [
        {
            id: " spend ",
            rawId: " totalSpend ",
            label: " Spend ",
            governance: {
                status: " Approved ",
                certification: " Certified ",
            },
        },
    ],
}), {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
        { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
    ],
    selectedMeasures: [
        {
            id: "spend",
            rawId: "totalSpend",
            label: "Spend",
            governance: {
                status: "approved",
                certification: "certified",
            },
        },
    ],
});

assert.deepEqual(resolveReportBuilderSemanticSummary({
    currentSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
        ],
        selectedMeasures: [
            { id: "spend", rawId: "totalSpend", label: "Spend" },
        ],
    },
    fallbackSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        modelLabel: "Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Line Delivery",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Delivery Date", description: "Daily delivery grain" },
        ],
        selectedMeasures: [
            {
                id: "spend",
                rawId: "totalSpend",
                label: "Spend",
                governance: {
                    status: "approved",
                    certification: "certified",
                },
            },
        ],
    },
    currentFingerprint: "{\"modelRef\":\"model://example/performance/delivery@v1\"}",
    fallbackFingerprint: "{\"modelRef\":\"model://example/performance/delivery@v1\"}",
}), {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
        { id: "event_date", rawId: "eventDate", label: "Delivery Date", description: "Daily delivery grain" },
    ],
    selectedMeasures: [
        {
            id: "spend",
            rawId: "totalSpend",
            label: "Spend",
            governance: {
                status: "approved",
                certification: "certified",
            },
        },
    ],
});

assert.deepEqual(resolveReportBuilderSemanticSummary({
    currentSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        selectedDimensions: [],
        selectedMeasures: [],
    },
    fallbackSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        modelLabel: "Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Line Delivery",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
        ],
        selectedMeasures: [
            { id: "spend", rawId: "totalSpend", label: "Spend" },
        ],
    },
    currentFingerprint: "{\"modelRef\":\"model://example/performance/delivery@v1\"}",
    fallbackFingerprint: "{\"modelRef\":\"model://example/performance/delivery@v1\"}",
}), {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
        { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
    ],
    selectedMeasures: [
        { id: "spend", rawId: "totalSpend", label: "Spend" },
    ],
});

assert.deepEqual(resolveReportBuilderSemanticSummary({
    currentSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Current Delivery Date" },
        ],
        selectedMeasures: [
            { id: "spend", rawId: "totalSpend", label: "Current Spend" },
        ],
    },
    fallbackSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        modelLabel: "Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Line Delivery",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Delivery Date", description: "Daily delivery grain" },
        ],
        selectedMeasures: [
            { id: "spend", rawId: "totalSpend", label: "Spend" },
        ],
    },
    currentFingerprint: "{\"modelRef\":\"model://example/performance/delivery@v1\",\"selection\":\"current\"}",
    fallbackFingerprint: "{\"modelRef\":\"model://example/performance/delivery@v1\",\"selection\":\"reopened\"}",
}), {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: [
        { id: "event_date", rawId: "eventDate", label: "Current Delivery Date" },
    ],
    selectedMeasures: [
        { id: "spend", rawId: "totalSpend", label: "Current Spend" },
    ],
});

assert.deepEqual(resolveReportBuilderSemanticSummary({
    currentSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Date" },
        ],
        selectedMeasures: [
            { id: "spend", rawId: "totalSpend", label: "Spend" },
        ],
    },
    fallbackSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        modelLabel: "Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Line Delivery",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Delivery Date", description: "Daily delivery grain" },
        ],
        selectedMeasures: [
            { id: "spend", rawId: "totalSpend", label: "Available Impressions", format: "compactNumber" },
        ],
    },
    currentFingerprint: "{\"modelRef\":\"model://example/performance/delivery@v1\"}",
    fallbackFingerprint: "{\"modelRef\":\"model://example/performance/delivery@v1\"}",
    preferFallbackMetadata: true,
}), {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
        { id: "event_date", rawId: "eventDate", label: "Delivery Date", description: "Daily delivery grain" },
    ],
    selectedMeasures: [
        { id: "spend", rawId: "totalSpend", label: "Available Impressions", format: "compactNumber" },
    ],
});

assert.deepEqual(normalizeReportBuilderSemanticDiagnostics([
    {
        code: "unknownMeasure",
        severity: "error",
        path: "selection.measures[0]",
        message: "Measure 'gross_margin' is not available.",
        suggestedFix: "Choose a certified measure.",
    },
    null,
    { message: "" },
]), [
    {
        code: "unknownMeasure",
        severity: "error",
        path: "selection.measures[0]",
        message: "Measure 'gross_margin' is not available.",
        suggestedFix: "Choose a certified measure.",
    },
]);

assert.deepEqual(buildReportBuilderSemanticDiagnosticTargets({
    config: {
        measures: [
            { id: "totalSpend", semanticRef: "spend" },
            { id: "hhUniqs", semanticRef: "household_uniques" },
        ],
        dimensions: [
            { id: "eventDate", semanticRef: "event_date" },
            { id: "agegroupId", semanticRef: "age_group" },
        ],
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
    },
    state: {
        selectedMeasures: ["totalSpend", "hhUniqs"],
        selectedDimensions: ["eventDate"],
        groupBy: "agegroupId",
    },
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    diagnostics: [
        {
            code: "unsupportedBreakdown",
            severity: "error",
            path: "selection.dimensions[1]",
            message: "Audience Age Group is not allowed for this metric.",
        },
        {
            code: "unsupportedMeasure",
            severity: "error",
            path: "selection.measures[1]",
            message: "Household Uniques is not allowed for this breakdown.",
        },
        {
            code: "selectionLevel",
            severity: "warning",
            path: "selection.entity",
            message: "Entity is nearing deprecation.",
        },
    ],
}), {
    measureDiagnosticsById: {
        hhUniqs: [
            {
                code: "unsupportedMeasure",
                severity: "error",
                path: "selection.measures[1]",
                message: "Household Uniques is not allowed for this breakdown.",
            },
        ],
    },
    dimensionDiagnosticsById: {
        agegroupId: [
            {
                code: "unsupportedBreakdown",
                severity: "error",
                path: "selection.dimensions[1]",
                message: "Audience Age Group is not allowed for this metric.",
            },
        ],
    },
    parameterDiagnosticsById: {},
    groupByDiagnostics: [
        {
            code: "unsupportedBreakdown",
            severity: "error",
            path: "selection.dimensions[1]",
            message: "Audience Age Group is not allowed for this metric.",
        },
    ],
    unmatchedDiagnostics: [
        {
            code: "selectionLevel",
            severity: "warning",
            path: "selection.entity",
            message: "Entity is nearing deprecation.",
        },
    ],
});

assert.deepEqual(buildReportBuilderSemanticDiagnosticTargets({
    config: {
        staticFilters: [
            { id: "dateRange", type: "dateRange", semanticRef: "reporting_window", label: "Date Range" },
        ],
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
    },
    state: {
        scopeParams: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-07",
            },
        },
    },
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    diagnostics: [
        {
            code: "invalidParameter",
            severity: "error",
            path: "selection.parameters.reporting_window",
            message: "Reporting Window is outside the supported semantic window.",
        },
    ],
}), {
    measureDiagnosticsById: {},
    dimensionDiagnosticsById: {},
    parameterDiagnosticsById: {
        dateRange: [
            {
                code: "invalidParameter",
                severity: "error",
                path: "selection.parameters.reporting_window",
                message: "Reporting Window is outside the supported semantic window.",
            },
        ],
    },
    groupByDiagnostics: [],
    unmatchedDiagnostics: [],
});

assert.equal(
    summarizeReportBuilderSemanticDiagnostics([
        {
            message: "Measure 'gross_margin' is not available.",
            suggestedFix: "Choose a certified measure.",
        },
    ]),
    "Measure 'gross_margin' is not available. Choose a certified measure.",
);

assert.deepEqual(resolveSemanticGovernanceBadges({
    governance: {
        status: "approved",
        certification: "certified",
        ownerRef: "team://example/performance",
    },
}), [
    { id: "approved", label: "Approved", tone: "approved" },
    { id: "certified", label: "Certified", tone: "certified" },
    { id: "owner:team://example/performance", label: "Owner team://example/performance", tone: "owner" },
]);

assert.deepEqual(resolveSemanticGovernanceBadges({
    governance: {
        status: "deprecated",
        certification: "reviewed",
        ownerRef: "team://example/performance",
    },
}), [
    { id: "reviewed", label: "Reviewed", tone: "reviewed" },
    { id: "deprecated", label: "Deprecated", tone: "deprecated" },
    { id: "owner:team://example/performance", label: "Owner team://example/performance", tone: "owner" },
]);

assert.deepEqual(resolveSemanticGovernanceBadges({
    governance: {
        status: "approved",
    },
}), [
    { id: "approved", label: "Approved", tone: "approved" },
]);

assert.equal(
    resolveSemanticGovernanceOptionLabel("Audience Age Group", {
        governance: { status: "draft" },
    }),
    "Audience Age Group (Draft)",
);
assert.equal(
    resolveSemanticGovernanceOptionLabel("Market", {
        governance: { status: "deprecated" },
    }),
    "Market (Deprecated)",
);
assert.equal(
    resolveSemanticGovernanceOptionLabel("Channel", {
        governance: { status: "approved", certification: "reviewed" },
    }),
    "Channel",
);

assert.deepEqual(buildReportBuilderSemanticGovernanceNotice({
    config: {
        measures: [
            {
                id: "totalSpend",
                label: "Available Impressions",
                governance: { status: "approved", certification: "certified" },
            },
        ],
        dimensions: [
            { id: "eventDate", label: "Delivery Date", governance: { status: "approved" } },
            { id: "agegroupId", label: "Audience Age Group", governance: { status: "draft", ownerRef: "team://example/performance" } },
            { id: "country", label: "Market", governance: { status: "deprecated", ownerRef: "team://example/performance" } },
        ],
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
    },
    state: {
        selectedMeasures: ["totalSpend"],
        selectedDimensions: ["eventDate", "country"],
        groupBy: "agegroupId",
    },
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
}), {
    id: "semanticGovernance",
    level: "warning",
    title: "Selected Semantic Governance Warnings",
    description: "Some selected semantic fields are deprecated or still in draft status. Review them before sharing or publishing this report.",
    items: [
        "Market • Owner team://example/performance • Deprecated",
        "Audience Age Group • Owner team://example/performance • Draft",
    ],
});

assert.deepEqual(buildReportBuilderSemanticGovernanceNotice({
    config: {
        dimensions: [
            { id: "agegroupId", label: "Audience Age Group", governance: { status: "draft", ownerRef: "team://example/performance" } },
        ],
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
    },
    state: {
        selectedDimensions: ["agegroupId"],
    },
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
}), {
    id: "semanticGovernance",
    level: "info",
    title: "Selected Draft Semantic Fields",
    description: "These selected semantic fields are still marked as draft in the provider metadata.",
    items: [
        "Audience Age Group • Owner team://example/performance • Draft",
    ],
});

assert.deepEqual(buildReportBuilderSemanticDiagnosticsNotice({
    validationState: {
        diagnostics: [
            {
                code: "unknownMeasure",
                severity: "error",
                path: "selection.measures[0]",
                message: "Measure 'gross_margin' is not available.",
                suggestedFix: "Choose a certified measure.",
            },
            {
                code: "deprecatedDimension",
                severity: "warning",
                path: "selection.dimensions[1]",
                message: "Dimension 'legacy_channel' is deprecated.",
            },
        ],
    },
}), {
    level: "danger",
    title: "Semantic provider diagnostics",
    description: "The semantic provider returned 2 diagnostics for the current selection.",
    diagnostics: [
        {
            id: "unknownMeasure_1",
            severity: "error",
            code: "unknownMeasure",
            path: "selection.measures[0]",
            message: "Measure 'gross_margin' is not available.",
            suggestedFix: "Choose a certified measure.",
        },
        {
            id: "deprecatedDimension_2",
            severity: "warning",
            code: "deprecatedDimension",
            path: "selection.dimensions[1]",
            message: "Dimension 'legacy_channel' is deprecated.",
            suggestedFix: "",
        },
    ],
});

assert.deepEqual(buildReportBuilderSemanticDiagnosticsNotice({
    validationState: {
        diagnostics: [
            {
                code: "semanticModelUnavailable",
                severity: "error",
                path: "selection.modelRef",
                message: "Semantic model provider unavailable.",
                suggestedFix: "Retry loading the semantic model or restore the semantic model provider.",
            },
        ],
    },
}), {
    level: "danger",
    title: "Semantic model diagnostics",
    description: "The semantic model could not be resolved for the current selection.",
    diagnostics: [
        {
            id: "semanticModelUnavailable_1",
            severity: "error",
            code: "semanticModelUnavailable",
            path: "selection.modelRef",
            message: "Semantic model provider unavailable.",
            suggestedFix: "Retry loading the semantic model or restore the semantic model provider.",
        },
    ],
});

assert.deepEqual(buildReportBuilderSemanticDiagnosticsNotice({
    validationState: {
        diagnostics: [
            {
                code: "semanticModelError",
                severity: "error",
                path: "selection.modelRef",
                message: "Semantic model metadata failed.",
                suggestedFix: "Retry loading the semantic model or choose a different semantic binding.",
            },
        ],
    },
}), {
    level: "danger",
    title: "Semantic model diagnostics",
    description: "The semantic model could not be resolved for the current selection.",
    diagnostics: [
        {
            id: "semanticModelError_1",
            severity: "error",
            code: "semanticModelError",
            path: "selection.modelRef",
            message: "Semantic model metadata failed.",
            suggestedFix: "Retry loading the semantic model or choose a different semantic binding.",
        },
    ],
});

assert.deepEqual(buildReportBuilderSemanticRuntimeDiagnostics({
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    semanticStatus: {
        level: "warning",
        title: "Semantic binding issue",
        message: "Semantic binding could not be resolved cleanly.",
    },
    semanticDiagnosticsNotice: {
        level: "danger",
        description: "The semantic provider returned 2 diagnostics for the current selection.",
        diagnostics: [
            {
                code: "unknownMeasure",
                severity: "error",
                path: "selection.measures[0]",
                message: "Measure 'gross_margin' is not available.",
                suggestedFix: "Choose a certified measure.",
            },
            {
                code: "deprecatedDimension",
                severity: "warning",
                path: "selection.dimensions[1]",
                message: "Dimension 'legacy_channel' is deprecated.",
            },
        ],
    },
    semanticGovernanceNotice: {
        level: "info",
        items: [
            "Audience Age Group • Draft",
        ],
    },
}), [
    {
        code: "Semanticbindingissue",
        severity: "warning",
        message: "Semantic binding could not be resolved cleanly.",
    },
    {
        code: "unknownMeasure",
        severity: "error",
        path: "selection.measures[0]",
        message: "Measure 'gross_margin' is not available.",
        suggestedFix: "Choose a certified measure.",
    },
    {
        code: "deprecatedDimension",
        severity: "warning",
        path: "selection.dimensions[1]",
        message: "Dimension 'legacy_channel' is deprecated.",
    },
    {
        code: "semanticGovernance",
        severity: "info",
        message: "Audience Age Group • Draft",
    },
]);

assert.deepEqual(buildReportBuilderSemanticRuntimeDiagnostics({
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    semanticFieldValidation: {
        selectedIssues: [
            {
                id: "siteType",
                code: "missingSemanticRef",
                message: "siteType is not mapped to the current semantic model.",
            },
        ],
    },
}), [
    {
        code: "missingSemanticRef",
        severity: "error",
        path: "siteType",
        message: "siteType is not mapped to the current semantic model.",
        suggestedFix: "Remove it or add a valid semantic mapping before running the report.",
    },
]);

assert.deepEqual(buildReportBuilderSemanticRuntimeDiagnostics({
    binding: { mode: "raw" },
    semanticStatus: {
        level: "warning",
        title: "Semantic binding issue",
        message: "Should be ignored for raw mode.",
    },
}), []);

assert.deepEqual(buildReportBuilderSemanticFieldValidation({
    config: {
        measures: [{ id: "totalSpend", semanticRef: "spend" }, { id: "ctr" }],
        dimensions: [{ id: "eventDate", semanticRef: "event_date" }, { id: "siteType" }],
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
    },
    state: {
        selectedDimensions: ["eventDate", "siteType"],
        selectedMeasures: ["totalSpend", "ctr"],
    },
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    model,
}), {
    canRun: false,
    issues: [
        {
            id: "siteType",
            label: "siteType",
            semanticRef: "",
            code: "missingSemanticRef",
            selected: true,
            message: "siteType is not mapped to the current semantic model.",
        },
        {
            id: "ctr",
            label: "ctr",
            semanticRef: "",
            code: "missingSemanticRef",
            selected: true,
            message: "ctr is not mapped to the current semantic model.",
        },
    ],
    selectedIssues: [
        {
            id: "siteType",
            label: "siteType",
            semanticRef: "",
            code: "missingSemanticRef",
            selected: true,
            message: "siteType is not mapped to the current semantic model.",
        },
        {
            id: "ctr",
            label: "ctr",
            semanticRef: "",
            code: "missingSemanticRef",
            selected: true,
            message: "ctr is not mapped to the current semantic model.",
        },
    ],
    measureIssuesById: {
        ctr: {
            id: "ctr",
            label: "ctr",
            semanticRef: "",
            code: "missingSemanticRef",
            selected: true,
            message: "ctr is not mapped to the current semantic model.",
        },
    },
    dimensionIssuesById: {
        siteType: {
            id: "siteType",
            label: "siteType",
            semanticRef: "",
            code: "missingSemanticRef",
            selected: true,
            message: "siteType is not mapped to the current semantic model.",
        },
    },
    parameterIssuesById: {},
    message: "2 selected fields or scope parameters are not valid for the current semantic entity. Remove them or add valid semantic mappings before running the report.",
});

assert.deepEqual(buildReportBuilderSemanticFieldValidation({
    config: {
        measures: [{ id: "totalSpend", semanticRef: "spend" }],
        computedMeasures: [{
            id: "ctr",
            compute: {
                type: "ratio",
                numerator: "clicks",
                denominator: "impressions",
            },
        }],
        dimensions: [{ id: "eventDate", semanticRef: "event_date" }],
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
    },
    state: {
        selectedDimensions: ["eventDate"],
        selectedMeasures: ["totalSpend", "ctr"],
    },
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    model,
}), {
    canRun: true,
    issues: [],
    selectedIssues: [],
    measureIssuesById: {},
    dimensionIssuesById: {},
    parameterIssuesById: {},
    message: "",
});

assert.deepEqual(buildReportBuilderSemanticFieldValidation({
    config: {
        measures: [{ id: "totalSpend", semanticRef: "spend" }],
        calculatedFields: [{
            id: "projectedLift",
            expr: "if(channelId = 'CTV', totalSpend, null)",
        }],
        dimensions: [
            { id: "eventDate", semanticRef: "event_date" },
            { id: "channelId", semanticRef: "channel" },
        ],
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
    },
    state: {
        selectedDimensions: ["eventDate"],
        selectedMeasures: ["projectedLift"],
    },
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    model,
}), {
    canRun: true,
    issues: [],
    selectedIssues: [],
    measureIssuesById: {},
    dimensionIssuesById: {},
    parameterIssuesById: {},
    message: "",
});

assert.deepEqual(buildReportBuilderSemanticFieldValidation({
    config: {
        measures: [{ id: "totalSpend", semanticRef: "spend" }],
        dimensions: [{ id: "eventDate", semanticRef: "event_date" }],
        staticFilters: [
            { id: "dateRange", type: "dateRange", semanticRef: "reporting_window", label: "Date Range" },
            { id: "channelsFilter", multiple: true, semanticRef: "", label: "Channels" },
        ],
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
    },
    state: {
        selectedDimensions: ["eventDate"],
        selectedMeasures: ["totalSpend"],
        scopeParams: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-07",
            },
            channelsFilter: ["CTV"],
        },
    },
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    model,
}), {
    canRun: false,
    issues: [
        {
            id: "channelsFilter",
            label: "Channels",
            semanticRef: "",
            code: "missingSemanticRef",
            selected: true,
            message: "Channels is not mapped to the current semantic model.",
        },
    ],
    selectedIssues: [
        {
            id: "channelsFilter",
            label: "Channels",
            semanticRef: "",
            code: "missingSemanticRef",
            selected: true,
            message: "Channels is not mapped to the current semantic model.",
        },
    ],
    measureIssuesById: {},
    dimensionIssuesById: {},
    parameterIssuesById: {
        channelsFilter: {
            id: "channelsFilter",
            label: "Channels",
            semanticRef: "",
            code: "missingSemanticRef",
            selected: true,
            message: "Channels is not mapped to the current semantic model.",
        },
    },
    message: "Channels is not mapped to the current semantic model. Remove it or add a valid semantic mapping before running the report.",
});

assert.deepEqual(buildReportBuilderSemanticSelection({
    measures: [{ id: "totalSpend", semanticRef: "spend" }],
    calculatedFields: [{
        id: "projectedLift",
        expr: "if(channelId = 'CTV', totalSpend, null)",
    }],
    dimensions: [
        { id: "eventDate", semanticRef: "event_date" },
        { id: "channelId", semanticRef: "channel" },
    ],
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
}, {
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    selectedDimensions: ["eventDate"],
    selectedMeasures: ["projectedLift"],
}), {
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selection: {
        dimensions: ["event_date", "channel"],
        measures: ["spend"],
    },
    refinements: [],
    parameters: {},
});

assert.deepEqual(buildReportBuilderSemanticSelection({
    measures: [{ id: "totalSpend", semanticRef: "spend" }],
    tableCalculations: [{
        id: "runningSpend",
        compute: {
            type: "runningTotal",
            sourceField: "totalSpend",
            partitionBy: ["channelId"],
            orderBy: [
                { field: "eventDate", direction: "asc" },
            ],
        },
    }],
    dimensions: [
        { id: "eventDate", semanticRef: "event_date" },
        { id: "channelId", semanticRef: "channel" },
    ],
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
}, {
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    selectedDimensions: ["eventDate"],
    selectedMeasures: ["runningSpend"],
}), {
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selection: {
        dimensions: ["event_date", "channel"],
        measures: ["spend"],
    },
    refinements: [],
    parameters: {},
});

assert.deepEqual(buildReportBuilderSemanticSelection({
    measures: [{ id: "totalSpend", semanticRef: "spend" }],
    tableCalculations: [{
        id: "reachShare",
        compute: {
            type: "percentOfTotal",
            sourceField: "totalSpend",
            partitionBy: ["channelId"],
        },
    }],
    dimensions: [
        { id: "eventDate", semanticRef: "event_date" },
        { id: "channelId", semanticRef: "channel" },
    ],
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
}, {
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    selectedDimensions: ["eventDate"],
    selectedMeasures: ["reachShare"],
}), {
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selection: {
        dimensions: ["event_date", "channel"],
        measures: ["spend"],
    },
    refinements: [],
    parameters: {},
});

assert.match(semanticFieldTitle(overlaid.measures[0]), /Certified spend metric/);
assert.match(semanticFieldTitle(overlaid.measures[0]), /approved/i);
assert.match(semanticFieldTitle(overlaid.measures[0]), /Owner team:\/\/example\/performance/);

assert.deepEqual(buildReportBuilderSemanticStatus({
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    providerAvailable: true,
    loading: false,
    error: "",
    model,
}), {
    level: "info",
    title: "Semantic binding",
    message: "Ad Delivery • Entity: Line Delivery",
});

assert.deepEqual(buildReportBuilderSemanticStatus({
    binding: {
        mode: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
    },
    providerAvailable: false,
    loading: false,
    error: "",
    model: null,
}), {
    level: "warning",
    title: "Semantic model unavailable",
    message: "Semantic binding is active, but no semantic model provider is available in the current runtime context.",
});

console.log("reportBuilderSemantic ✓ provider, overlay, and status helpers");
