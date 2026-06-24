import assert from "node:assert/strict";

import {
    buildReportBuilderCalculatedFieldConfig,
    buildReportBuilderCalculatedFieldDraft,
    buildReportBuilderCalculatedFieldReferenceOptions,
    buildReportBuilderTableCalculationDraft,
    buildReportBuilderTableCalculationFieldOptions,
    REPORT_BUILDER_TABLE_CALC_FUNCTIONS,
    removeReportBuilderLocalCalculatedFieldState,
    removeReportBuilderLocalTableCalculationState,
    upsertReportBuilderLocalCalculatedFieldState,
    upsertReportBuilderLocalTableCalculationDraftState,
    upsertReportBuilderLocalTableCalculationState,
    validateReportBuilderCalculatedFieldDraft,
    validateReportBuilderTableCalculationDraft,
} from "./reportBuilderCalculatedFieldAuthoring.js";
import { listReportCalculatedFieldTableCalculationSpecs } from "../../reporting/calculationContracts.js";

const config = {
    measures: [
        { id: "totalSpend", key: "totalSpend", label: "Spend" },
        { id: "impressions", key: "impressions", label: "Impressions" },
    ],
    computedMeasures: [
        {
            id: "ctr",
            key: "ctr",
            label: "CTR",
            compute: {
                type: "ratio",
                numerator: "totalSpend",
                denominator: "impressions",
                scale: 100,
                decimals: 2,
            },
        },
    ],
    tableCalculations: [
        {
            id: "reachShare",
            key: "reachShare",
            label: "Reach Share",
            compute: {
                type: "percentOfTotal",
                sourceField: "impressions",
            },
        },
    ],
    dimensions: [
        { id: "eventDate", key: "eventDate", label: "Date" },
        { id: "channelId", key: "channelId", label: "Channel" },
    ],
};

const localCalculatedState = {
    localCalculatedFields: [
        {
            id: "projectedLift",
            key: "projectedLift",
            label: "Projected Lift",
            dataType: "number",
            format: "currency",
            expr: "if(channelId = 'CTV', totalSpend, null)",
        },
    ],
    localTableCalculations: [
        {
            id: "reachShare",
            key: "reachShare",
            label: "Reach Share",
            compute: {
                type: "percentOfTotal",
                sourceField: "impressions",
                scale: 100,
                decimals: 1,
            },
        },
    ],
};

const mergedConfig = buildReportBuilderCalculatedFieldConfig(config, localCalculatedState);
assert.deepEqual(
    REPORT_BUILDER_TABLE_CALC_FUNCTIONS,
    listReportCalculatedFieldTableCalculationSpecs().map((entry) => ({
        value: entry.name,
        label: entry.label,
        supportsPartition: entry.supportsPartition === true,
        requiresOrder: entry.requiresOrder === true && entry.name !== "rank",
        supportsRankDirection: entry.supportsRankDirection === true,
        supportsTieBreaker: entry.supportsTieBreaker === true,
        requiresWindowSize: entry.requiresWindowSize === true,
        supportsDecimals: entry.supportsDecimals === true,
        defaultFormat: entry.defaultFormat || "",
    })),
);
assert.deepEqual(
    mergedConfig.calculatedFields.map((field) => ({
        id: field.id,
        section: field.section,
        authoringEditable: field.authoringEditable,
    })),
    [
        {
            id: "projectedLift",
            section: "calculated",
            authoringEditable: true,
        },
    ],
);
assert.deepEqual(
    mergedConfig.tableCalculations.map((field) => ({
        id: field.id,
        authoringEditable: field.authoringEditable,
        authoringKind: field.authoringKind,
    })),
    [
        {
            id: "reachShare",
            authoringEditable: true,
            authoringKind: "tableCalc",
        },
    ],
);
assert.deepEqual(
    mergedConfig.measureSections,
    [
        {
            id: "calculated",
            label: "Calculated",
            order: Number.MAX_SAFE_INTEGER,
        },
    ],
);

assert.deepEqual(
    buildReportBuilderCalculatedFieldDraft(localCalculatedState.localCalculatedFields[0]),
    {
        id: "projectedLift",
        key: "projectedLift",
        label: "Projected Lift",
        dataType: "number",
        format: "currency",
        expr: "if(channelId = 'CTV', totalSpend, null)",
    },
);

assert.deepEqual(
    buildReportBuilderTableCalculationDraft(localCalculatedState.localTableCalculations[0]),
    {
        id: "reachShare",
        key: "reachShare",
        label: "Reach Share",
        format: "",
        functionId: "percentOfTotal",
        sourceField: "impressions",
        partitionBy: [],
        orderByField: "",
        orderDir: "asc",
        tieBreakerField: "",
        windowSize: "",
        decimals: "1",
    },
);

