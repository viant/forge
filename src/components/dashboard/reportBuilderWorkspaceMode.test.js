import assert from "node:assert/strict";

import {
    DEFAULT_REPORT_BUILDER_COMPACT_WORKSPACE_MODE,
    DEFAULT_REPORT_BUILDER_DESKTOP_WORKSPACE_MODE,
    isReportBuilderDesignWorkspaceMode,
    resolveReportBuilderCompactMode,
    normalizeReportBuilderWorkspaceMode,
    REPORT_BUILDER_COMPACT_WORKSPACE_MODES,
    REPORT_BUILDER_DESKTOP_WORKSPACE_MODES,
    resolveReportBuilderCompactBreakpoint,
    resolveReportBuilderWorkspaceModeDescription,
    resolveReportBuilderWorkspaceModeLabel,
    resolveReportBuilderWorkspaceModes,
} from "./reportBuilderWorkspaceMode.js";

assert.deepEqual(REPORT_BUILDER_DESKTOP_WORKSPACE_MODES, ["report", "design"]);
assert.deepEqual(REPORT_BUILDER_COMPACT_WORKSPACE_MODES, ["report", "design"]);
assert.equal(DEFAULT_REPORT_BUILDER_DESKTOP_WORKSPACE_MODE, "report");
assert.equal(DEFAULT_REPORT_BUILDER_COMPACT_WORKSPACE_MODE, "report");

assert.equal(resolveReportBuilderCompactBreakpoint({}), 820);
assert.equal(resolveReportBuilderCompactBreakpoint({ compactBreakpoint: 960 }), 960);
assert.equal(resolveReportBuilderCompactBreakpoint({ layout: { compactBreakpoint: 900 } }), 900);

assert.equal(resolveReportBuilderCompactMode({
    viewportWidth: 720,
    builderWidth: 640,
    compactBreakpoint: 820,
}), true);
assert.equal(resolveReportBuilderCompactMode({
    viewportWidth: 1440,
    builderWidth: 640,
    compactBreakpoint: 820,
}), false);
assert.equal(resolveReportBuilderCompactMode({
    viewportWidth: 0,
    builderWidth: 640,
    compactBreakpoint: 820,
}), true);
assert.equal(resolveReportBuilderCompactMode({
    viewportWidth: 0,
    builderWidth: 960,
    compactBreakpoint: 820,
}), false);

assert.deepEqual(resolveReportBuilderWorkspaceModes({ compactMode: false }), ["report", "design"]);
assert.deepEqual(resolveReportBuilderWorkspaceModes({ compactMode: true }), ["report", "design"]);

assert.equal(normalizeReportBuilderWorkspaceMode("design", { compactMode: false }), "design");
assert.equal(normalizeReportBuilderWorkspaceMode("report", { compactMode: false }), "report");
assert.equal(normalizeReportBuilderWorkspaceMode("design", { compactMode: true }), "design");
assert.equal(normalizeReportBuilderWorkspaceMode("report", { compactMode: true }), "report");
// Legacy persisted Preview mode collapses into the primary Report surface.
assert.equal(normalizeReportBuilderWorkspaceMode("preview", { compactMode: false }), "report");
assert.equal(normalizeReportBuilderWorkspaceMode("preview", { compactMode: true }), "report");
assert.equal(normalizeReportBuilderWorkspaceMode("weird", { compactMode: false }), "report");
assert.equal(normalizeReportBuilderWorkspaceMode("weird", { compactMode: true }), "report");

assert.equal(resolveReportBuilderWorkspaceModeLabel("design"), "Design");
assert.equal(resolveReportBuilderWorkspaceModeLabel("report"), "Report");
assert.equal(resolveReportBuilderWorkspaceModeLabel("preview"), "Report");
assert.equal(resolveReportBuilderWorkspaceModeDescription("design"), "Compose authored blocks and shape the report.");
assert.equal(resolveReportBuilderWorkspaceModeDescription("report"), "Run the report and review the live result.");
assert.equal(resolveReportBuilderWorkspaceModeDescription("preview"), "Run the report and review the live result.");

assert.equal(isReportBuilderDesignWorkspaceMode("design", { compactMode: false }), true);
assert.equal(isReportBuilderDesignWorkspaceMode("preview", { compactMode: false }), false);
assert.equal(isReportBuilderDesignWorkspaceMode("report", { compactMode: false }), false);
assert.equal(isReportBuilderDesignWorkspaceMode("design", { compactMode: true }), true);

console.log("reportBuilderWorkspaceMode ✓ normalizes builder workspace modes and folds legacy preview into report");
