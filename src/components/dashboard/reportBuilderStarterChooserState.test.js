import assert from "node:assert/strict";

import {
    isBlankReportBuilderStarterId,
    isReportBuilderStarterReady,
    shouldShowReportBuilderStarterChooser,
} from "./reportBuilderStarterChooserState.js";

assert.equal(isBlankReportBuilderStarterId("__blank__"), true);
assert.equal(isBlankReportBuilderStarterId(" capacity_inventory "), false);
assert.equal(isReportBuilderStarterReady(), true);
assert.equal(isReportBuilderStarterReady({
    requestedStarterId: "__blank__",
    currentTemplateId: "",
}), true);
assert.equal(isReportBuilderStarterReady({
    requestedStarterId: "capacity_inventory",
    currentTemplateId: "capacity_inventory",
}), true);
assert.equal(isReportBuilderStarterReady({
    requestedStarterId: "capacity_inventory",
    currentTemplateId: "",
}), false);

assert.equal(shouldShowReportBuilderStarterChooser(), true);
assert.equal(shouldShowReportBuilderStarterChooser({ authoredBlockCount: 2 }), false);

console.log("reportBuilderStarterChooserState ✓ derives blank-report starter visibility for the designer");
