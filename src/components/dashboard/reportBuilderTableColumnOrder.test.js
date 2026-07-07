import assert from "node:assert/strict";

import { placeReportBuilderTableColumnKeyRelative } from "./reportBuilderTableColumnOrder.js";

assert.deepEqual(
    placeReportBuilderTableColumnKeyRelative(
        ["channelV2", "avails", "hhUniqs", "reachRate"],
        "eventDate",
        "channelV2",
        "before",
    ),
    ["eventDate", "channelV2", "avails", "hhUniqs", "reachRate"],
);

assert.deepEqual(
    placeReportBuilderTableColumnKeyRelative(
        ["eventDate", "channelV2", "avails", "hhUniqs", "reachRate"],
        "reachRate",
        "channelV2",
        "before",
    ),
    ["eventDate", "reachRate", "channelV2", "avails", "hhUniqs"],
);

assert.deepEqual(
    placeReportBuilderTableColumnKeyRelative(
        ["eventDate", "channelV2", "avails"],
        "eventDate",
        "avails",
        "after",
    ),
    ["channelV2", "avails", "eventDate"],
);

assert.deepEqual(
    placeReportBuilderTableColumnKeyRelative(
        ["eventDate", "channelV2"],
        "country",
        "",
        "after",
    ),
    ["eventDate", "channelV2", "country"],
);

console.log("reportBuilderTableColumnOrder ✓ places new and existing table fields relative to the target column");
