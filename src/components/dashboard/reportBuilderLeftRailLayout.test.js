import assert from "node:assert/strict";

import {
    clampReportBuilderLeftRailWidthPercent,
    DEFAULT_REPORT_BUILDER_RESULT_PANE_POSITION,
    DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT,
    MAX_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT,
    MIN_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT,
    normalizeReportBuilderResultPanePosition,
    resolveReportBuilderNextResultPanePosition,
    resolveReportBuilderResultPanePositionActionLabel,
    resolveReportBuilderResultPanePositionLabel,
    resolveReportBuilderLeftRailMoveActionLabel,
    resolveReportBuilderLeftRailResizeDelta,
    resolveReportBuilderLeftRailWidthAriaValueText,
    resolveReportBuilderLeftRailWidthLabel,
    resolveReportBuilderConfiguredLeftRailWidthPercent,
    resolveReportBuilderLeftRailWidthPercentForMove,
    resolveReportBuilderLeftRailWidthPercentForKey,
} from "./reportBuilderLeftRailLayout.js";

assert.equal(clampReportBuilderLeftRailWidthPercent(undefined), DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT);
assert.equal(clampReportBuilderLeftRailWidthPercent("NaN"), DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT);
assert.equal(clampReportBuilderLeftRailWidthPercent(2), MIN_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT);
assert.equal(clampReportBuilderLeftRailWidthPercent(90), MAX_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT);

assert.equal(resolveReportBuilderLeftRailResizeDelta("ArrowLeft", "right"), -1);
assert.equal(resolveReportBuilderLeftRailResizeDelta("ArrowRight", "right"), 1);
assert.equal(resolveReportBuilderLeftRailResizeDelta("ArrowLeft", "left"), 1);
assert.equal(resolveReportBuilderLeftRailResizeDelta("ArrowRight", "left"), -1);
assert.equal(resolveReportBuilderLeftRailResizeDelta("Escape", "right"), 0);

assert.equal(resolveReportBuilderLeftRailWidthPercentForKey("ArrowRight", 24, "right"), 25);
assert.equal(resolveReportBuilderLeftRailWidthPercentForKey("ArrowLeft", 24, "right"), 23);
assert.equal(resolveReportBuilderLeftRailWidthPercentForKey("ArrowLeft", 24, "left"), 25);
assert.equal(resolveReportBuilderLeftRailWidthPercentForKey("ArrowRight", 24, "left"), 23);
assert.equal(resolveReportBuilderLeftRailWidthPercentForKey("Home", 28, "right"), MIN_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT);
assert.equal(resolveReportBuilderLeftRailWidthPercentForKey("End", 22, "right"), MAX_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT);
assert.equal(resolveReportBuilderLeftRailWidthPercentForKey("Enter", 31, "right"), DEFAULT_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT);
assert.equal(resolveReportBuilderLeftRailWidthPercentForMove("left", 24, "right"), 23);
assert.equal(resolveReportBuilderLeftRailWidthPercentForMove("right", 24, "right"), 25);
assert.equal(resolveReportBuilderLeftRailWidthPercentForMove("left", 24, "left"), 25);
assert.equal(resolveReportBuilderLeftRailWidthPercentForMove("right", 24, "left"), 23);
assert.equal(resolveReportBuilderLeftRailWidthPercentForMove("idle", 31, "right"), 31);

assert.equal(resolveReportBuilderLeftRailWidthLabel(24.4), "24%");
assert.equal(resolveReportBuilderLeftRailWidthAriaValueText(27.8), "Setup panel width 28%");
assert.equal(resolveReportBuilderLeftRailMoveActionLabel("left"), "Move divider left");
assert.equal(resolveReportBuilderLeftRailMoveActionLabel("right"), "Move divider right");
assert.equal(resolveReportBuilderConfiguredLeftRailWidthPercent({}), null);
assert.equal(resolveReportBuilderConfiguredLeftRailWidthPercent({ layout: { leftRailWidthPercent: "" } }), null);
assert.equal(resolveReportBuilderConfiguredLeftRailWidthPercent({ layout: { leftRailWidthPercent: "wide" } }), null);
assert.equal(resolveReportBuilderConfiguredLeftRailWidthPercent({ layout: { leftRailWidthPercent: 10 } }), MIN_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT);
assert.equal(resolveReportBuilderConfiguredLeftRailWidthPercent({ layout: { leftRailWidthPercent: 18 } }), 18);
assert.equal(resolveReportBuilderConfiguredLeftRailWidthPercent({ layout: { leftRailWidthPercent: 28 } }), 28);
assert.equal(resolveReportBuilderConfiguredLeftRailWidthPercent({ layout: { leftRailWidthPercent: 40 } }), 40);
assert.equal(resolveReportBuilderConfiguredLeftRailWidthPercent({ layout: { leftRailWidthPercent: 60 } }), MAX_REPORT_BUILDER_LEFT_RAIL_WIDTH_PERCENT);

assert.equal(DEFAULT_REPORT_BUILDER_RESULT_PANE_POSITION, "right");
assert.equal(normalizeReportBuilderResultPanePosition("left"), "left");
assert.equal(normalizeReportBuilderResultPanePosition("RIGHT"), "right");
assert.equal(resolveReportBuilderNextResultPanePosition("left"), "right");
assert.equal(resolveReportBuilderNextResultPanePosition("right"), "left");
assert.equal(resolveReportBuilderResultPanePositionLabel("left"), "Results left");
assert.equal(resolveReportBuilderResultPanePositionLabel("right"), "Results right");
assert.equal(resolveReportBuilderResultPanePositionActionLabel("left"), "Move results to right side");
assert.equal(resolveReportBuilderResultPanePositionActionLabel("right"), "Move results to left side");

console.log("reportBuilderLeftRailLayout ✓ clamps, labels, and keyboard resize controls for the setup rail");
