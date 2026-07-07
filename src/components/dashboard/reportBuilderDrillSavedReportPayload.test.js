import assert from "node:assert/strict";

import {
    buildReportBuilderSavedReportPayloadFromBuilderState,
    buildReportBuilderSavedReportPayloadSummary,
} from "./reportBuilderSavedReportPayload.js";

const payload = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_drill_summary",
    savedAt: 9500,
    title: "Drill Summary Demo",
    sourceArtifactId: "drill_summary_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "drillSummaryDemo",
        title: "Drill Summary Demo",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: {
        id: "drillSummaryBuilder",
        stateKey: "drillSummaryBuilder",
        title: "Drill Summary Builder",
        dataSourceRef: "demoReportSource",
    },
    config: {
        measures: [
            { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
        ],
        dimensions: [
            { id: "eventDate", key: "eventDate", label: "Event Date", default: true, chartAxis: true, format: "date" },
            { id: "channelV2", key: "channelV2", label: "Channel", default: true },
        ],
        staticFilters: [
            {
                id: "dateRange",
                type: "dateRange",
                required: true,
                startParamPath: "filters.From",
                endParamPath: "filters.To",
            },
        ],
        result: {
            chartCreationMode: "explicit",
            defaultMode: "table",
            pageSize: 50,
            orderFields: [
                { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
            ],
        },
    },
    state: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate", "channelV2"],
        viewMode: "table",
        scopeParams: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-04",
            },
        },
        drillMetadata: {
            hierarchies: [
                {
                    id: "hierarchy:eventDate::channelV2",
                    label: "Date Drill",
                    levels: [
                        { field: "eventDate", label: "Event Date" },
                        { field: "channelV2", label: "Channel" },
                    ],
                },
            ],
            detailTargets: [
                {
                    targetRef: "target://example/channel-detail",
                    navigationMode: "hostRoute",
                    title: "Channel detail",
                    parameters: {
                        channel: "$value",
                    },
                },
            ],
            fieldActions: [
                {
                    fieldRef: "channelV2",
                    actions: [
                        {
                            id: "detail:channelV2:target:_example_channel-detail",
                            label: "Show Channel details",
                            kind: "detail",
                            targetRef: "target://example/channel-detail",
                        },
                    ],
                },
            ],
        },
    },
    savedAt: 9600,
});

assert.equal(payload.reportSpec.drillMetadata.hierarchies.length, 1);
assert.equal(payload.reportSpec.drillMetadata.hierarchies[0].label, "Date Drill");
assert.equal(payload.reportSpec.drillMetadata.detailTargets.length, 1);
assert.equal(payload.reportSpec.drillMetadata.fieldActions.length, 1);

const summary = buildReportBuilderSavedReportPayloadSummary(payload);

assert.equal(summary.drillHierarchyCount, 1);
assert.equal(summary.detailTargetCount, 1);
assert.equal(summary.drillSummaryText, "1 drill hierarchy • 2 levels • 1 detail target • 1 field action");

console.log("reportBuilderDrillSavedReportPayload ✓ builder-authored drill hierarchies survive into saved report payload summaries");
