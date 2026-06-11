import assert from "node:assert/strict";

import {
    buildReportBuilderActionModel,
    resolveReportBuilderResultModes,
} from "./reportBuilderActionModel.js";

assert.deepEqual(
    resolveReportBuilderResultModes({
        viewModes: ["chart", "table", "json"],
        explicitChartMode: false,
    }),
    ["chart", "table", "json"],
);

assert.deepEqual(
    resolveReportBuilderResultModes({
        viewModes: ["chart", "table", "json"],
        explicitChartMode: true,
    }),
    ["chart", "table"],
);

assert.deepEqual(
    buildReportBuilderActionModel({
        viewModes: ["chart", "table", "json"],
        explicitChartMode: true,
        hasValidChartSpec: true,
        canShowResults: true,
        canRunReport: true,
        loading: false,
    }),
    {
        resultModes: ["chart", "table"],
        desktop: {
            showQuickChartActions: true,
            showEditChart: true,
            overflowActionIds: ["removeChart"],
        },
        compact: {
            showHeaderViewToggle: true,
            chartSheet: {
                showQuickChartActions: true,
                showEditChart: true,
                showRemoveChart: true,
                showViewToggle: true,
                showExport: true,
                showEmptyState: false,
            },
            bottomBar: [
                {
                    id: "setup",
                    label: "Setup",
                    icon: "panel-table",
                    disabled: false,
                    tone: "secondary",
                },
                {
                    id: "chart",
                    label: "Chart",
                    icon: "timeline-line-chart",
                    disabled: false,
                    tone: "secondary",
                },
                {
                    id: "run",
                    label: "Run",
                    icon: "play",
                    disabled: false,
                    tone: "primary",
                },
            ],
        },
    },
);

assert.deepEqual(
    buildReportBuilderActionModel({
        viewModes: ["chart", "table"],
        explicitChartMode: true,
        hasValidChartSpec: false,
        canShowResults: false,
        canRunReport: false,
        loading: true,
    }),
    {
        resultModes: ["chart", "table"],
        desktop: {
            showQuickChartActions: true,
            showEditChart: false,
            overflowActionIds: [],
        },
        compact: {
            showHeaderViewToggle: false,
            chartSheet: {
                showQuickChartActions: true,
                showEditChart: false,
                showRemoveChart: false,
                showViewToggle: false,
                showExport: false,
                showEmptyState: true,
            },
            bottomBar: [
                {
                    id: "setup",
                    label: "Setup",
                    icon: "panel-table",
                    disabled: false,
                    tone: "secondary",
                },
                {
                    id: "chart",
                    label: "Chart",
                    icon: "timeline-line-chart",
                    disabled: false,
                    tone: "secondary",
                },
                {
                    id: "run",
                    label: "Running",
                    icon: "play",
                    disabled: true,
                    tone: "primary",
                },
            ],
        },
    },
);

console.log("reportBuilderActionModel ✓ shared desktop and compact action contract");
