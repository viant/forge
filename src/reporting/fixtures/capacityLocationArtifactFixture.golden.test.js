import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityLocationArtifactFixtureState } from "./capacityLocationArtifactFixtureState.js";
import { normalizeTemplateIdentityFixture } from "./normalizeTemplateIdentityFixture.js";

const fixtureUrl = new URL("./capacity-location-artifact-fixture.v1.json", import.meta.url);
const fixture = normalizeTemplateIdentityFixture(JSON.parse(readFileSync(fixtureUrl, "utf8")));

assert.deepEqual(buildCapacityLocationArtifactFixtureState(), fixture);

console.log("capacityLocationArtifactFixture ✓ location reporting artifact pack stays aligned with generated current and legacy fixtures");
