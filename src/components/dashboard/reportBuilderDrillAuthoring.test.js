import assert from "node:assert/strict";

import {
    buildReportBuilderDetailParameterDraftRowsFromParameters,
    buildReportBuilderDetailParameterDraftRow,
    buildReportBuilderDetailTargetParameters,
    buildReportBuilderDetailTargetDraftFromBinding,
    buildReportBuilderDetailTargetDraftFromTarget,
    buildReportBuilderDetailTargetAction,
    buildReportBuilderDrillHierarchyFromDimensions,
    buildReportBuilderDrillHierarchyId,
    hasReportBuilderDetailParameterDraftContent,
    removeReportBuilderDetailTargetState,
    removeReportBuilderDrillHierarchyState,
    resolveReportBuilderDetailTargetDraftParameters,
    validateReportBuilderDetailTargetDraft,
    normalizeReportBuilderDetailParameterDraftRows,
    upsertReportBuilderDetailTargetState,
    upsertReportBuilderDrillHierarchyState,
} from "./reportBuilderDrillAuthoring.js";

const dimensions = [
    { id: "channelV2", key: "channelV2", label: "Channel" },
    { id: "publisherId", key: "publisherId", label: "Publisher" },
    { id: "siteType", key: "siteType", label: "Site Type" },
];

const hierarchy = buildReportBuilderDrillHierarchyFromDimensions(dimensions);

assert.deepEqual(hierarchy, {
    id: "hierarchy:channelV2::publisherId::siteType",
    label: "Channel Drill",
    levels: [
        { id: "channelV2", field: "channelV2", label: "Channel" },
        { id: "publisherId", field: "publisherId", label: "Publisher" },
        { id: "siteType", field: "siteType", label: "Site Type" },
    ],
});

assert.equal(buildReportBuilderDrillHierarchyId(hierarchy.levels), "hierarchy:channelV2::publisherId::siteType");
assert.equal(buildReportBuilderDrillHierarchyFromDimensions(dimensions.slice(0, 1)), null);

const seededState = {
    selectedDimensions: ["channelV2", "publisherId"],
};
const seededConfigHierarchy = {
    id: "seeded",
    levels: [
        { id: "region", field: "region", label: "Region" },
        { id: "country", field: "country", label: "Market" },
    ],
};

const upsertedState = upsertReportBuilderDrillHierarchyState(seededState, hierarchy, {
    currentHierarchies: [seededConfigHierarchy],
});

assert.deepEqual(upsertedState.drillMetadata, {
    hierarchies: [
        seededConfigHierarchy,
        hierarchy,
    ],
});

const removedState = removeReportBuilderDrillHierarchyState(upsertedState, hierarchy.id, {
    currentHierarchies: upsertedState.drillMetadata.hierarchies,
});

assert.deepEqual(removedState.drillMetadata, {
    hierarchies: [seededConfigHierarchy],
});

const clearedSeededState = removeReportBuilderDrillHierarchyState(seededState, seededConfigHierarchy.id, {
    currentHierarchies: [seededConfigHierarchy],
});

assert.deepEqual(clearedSeededState.drillMetadata, {
    hierarchies: [],
});

const detailAction = buildReportBuilderDetailTargetAction(dimensions[0], {
    targetRef: "target://demo/channel-detail",
    navigationMode: "hostRoute",
    parameters: {
        channel: "$value",
        scope: "$row.scopeFilter",
    },
});