assert.deepEqual(
    buildReportBuilderCalculatedFieldReferenceOptions(mergedConfig).map((field) => `${field.kind}:${field.id}`),
    [
        "dimension:channelId",
        "dimension:eventDate",
        "measure:ctr",
        "measure:impressions",
        "measure:projectedLift",
        "measure:totalSpend",
    ],
);
assert.deepEqual(
    buildReportBuilderTableCalculationFieldOptions(mergedConfig),
    {
        sourceFields: [
            { id: "ctr", label: "CTR", kind: "measure", isRowCalculated: true, isTableCalculated: false },
            { id: "impressions", label: "Impressions", kind: "measure", isRowCalculated: false, isTableCalculated: false },
            { id: "projectedLift", label: "Projected Lift", kind: "measure", isRowCalculated: true, isTableCalculated: false },
            { id: "totalSpend", label: "Spend", kind: "measure", isRowCalculated: false, isTableCalculated: false },
        ],
        orderFields: [
            { id: "channelId", label: "Channel", kind: "dimension", isRowCalculated: false, isTableCalculated: false },
            { id: "eventDate", label: "Date", kind: "dimension", isRowCalculated: false, isTableCalculated: false },
            { id: "ctr", label: "CTR", kind: "measure", isRowCalculated: true, isTableCalculated: false },
            { id: "impressions", label: "Impressions", kind: "measure", isRowCalculated: false, isTableCalculated: false },
            { id: "projectedLift", label: "Projected Lift", kind: "measure", isRowCalculated: true, isTableCalculated: false },
            { id: "totalSpend", label: "Spend", kind: "measure", isRowCalculated: false, isTableCalculated: false },
        ],
        partitionDimensions: [
            { id: "channelId", label: "Channel" },
            { id: "eventDate", label: "Date" },
        ],
    },
);

const validDraft = validateReportBuilderCalculatedFieldDraft({
    id: "pacingFlag",
    label: "Pacing Flag",
    dataType: "string",
    expr: "if(totalSpend > 0 and channelId = 'CTV', 'active', 'idle')",
}, mergedConfig);
assert.equal(validDraft.valid, true);
assert.deepEqual(validDraft.field, {
    id: "pacingFlag",
    key: "pacingFlag",
    kind: "rowCalc",
    label: "Pacing Flag",
    dataType: "string",
    dependencies: ["totalSpend", "channelId"],
    expr: "if(totalSpend > 0 and channelId = 'CTV', 'active', 'idle')",
});

assert.deepEqual(
    validateReportBuilderCalculatedFieldDraft({
        id: "broken",
        label: "Broken",
        dataType: "number",
        expr: "totalSpend + missingMetric",
    }, mergedConfig),
    {
        valid: false,
        errors: [
            {
                field: "expr",
                code: "unknownDependency",
                message: "Unknown fields in expression: missingMetric.",
            },
        ],
        field: null,
    },
);

assert.deepEqual(
    validateReportBuilderCalculatedFieldDraft({
        id: "unsupportedFn",
        label: "Unsupported Fn",
        dataType: "number",
        expr: "foo(totalSpend)",
    }, mergedConfig),
    {
        valid: false,
        errors: [
            {
                field: "expr",
                code: "invalidSyntax",
                message: "Invalid calculated field expression at 0: unsupported function \"foo\"",
            },
        ],
        field: null,
    },
);

assert.deepEqual(
    validateReportBuilderCalculatedFieldDraft({
        id: "badRound",
        label: "Bad Round",
        dataType: "number",
        expr: "round(totalSpend, 2, 1)",
    }, mergedConfig),
    {
        valid: false,
        errors: [
            {
                field: "expr",
                code: "invalidSyntax",
                message: "Invalid calculated field expression at 0: function \"round\" accepts at most 2 arguments",
            },
        ],
        field: null,
    },
);

const validTableCalcDraft = validateReportBuilderTableCalculationDraft({
    id: "runningAvails",
    label: "Running Avails",
    format: "number",
    functionId: "runningTotal",
    sourceField: "impressions",
    partitionBy: ["channelId"],
    orderByField: "eventDate",
    orderDir: "asc",
}, mergedConfig);
assert.equal(validTableCalcDraft.valid, true);
assert.deepEqual(validTableCalcDraft.field, {
    id: "runningAvails",
    key: "runningAvails",
    kind: "tableCalc",
    label: "Running Avails",
    dataType: "number",
    format: "number",
    dependencies: ["impressions", "eventDate", "channelId"],
    compute: {
        type: "runningTotal",
        sourceField: "impressions",
        partitionBy: ["channelId"],
        orderBy: [
            { field: "eventDate", direction: "asc" },
        ],
    },
});

