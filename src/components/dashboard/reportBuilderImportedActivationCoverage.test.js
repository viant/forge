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

assert.ok(
    source.includes('activeImportedSemanticSessionMatchesCurrentArtifact'),
    "expected activation cards to rely on the canonical hydrated-session signal",
);

assert.ok(
    source.includes('useExplicitActivationState: true'),
    "expected activation cards to avoid treating local import tracking as active state",
);

console.log("reportBuilderImportedActivationCoverage ✓ imported activation paths prefer stable targetIdentity");
