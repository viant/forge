import assert from "node:assert/strict";

import { mergeReportBuilderReopenedConfig } from "./reportBuilderConfigMerge.js";

const baseConfig = {
    title: "Demo",
    reportDocumentSavedPayloads: [
        { savedReportPayload: { reportDocument: { id: "capacityQ3" } } },
    ],
    reportDocumentListEntries: [
        { reportRef: { reportId: "capacityQ3" } },
    ],
    reportDocumentTemplates: [
        { id: "capacity_inventory_brief" },
    ],
    result: {
        defaultMode: "table",
    },
};

const reopenedConfig = {
    title: "Reopened Demo",
    result: {
        defaultMode: "chart",
    },
};

assert.deepEqual(mergeReportBuilderReopenedConfig(baseConfig, reopenedConfig), {
    title: "Reopened Demo",
    reportDocumentSavedPayloads: [
        { savedReportPayload: { reportDocument: { id: "capacityQ3" } } },
    ],
    reportDocumentListEntries: [
        { reportRef: { reportId: "capacityQ3" } },
    ],
    reportDocumentTemplates: [
        { id: "capacity_inventory_brief" },
    ],
    result: {
        defaultMode: "chart",
    },
});

assert.deepEqual(mergeReportBuilderReopenedConfig(baseConfig, {
    reportDocumentSavedPayloads: [
        { savedReportPayload: { reportDocument: { id: "override" } } },
    ],
}), {
    ...baseConfig,
    reportDocumentSavedPayloads: [
        { savedReportPayload: { reportDocument: { id: "override" } } },
    ],
});

assert.equal(mergeReportBuilderReopenedConfig(baseConfig, null), baseConfig);

console.log("reportBuilderConfigMerge ✓ preserves seeded saved/report-document config when reopening builder state");
