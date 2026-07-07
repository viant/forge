import assert from "node:assert/strict";

import {
    buildReportBuilderStarterAppliedState,
    resolveAutoAppliedReportStarterId,
} from "./reportBuilderStarterState.js";

assert.equal(
    resolveAutoAppliedReportStarterId({
        requestedReportStarterId: "forecast_inventory_brief",
        prefillReportStarterId: "ignored_prefill_template",
        hasPrefill: true,
        authoredBlockCount: 0,
        availableTemplateIds: ["forecast_inventory_brief"],
    }),
    "forecast_inventory_brief",
);

assert.equal(
    resolveAutoAppliedReportStarterId({
        requestedReportStarterId: "",
        prefillReportStarterId: "forecast_inventory_brief",
        hasPrefill: true,
        currentTemplateId: "",
        authoredBlockCount: 0,
        availableTemplateIds: ["forecast_inventory_brief"],
    }),
    "forecast_inventory_brief",
);

assert.equal(
    resolveAutoAppliedReportStarterId({
        prefillReportStarterId: "forecast_inventory_brief",
        hasPrefill: false,
        authoredBlockCount: 0,
        availableTemplateIds: ["forecast_inventory_brief"],
    }),
    "",
);

assert.equal(
    resolveAutoAppliedReportStarterId({
        prefillReportStarterId: "forecast_inventory_brief",
        hasPrefill: true,
        currentTemplateId: "already_set",
        authoredBlockCount: 0,
        availableTemplateIds: ["forecast_inventory_brief"],
    }),
    "",
);

assert.equal(
    resolveAutoAppliedReportStarterId({
        prefillReportStarterId: "forecast_inventory_brief",
        hasPrefill: true,
        currentTemplateId: "",
        authoredBlockCount: 2,
        availableTemplateIds: ["forecast_inventory_brief"],
    }),
    "",
);

assert.equal(
    resolveAutoAppliedReportStarterId({
        prefillReportStarterId: "forecast_inventory_brief",
        hasPrefill: true,
        currentTemplateId: "",
        authoredBlockCount: 0,
        availableTemplateIds: ["other_template"],
    }),
    "",
);

const stripped = buildReportBuilderStarterAppliedState({
    reportDocumentTemplateId: "forecast_inventory_brief",
    reportDocumentBlocks: [{ id: "narrative", kind: "markdownBlock", markdown: "x" }],
    explorationSession: { id: "draft" },
});

assert.equal(stripped.explorationSession, undefined);

console.log("reportBuilderStarterState ✓ resolves auto-applied prefill starters and clears transient draft state");
