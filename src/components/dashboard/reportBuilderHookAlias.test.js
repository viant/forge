import assert from "node:assert/strict";

import { applyReportBuilderFilterAliases } from "./reportBuilderUtils.js";

const request = applyReportBuilderFilterAliases({
    filters: {
        targetingIncl: "iris:1001;viant.taxonomy:31312",
        targetingExcl: "peer39.context:44",
        publisherIds: [48, 45],
        advertiserId: 1162,
        From: "2026-05-21",
        To: "2026-05-27",
    },
});

assert.deepEqual(request.filters.targeting_incl, "iris:1001;viant.taxonomy:31312");
assert.deepEqual(request.filters.targeting_excl, "peer39.context:44");
assert.deepEqual(request.filters.publisher_id, [48, 45]);
assert.equal(request.filters.advertiser_id, 1162);
assert.equal(request.filters.from, "2026-05-21");
assert.equal(request.filters.to, "2026-05-27");

console.log("reportBuilderHookAlias ✓ hook-owned filters gain canonical aliases");
