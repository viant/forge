import assert from "node:assert/strict";
import {
    applySavedReportRunOverride,
} from "./reportBuilderRunOverrides.js";

const override = {
    from: "2026-07-27",
    to: "2026-07-30",
    orderIds: [2637055],
};

const response = applySavedReportRunOverride({
    document: {
        scope: {
            params: [
                { id: "dateRange", value: { start: "2026-07-25", end: "2026-07-31" } },
                { id: "orderIds", value: [111] },
                { id: "channelIds", value: [1] },
            ],
        },
    },
}, override);

assert.deepEqual(response.document.scope.params, [
    { id: "dateRange", value: { start: "2026-07-27", end: "2026-07-30" } },
    { id: "orderIds", value: [2637055] },
    { id: "channelIds", value: [1] },
]);

console.log("reportBuilderRunOverrides ✓ temporary scope is applied immutably");