assert.deepEqual(
    validateReportBuilderTableCalculationDraft({
        id: "badTableCalc",
        label: "Bad Table Calc",
        functionId: "movingAverage",
        sourceField: "impressions",
        orderByField: "",
        windowSize: "",
    }, mergedConfig),
    {
        valid: false,
        errors: [
            {
                field: "orderByField",
                code: "required",
                message: "Order-by field is required.",
            },
            {
                field: "windowSize",
                code: "required",
                message: "Window size must be a positive integer.",
            },
        ],
        field: null,
    },
);

assert.deepEqual(
    validateReportBuilderTableCalculationDraft({
        id: "rankSpend",
        label: "Rank Spend",
        functionId: "rank",
        sourceField: "impressions",
        tieBreakerField: "impressions",
        orderDir: "desc",
    }, mergedConfig),
    {
        valid: false,
        errors: [
            {
                field: "tieBreakerField",
                code: "duplicateOrderField",
                message: "Tie-breaker field must differ from the source field.",
            },
        ],
        field: null,
    },
);

assert.deepEqual(
    validateReportBuilderCalculatedFieldDraft({
        id: "badDependency",
        label: "Bad Dependency",
        dataType: "number",
        expr: "reachShare + 1",
    }, mergedConfig),
    {
        valid: false,
        errors: [
            {
                field: "expr",
                code: "tableCalcDependency",
                message: "Row calculations cannot depend on table calculations: reachShare.",
            },
        ],
        field: null,
    },
);

const createdState = upsertReportBuilderLocalCalculatedFieldState({
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
    localCalculatedFields: [],
    localTableCalculations: [],
}, {
    id: "projectedLift",
    label: "Projected Lift",
    dataType: "number",
    format: "currency",
    expr: "if(channelId = 'CTV', totalSpend, null)",
}, config);
assert.equal(createdState.valid, true);
assert.deepEqual(createdState.nextState.localCalculatedFields, [
    {
        id: "projectedLift",
        key: "projectedLift",
        kind: "rowCalc",
        label: "Projected Lift",
        dataType: "number",
        format: "currency",
        dependencies: ["channelId", "totalSpend"],
        expr: "if(channelId = 'CTV', totalSpend, null)",
    },
]);
assert.deepEqual(createdState.nextState.selectedMeasures, ["totalSpend", "projectedLift"]);
assert.equal(createdState.nextState.primaryMeasure, "projectedLift");

const createdTableCalculationState = upsertReportBuilderLocalTableCalculationState({
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
    localTableCalculations: [],
}, config, "reachShare");
assert.equal(createdTableCalculationState.valid, true);
assert.deepEqual(createdTableCalculationState.nextState.localTableCalculations, [
    {
        id: "reachShare",
        key: "reachShare",
        kind: "tableCalc",
        label: "Reach Share",
        dataType: "number",
        dependencies: ["impressions"],
        compute: {
            type: "percentOfTotal",
            sourceField: "impressions",
        },
    },
]);
assert.deepEqual(createdTableCalculationState.nextState.selectedMeasures, ["totalSpend", "reachShare"]);
assert.equal(createdTableCalculationState.nextState.primaryMeasure, "totalSpend");

const createdTableCalculationDraftState = upsertReportBuilderLocalTableCalculationDraftState({
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
    localTableCalculations: [],
}, {
    id: "runningAvails",
    label: "Running Avails",
    format: "number",
    functionId: "runningTotal",
    sourceField: "impressions",
    partitionBy: ["channelId"],
    orderByField: "eventDate",
    orderDir: "asc",
}, mergedConfig);
assert.equal(createdTableCalculationDraftState.valid, true);
assert.deepEqual(createdTableCalculationDraftState.nextState.localTableCalculations, [
    {
        id: "runningAvails",
        key: "runningAvails",
        kind: "tableCalc",
        label: "Running Avails",
        dataType: "number",
        format: "number",
        dependencies: ["impressions", "eventDate", "channelId"],
        compute: {
            type: "runningTotal",
            sourceField: "impressions",
            partitionBy: ["channelId"],
            orderBy: [
                { field: "eventDate", direction: "asc" },
            ],
        },
    },
]);
assert.deepEqual(createdTableCalculationDraftState.nextState.selectedMeasures, ["totalSpend", "runningAvails"]);
assert.equal(createdTableCalculationDraftState.nextState.primaryMeasure, "runningAvails");

