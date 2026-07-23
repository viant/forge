import assert from "node:assert/strict";

import {
    resolveReportBuilderVariant,
    resolveReportBuilderVariantStateKey,
} from "./reportBuilderVariantModel.js";

const container = {
    id: "reportBuilder",
    dataSourceRef: "primary_data",
    dashboard: {
        reportBuilderRef: "primary",
        reportBuilder: { title: "Primary" },
        reportBuilders: {
            primary: {
                dataSourceRef: "primary_data",
                reportBuilder: { title: "Primary" },
            },
            secondary: {
                dataSourceRef: "secondary_data",
                reportBuilder: { title: "Secondary" },
            },
        },
    },
};

const secondary = resolveReportBuilderVariant(container, { reportBuilderRef: "secondary" });
assert.equal(secondary.builderRef, "secondary");
assert.equal(secondary.dataSourceRef, "secondary_data");
assert.equal(secondary.reportBuilder.title, "Secondary");
assert.equal(resolveReportBuilderVariantStateKey(container, secondary), "reportBuilder:secondary");

const missing = resolveReportBuilderVariant(container, { reportBuilderRef: "unknown" });
assert.equal(missing.missing, true);
assert.equal(missing.dataSourceRef, "");

console.log("reportBuilderVariantModel ✓ resolves source-scoped report builder variants");