assert.deepEqual(buildReportBuilderDetailTargetParameters([
    { parameter: "channel", valueKind: "runtimeValue" },
    { parameter: "scope", valueKind: "rowField", valueRef: "scopeFilter" },
    { parameter: "view", valueKind: "literal", valueRef: "overview" },
]), {
    channel: "$value",
    scope: "$row.scopeFilter",
    view: "overview",
});
assert.deepEqual(buildReportBuilderDetailTargetParameters([], "channelV2"), {
    channelV2: "$value",
});
assert.deepEqual(buildReportBuilderDetailParameterDraftRow("row_1", {
    parameter: "scope",
    valueKind: "rowField",
    valueRef: "scopeFilter",
}), {
    id: "row_1",
    parameter: "scope",
    valueKind: "rowField",
    valueRef: "scopeFilter",
});
assert.deepEqual(normalizeReportBuilderDetailParameterDraftRows([], {
    fallbackId: "detailParam_test",
}), [
    {
        id: "detailParam_test",
        parameter: "",
        valueKind: "runtimeValue",
        valueRef: "",
    },
]);
assert.equal(hasReportBuilderDetailParameterDraftContent([
    {
        id: "row_1",
        parameter: "channel",
        valueKind: "runtimeValue",
        valueRef: "",
    },
]), true);
assert.equal(hasReportBuilderDetailParameterDraftContent([]), false);
assert.deepEqual(buildReportBuilderDetailParameterDraftRowsFromParameters({
    channel: "$value",
    scope: "$row.scopeFilter",
    view: "overview",
}, {
    fallbackId: "detailParam_seed",
}), [
    {
        id: "detailParam_seed_0",
        parameter: "channel",
        valueKind: "runtimeValue",
        valueRef: "",
    },
    {
        id: "detailParam_seed_1",
        parameter: "scope",
        valueKind: "rowField",
        valueRef: "scopeFilter",
    },
    {
        id: "detailParam_seed_2",
        parameter: "view",
        valueKind: "literal",
        valueRef: "overview",
    },
]);
assert.deepEqual(resolveReportBuilderDetailTargetDraftParameters([], "channelV2", {
    scope: "$row.scopeFilter",
}), {
    scope: "$row.scopeFilter",
});
assert.deepEqual(buildReportBuilderDetailTargetDraftFromBinding({
    fieldRef: "channelV2",
    targetRef: "target://demo/channel-detail",
    target: {
        navigationMode: "modal",
        title: "Channel detail",
        description: "Open channel detail.",
        parameters: {
            channel: "$value",
        },
    },
}, {
    fallbackIdPrefix: "detailParam_binding",
}), {
    fieldRef: "channelV2",
    targetRef: "target://demo/channel-detail",
    navigationMode: "modal",
    title: "Channel detail",
    description: "Open channel detail.",
    parameterRows: [
        {
            id: "detailParam_binding_0",
            parameter: "channel",
            valueKind: "runtimeValue",
            valueRef: "",
        },
    ],
});
assert.deepEqual(buildReportBuilderDetailTargetDraftFromTarget({
    targetRef: "target://demo/channel-detail",
    navigationMode: "hostRoute",
    title: "Channel detail",
    description: "Open channel detail.",
    parameters: {
        channel: "$value",
        scope: "$row.scopeFilter",
    },
}, {
    fallbackIdPrefix: "detailParam_target",
}), {
    targetRef: "target://demo/channel-detail",
    navigationMode: "hostRoute",
    title: "Channel detail",
    description: "Open channel detail.",
    parameterRows: [
        {
            id: "detailParam_target_0",
            parameter: "channel",
            valueKind: "runtimeValue",
            valueRef: "",
        },
        {
            id: "detailParam_target_1",
            parameter: "scope",
            valueKind: "rowField",
            valueRef: "scopeFilter",
        },
    ],
});
assert.deepEqual(validateReportBuilderDetailTargetDraft({
    field: dimensions[0],
    targetRef: "target://demo/channel-detail",
    parameterRows: [
        { id: "row_1", parameter: "channel", valueKind: "runtimeValue", valueRef: "" },
        { id: "row_2", parameter: "scope", valueKind: "rowField", valueRef: "scopeFilter" },
    ],
}), {
    valid: true,
    errors: [],
    parameterRows: [
        { id: "row_1", parameter: "channel", valueKind: "runtimeValue", valueRef: "" },
        { id: "row_2", parameter: "scope", valueKind: "rowField", valueRef: "scopeFilter" },
    ],
});
assert.deepEqual(validateReportBuilderDetailTargetDraft({
    field: dimensions[0],
    targetRef: "target://demo/channel-detail",
    parameterRows: [
        { id: "row_1", parameter: "channel", valueKind: "runtimeValue", valueRef: "" },
        { id: "row_2", parameter: "channel", valueKind: "literal", valueRef: "dup" },
        { id: "row_3", parameter: "scope", valueKind: "rowField", valueRef: "" },
    ],
}), {
    valid: false,
    errors: [
        {
            field: "parameterRows.1.parameter",
            code: "duplicate",
            message: "Detail parameter 'channel' is defined more than once.",
        },
        {
            field: "parameterRows.2.valueRef",
            code: "required",
            message: "Choose a row field for detail parameter 'scope'.",
        },
    ],
    parameterRows: [
        { id: "row_1", parameter: "channel", valueKind: "runtimeValue", valueRef: "" },
        { id: "row_2", parameter: "channel", valueKind: "literal", valueRef: "dup" },
        { id: "row_3", parameter: "scope", valueKind: "rowField", valueRef: "" },
    ],
});

assert.deepEqual(detailAction, {
    detailTarget: {
        targetRef: "target://demo/channel-detail",
        navigationMode: "hostRoute",
        parameters: {
            channel: "$value",
            scope: "$row.scopeFilter",
        },
        title: "Channel detail",
    },
    fieldAction: {
        fieldRef: "channelV2",
        actions: [
            {
                id: "detail:channelV2:target:_demo_channel-detail",
                label: "Show Channel details",
                kind: "detail",
                targetRef: "target://demo/channel-detail",
            },
        ],
    },
});

