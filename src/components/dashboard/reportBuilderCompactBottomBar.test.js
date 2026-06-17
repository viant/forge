import assert from "node:assert/strict";

import { buildReportBuilderCompactBottomBarActions } from "./reportBuilderCompactBottomBar.js";

const onOpenSetup = () => "setup";
const onOpenChart = () => "chart";
const onRunPrimary = () => "run";

assert.deepEqual(buildReportBuilderCompactBottomBarActions({
    bottomBar: [
        { id: "setup", label: "Setup", icon: "panel-table", disabled: false, tone: "secondary" },
        { id: "chart", label: "Chart", icon: "timeline-line-chart", disabled: false, tone: "secondary" },
        { id: "run", label: "Run", icon: "play", disabled: false, tone: "primary" },
    ],
    onOpenSetup,
    onOpenChart,
    onRunPrimary,
}), [
    { id: "setup", label: "Setup", icon: "panel-table", disabled: false, tone: "secondary", onClick: onOpenSetup },
    { id: "chart", label: "Chart", icon: "timeline-line-chart", disabled: false, tone: "secondary", onClick: onOpenChart },
    { id: "run", label: "Run", icon: "play", disabled: false, tone: "primary", onClick: onRunPrimary },
]);

assert.deepEqual(buildReportBuilderCompactBottomBarActions({
    bottomBar: [
        { id: "other", label: "Other" },
    ],
    onOpenSetup,
    onOpenChart,
    onRunPrimary,
}), []);

console.log("reportBuilderCompactBottomBar ✓ bottom bar action wiring");
