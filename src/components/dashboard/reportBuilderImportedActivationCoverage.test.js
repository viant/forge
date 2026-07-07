import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ReportBuilder.jsx", import.meta.url), "utf8");

assert.ok(
    source.includes('activateImportedLocalReopenable(entry.targetIdentity || entry.id, entry.title)'),
    "expected imported reopenable activation to prefer targetIdentity",
);

assert.ok(
    source.includes('activateImportedLocalSavedRecord(entry.targetIdentity || entry.id, entry.title)'),
    "expected imported saved-record activation to prefer targetIdentity",
);

console.log("reportBuilderImportedActivationCoverage ✓ imported activation paths prefer stable targetIdentity");