const detailState = upsertReportBuilderDetailTargetState(seededState, {
    field: dimensions[0],
    targetRef: "target://demo/channel-detail",
    navigationMode: "hostRoute",
    parameters: {
        channel: "$value",
        scope: "$row.scopeFilter",
    },
    description: "Open the selected channel detail route.",
}, {
    currentDetailTargets: [
        {
            targetRef: "target://seeded/date-detail",
            navigationMode: "hostRoute",
            parameters: {
                eventDate: "$value",
            },
        },
    ],
    currentFieldActions: [
        {
            fieldRef: "eventDate",
            actions: [
                {
                    id: "detail:eventDate:target:_seeded_date-detail",
                    label: "Show date details",
                    kind: "detail",
                    targetRef: "target://seeded/date-detail",
                },
            ],
        },
    ],
});

assert.deepEqual(detailState.drillMetadata.detailTargets, [
    {
        targetRef: "target://seeded/date-detail",
        navigationMode: "hostRoute",
        parameters: {
            eventDate: "$value",
        },
    },
    {
        targetRef: "target://demo/channel-detail",
        navigationMode: "hostRoute",
        parameters: {
            channel: "$value",
            scope: "$row.scopeFilter",
        },
        title: "Channel detail",
        description: "Open the selected channel detail route.",
    },
]);
assert.deepEqual(detailState.drillMetadata.fieldActions, [
    {
        fieldRef: "eventDate",
        actions: [
            {
                id: "detail:eventDate:target:_seeded_date-detail",
                label: "Show date details",
                kind: "detail",
                targetRef: "target://seeded/date-detail",
            },
        ],
    },
    {
        fieldRef: "channelV2",
        actions: [
            {
                id: "detail:channelV2:target:_demo_channel-detail",
                label: "Show Channel details",
                kind: "detail",
                targetRef: "target://demo/channel-detail",
            },
        ],
    },
]);

const removedDetailState = removeReportBuilderDetailTargetState(detailState, "target://demo/channel-detail", {
    currentDetailTargets: detailState.drillMetadata.detailTargets,
    currentFieldActions: detailState.drillMetadata.fieldActions,
});

assert.deepEqual(removedDetailState.drillMetadata.detailTargets, [
    {
        targetRef: "target://seeded/date-detail",
        navigationMode: "hostRoute",
        parameters: {
            eventDate: "$value",
        },
    },
]);
assert.deepEqual(removedDetailState.drillMetadata.fieldActions, [
    {
        fieldRef: "eventDate",
        actions: [
            {
                id: "detail:eventDate:target:_seeded_date-detail",
                label: "Show date details",
                kind: "detail",
                targetRef: "target://seeded/date-detail",
            },
        ],
    },
]);

const reboundDetailState = upsertReportBuilderDetailTargetState(detailState, {
    field: dimensions[1],
    targetRef: "target://demo/channel-detail",
    navigationMode: "hostRoute",
    parameters: {
        publisher: "$value",
    },
    title: "Publisher detail",
}, {
    currentDetailTargets: detailState.drillMetadata.detailTargets,
    currentFieldActions: detailState.drillMetadata.fieldActions,
});

assert.deepEqual(reboundDetailState.drillMetadata.detailTargets.find((entry) => entry.targetRef === "target://demo/channel-detail"), {
    targetRef: "target://demo/channel-detail",
    navigationMode: "hostRoute",
    parameters: {
        publisher: "$value",
    },
    title: "Publisher detail",
});
assert.deepEqual(reboundDetailState.drillMetadata.fieldActions, [
    {
        fieldRef: "eventDate",
        actions: [
            {
                id: "detail:eventDate:target:_seeded_date-detail",
                label: "Show date details",
                kind: "detail",
                targetRef: "target://seeded/date-detail",
            },
        ],
    },
    {
        fieldRef: "publisherId",
        actions: [
            {
                id: "detail:publisherId:target:_demo_channel-detail",
                label: "Show Publisher details",
                kind: "detail",
                targetRef: "target://demo/channel-detail",
            },
        ],
    },
]);

const reboundToNewTargetState = upsertReportBuilderDetailTargetState(detailState, {
    field: dimensions[0],
    targetRef: "target://demo/channel-detail-modal",
    replacedTargetRef: "target://demo/channel-detail",
    navigationMode: "modal",
    parameters: {
        channel: "$value",
        source: "archived",
    },
    title: "Archived Channel detail",
}, {
    currentDetailTargets: detailState.drillMetadata.detailTargets,
    currentFieldActions: detailState.drillMetadata.fieldActions,
});

assert.deepEqual(reboundToNewTargetState.drillMetadata.fieldActions, [
    {
        fieldRef: "eventDate",
        actions: [
            {
                id: "detail:eventDate:target:_seeded_date-detail",
                label: "Show date details",
                kind: "detail",
                targetRef: "target://seeded/date-detail",
            },
        ],
    },
    {
        fieldRef: "channelV2",
        actions: [
            {
                id: "detail:channelV2:target:_demo_channel-detail-modal",
                label: "Show Channel details",
                kind: "detail",
                targetRef: "target://demo/channel-detail-modal",
            },
        ],
    },
]);

console.log("reportBuilderDrillAuthoring ✓ captures builder-authored drill hierarchies and detail actions against the visible runtime set");