const editedTableCalculationDraftState = upsertReportBuilderLocalTableCalculationDraftState({
    selectedMeasures: ["totalSpend", "runningAvails"],
    primaryMeasure: "runningAvails",
    localTableCalculations: createdTableCalculationDraftState.nextState.localTableCalculations,
}, {
    id: "runningAvails",
    label: "Running Avails Edited",
    format: "number",
    functionId: "runningTotal",
    sourceField: "impressions",
    partitionBy: ["channelId"],
    orderByField: "eventDate",
    orderDir: "asc",
}, mergedConfig, {
    editingId: "runningAvails",
});
assert.equal(editedTableCalculationDraftState.valid, true);
assert.deepEqual(editedTableCalculationDraftState.nextState.localTableCalculations, [
    {
        id: "runningAvails",
        key: "runningAvails",
        kind: "tableCalc",
        label: "Running Avails Edited",
        dataType: "number",
        format: "number",
        dependencies: ["impressions", "eventDate", "channelId"],
        compute: {
            type: "runningTotal",
            sourceField: "impressions",
            partitionBy: ["channelId"],
            orderBy: [
                { field: "eventDate", direction: "asc" },
            ],
        },
    },
]);
assert.deepEqual(editedTableCalculationDraftState.nextState.selectedMeasures, ["totalSpend", "runningAvails"]);
assert.equal(editedTableCalculationDraftState.nextState.primaryMeasure, "runningAvails");

const removedState = removeReportBuilderLocalCalculatedFieldState({
    localCalculatedFields: createdState.nextState.localCalculatedFields,
    selectedMeasures: ["totalSpend", "projectedLift"],
    primaryMeasure: "projectedLift",
    orderField: "projectedLift",
    chartSpec: {
        title: "Projected Lift by Date",
        type: "line",
        xField: "eventDate",
        yFields: ["projectedLift", "totalSpend"],
        seriesOptions: {
            projectedLift: { axis: "right" },
        },
    },
    activeTablePreset: {
        id: "preset_1",
        title: "Projected Lift",
        dimensions: ["eventDate"],
        measures: ["projectedLift", "totalSpend"],
        columns: [
            { key: "eventDate" },
            { key: "projectedLift" },
        ],
    },
    lastTablePreset: {
        id: "preset_2",
        title: "Projected Lift Saved",
        dimensions: ["eventDate"],
        measures: ["projectedLift"],
        columns: [
            { key: "projectedLift" },
        ],
    },
}, "projectedLift");
assert.deepEqual(removedState.localCalculatedFields, []);
assert.deepEqual(removedState.selectedMeasures, ["totalSpend"]);
assert.equal(removedState.primaryMeasure, "totalSpend");
assert.equal(removedState.orderField, "");
assert.deepEqual(removedState.chartSpec, {
    title: "Projected Lift by Date",
    type: "line",
    xField: "eventDate",
    yFields: ["totalSpend"],
});
assert.deepEqual(removedState.activeTablePreset, {
    id: "preset_1",
    title: "Projected Lift",
    dimensions: ["eventDate"],
    measures: ["totalSpend"],
    columns: [
        { key: "eventDate" },
    ],
});
assert.deepEqual(removedState.lastTablePreset, {
    id: "preset_2",
    title: "Projected Lift Saved",
    dimensions: ["eventDate"],
    measures: [],
    columns: [],
});

const removedTableCalculationState = removeReportBuilderLocalTableCalculationState({
    localTableCalculations: createdTableCalculationState.nextState.localTableCalculations,
    selectedMeasures: ["totalSpend", "reachShare"],
    primaryMeasure: "reachShare",
    orderField: "reachShare",
    chartSpec: {
        title: "Reach Share by Date",
        type: "line",
        xField: "eventDate",
        yFields: ["reachShare", "totalSpend"],
        seriesOptions: {
            reachShare: { axis: "right" },
        },
    },
    activeTablePreset: {
        id: "preset_3",
        title: "Reach Share Saved",
        dimensions: ["eventDate"],
        measures: ["reachShare", "totalSpend"],
        columns: [
            { key: "eventDate" },
            { key: "reachShare" },
        ],
    },
    lastTablePreset: {
        id: "preset_4",
        title: "Reach Share Recent",
        dimensions: ["eventDate"],
        measures: ["reachShare"],
        columns: [
            { key: "reachShare" },
        ],
    },
}, "reachShare");
assert.deepEqual(removedTableCalculationState.localTableCalculations, []);
assert.deepEqual(removedTableCalculationState.selectedMeasures, ["totalSpend"]);
assert.equal(removedTableCalculationState.primaryMeasure, "totalSpend");
assert.equal(removedTableCalculationState.orderField, "");
assert.deepEqual(removedTableCalculationState.chartSpec, {
    title: "Reach Share by Date",
    type: "line",
    xField: "eventDate",
    yFields: ["totalSpend"],
});

console.log("reportBuilderCalculatedFieldAuthoring ✓ merges, validates, saves, and removes local calculated fields");
