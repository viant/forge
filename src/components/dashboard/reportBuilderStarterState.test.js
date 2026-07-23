import assert from "node:assert/strict";

import {
    buildReportBuilderStarterAppliedState,
    findReportBuilderStarterTemplate,
    resolveAutoAppliedReportStarterId,
} from "./reportBuilderStarterState.js";

const availableTemplates = [{
    id: "performance_delivery_command_center",
    label: "Performance Delivery Command Center",
}];

assert.equal(
    findReportBuilderStarterTemplate("Performance Delivery Command Center", availableTemplates)?.id,
    "performance_delivery_command_center",
);
assert.equal(
    findReportBuilderStarterTemplate("performanceDeliveryCommandCenter", availableTemplates),
    null,
    "unknown transformed ids must not resolve through a permissive fallback",
);

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
        requestedReportStarterId: "Performance Delivery Command Center",
        availableTemplates,
    }),
    "performance_delivery_command_center",
    "host requests may use the declared human label but must resolve to the stable preset id",
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
