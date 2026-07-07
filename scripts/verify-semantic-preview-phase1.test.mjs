import assert from "node:assert/strict";

import { buildPhase1SemanticVerificationSteps } from "./verify-semantic-preview-phase1.mjs";

const defaultSteps = buildPhase1SemanticVerificationSteps();
const structuralSteps = buildPhase1SemanticVerificationSteps({
  skipBrowserSmoke: true,
});

assert.equal(Array.isArray(defaultSteps), true);
assert.equal(defaultSteps.length > 0, true);
assert.equal(
  defaultSteps.some((step) => step?.label === "self-hosted preview smoke"),
  true,
);

assert.equal(Array.isArray(structuralSteps), true);
assert.equal(structuralSteps.length > 0, true);
assert.equal(
  structuralSteps.some((step) => step?.label === "self-hosted preview smoke"),
  false,
);
assert.equal(
  structuralSteps.length,
  defaultSteps.length - 1,
);
assert.equal(
  structuralSteps.some((step) => step?.label === "semantic runtime path structural suite"),
  true,
);

console.log("verify-semantic-preview-phase1 ✓ supports a browserless structural verification mode while preserving the full smoke-inclusive plan");
