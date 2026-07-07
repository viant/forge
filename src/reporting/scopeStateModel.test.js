import assert from "node:assert/strict";

import {
    getScopeParamValue,
    hasScopeParamValues,
    listScopeParamValues,
    mergeScopeParamValues,
    resolveScopeParamId,
    scopeParamStatePath,
    scopeParamStateSlice,
    setScopeParamValue,
} from "./scopeStateModel.js";

assert.equal(resolveScopeParamId({ id: " period " }), "period");
assert.equal(resolveScopeParamId({ field: "advertiserId" }), "advertiserId");
assert.equal(resolveScopeParamId({ id: "period", field: "dateRange" }), "period");
assert.equal(resolveScopeParamId({}), "");
assert.equal(resolveScopeParamId(null), "");

// Reads resolve through the canonical scopeParams storage key.
const state = {
    selectedMeasures: ["impressions"],
    scopeParams: {
        period: { start: "2026-01-01", end: "2026-01-31" },
        channel: ["display"],
    },
};

assert.deepEqual(getScopeParamValue(state, "period"), { start: "2026-01-01", end: "2026-01-31" });
assert.deepEqual(getScopeParamValue(state, " channel "), ["display"]);
assert.equal(getScopeParamValue(state, "missing"), undefined);
assert.equal(getScopeParamValue(state, ""), undefined);
assert.equal(getScopeParamValue(null, "period"), undefined);

// Older saved state stored the values under the legacy staticFilters key;
// reads still resolve through it when the canonical key is absent.
const legacyState = {
    selectedMeasures: ["impressions"],
    staticFilters: {
        period: { start: "2026-01-01", end: "2026-01-31" },
    },
};
assert.deepEqual(getScopeParamValue(legacyState, "period"), { start: "2026-01-01", end: "2026-01-31" });
assert.equal(listScopeParamValues(legacyState), legacyState.staticFilters);
assert.equal(hasScopeParamValues(legacyState), true);

// When both keys are present, the canonical key wins.
const mixedState = {
    scopeParams: { period: "mtd" },
    staticFilters: { period: "stale" },
};
assert.equal(getScopeParamValue(mixedState, "period"), "mtd");
assert.equal(listScopeParamValues(mixedState), mixedState.scopeParams);

// listScopeParamValues is identity-stable for memo dependencies.
assert.equal(listScopeParamValues(state), state.scopeParams);
assert.equal(listScopeParamValues({}), listScopeParamValues(null));
assert.deepEqual(listScopeParamValues({}), {});

// setScopeParamValue returns a new state, keeps other slices, and writes
// under the canonical key.
const next = setScopeParamValue(state, "channel", ["display", "video"]);
assert.notEqual(next, state);
assert.deepEqual(state.scopeParams.channel, ["display"]);
assert.deepEqual(next.scopeParams, {
    period: { start: "2026-01-01", end: "2026-01-31" },
    channel: ["display", "video"],
});
assert.deepEqual(next.selectedMeasures, ["impressions"]);

const seeded = setScopeParamValue({ page: 1 }, "period", { start: "2026-02-01" });
assert.deepEqual(seeded, { page: 1, scopeParams: { period: { start: "2026-02-01" } } });

// Writing to legacy-keyed state migrates the values onto the canonical key
// and drops the legacy key, so newly written state carries only scopeParams.
const migrated = setScopeParamValue(legacyState, "channel", ["video"]);
assert.deepEqual(migrated, {
    selectedMeasures: ["impressions"],
    scopeParams: {
        period: { start: "2026-01-01", end: "2026-01-31" },
        channel: ["video"],
    },
});
assert.equal("staticFilters" in migrated, false);
assert.deepEqual(legacyState.staticFilters, { period: { start: "2026-01-01", end: "2026-01-31" } });

assert.equal(setScopeParamValue(state, "", "value"), state);
assert.equal(setScopeParamValue(state, "   ", "value"), state);

assert.deepEqual(scopeParamStateSlice({ period: "mtd" }), { scopeParams: { period: "mtd" } });
assert.deepEqual(scopeParamStateSlice(null), { scopeParams: {} });
const sliceSource = { period: "mtd" };
const slice = scopeParamStateSlice(sliceSource);
assert.notEqual(slice.scopeParams, sliceSource);

// hasScopeParamValues distinguishes a present values map from an absent or
// malformed slice.
assert.equal(hasScopeParamValues(state), true);
assert.equal(hasScopeParamValues({ scopeParams: {} }), true);
assert.equal(hasScopeParamValues({ staticFilters: {} }), true);
assert.equal(hasScopeParamValues({}), false);
assert.equal(hasScopeParamValues(null), false);
assert.equal(hasScopeParamValues({ scopeParams: ["junk"] }), false);
assert.equal(hasScopeParamValues({ staticFilters: ["junk"] }), false);
assert.deepEqual(listScopeParamValues({ scopeParams: ["junk"] }), {});
// A malformed canonical slice falls back to the legacy slice.
assert.deepEqual(listScopeParamValues({ scopeParams: ["junk"], staticFilters: { period: "mtd" } }), { period: "mtd" });

// mergeScopeParamValues layers values over the existing slice without
// mutating the input state, and always materializes the slice.
const merged = mergeScopeParamValues(state, { channel: ["video"], region: "emea" });
assert.notEqual(merged, state);
assert.deepEqual(state.scopeParams.channel, ["display"]);
assert.deepEqual(merged.scopeParams, {
    period: { start: "2026-01-01", end: "2026-01-31" },
    channel: ["video"],
    region: "emea",
});
assert.deepEqual(mergeScopeParamValues({ page: 2 }, null), { page: 2, scopeParams: {} });

// Merging over legacy-keyed state also migrates forward.
const legacyMerged = mergeScopeParamValues(legacyState, { region: "emea" });
assert.deepEqual(legacyMerged, {
    selectedMeasures: ["impressions"],
    scopeParams: {
        period: { start: "2026-01-01", end: "2026-01-31" },
        region: "emea",
    },
});

assert.equal(scopeParamStatePath(" period "), "scopeParams.period");
assert.equal(scopeParamStatePath(""), "scopeParams");

console.log("scopeStateModel ✓ canonical scopeParams state key with legacy staticFilters read fallback");
