import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityAudienceArtifactFixtureState } from "./capacityAudienceArtifactFixtureState.js";
import { normalizeTemplateIdentityFixture } from "./normalizeTemplateIdentityFixture.js";

const fixtureUrl = new URL("./capacity-audience-artifact-fixture.v1.json", import.meta.url);
const fixture = normalizeTemplateIdentityFixture(JSON.parse(readFileSync(fixtureUrl, "utf8")));

assert.deepEqual(buildCapacityAudienceArtifactFixtureState(), fixture);

console.log("capacityAudienceArtifactFixture ✓ audience reporting artifact pack stays aligned with generated current and legacy fixtures");
