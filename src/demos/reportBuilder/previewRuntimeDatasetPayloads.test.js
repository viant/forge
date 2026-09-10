import assert from "node:assert/strict";

import {
  mergePreviewRuntimeDatasetPayloads,
  normalizePreviewRuntimeDatasetPayloads,
  resolvePreviewRuntimeDatasetInputs,
} from "./previewRuntimeDatasetPayloads.js";

const source = {
  primary: { rows: [{ id: "primary-seed" }], hasMore: true },
  detail: { rows: [{ id: "detail-seed" }], hasMore: false },
  totals: { rows: [], error: new Error("Totals unavailable") },
};
const normalized = normalizePreviewRuntimeDatasetPayloads(source);
source.primary.rows[0].id = "mutated-after-replace";
assert.deepEqual(normalized.primary.rows, [{ id: "primary-seed" }]);
assert.equal(normalized.primary.hasMore, true);
assert.deepEqual(normalized.detail.rows, [{ id: "detail-seed" }]);
assert.deepEqual(normalized.totals.rows, []);
assert.equal(normalized.totals.diagnostics[0].code, "runtimePreviewDatasetSeedError");
assert.match(normalized.totals.diagnostics[0].message, /Totals unavailable/);

const merged = mergePreviewRuntimeDatasetPayloads({
  detail: { rows: [{ id: "fetched-detail" }] },
  untouched: { rows: [{ id: "fetched-only" }] },
}, normalized);
assert.deepEqual(merged.detail.rows, [{ id: "detail-seed" }]);
assert.deepEqual(merged.untouched.rows, [{ id: "fetched-only" }]);

const collectionBacked = resolvePreviewRuntimeDatasetInputs({
  rows: [{ id: "collection-primary" }],
  hasMore: false,
  fetchedPayloads: { detail: { rows: [{ id: "fetched-detail" }] } },
});
assert.deepEqual(collectionBacked.rows, [{ id: "collection-primary" }]);
assert.equal(collectionBacked.hasMore, false);
assert.deepEqual(collectionBacked.datasetPayloads.detail.rows, [{ id: "fetched-detail" }]);

const seededPrimary = resolvePreviewRuntimeDatasetInputs({
  rows: [{ id: "collection-primary" }],
  seededPayloads: normalized,
});
assert.deepEqual(seededPrimary.rows, [{ id: "primary-seed" }]);
assert.equal(seededPrimary.hasMore, true);
assert.equal(seededPrimary.datasetPayloads.primary, undefined);
assert.deepEqual(seededPrimary.datasetPayloads.detail.rows, [{ id: "detail-seed" }]);
assert.match(seededPrimary.datasetPayloads.totals.diagnostics[0].message, /Totals unavailable/);

const emptyReplacement = resolvePreviewRuntimeDatasetInputs({
  rows: [{ id: "collection-primary" }],
  seededPayloads: { primary: { rows: [] }, detail: { rows: [] } },
});
assert.deepEqual(emptyReplacement.rows, []);
assert.deepEqual(emptyReplacement.datasetPayloads.detail.rows, []);

const isolatedRead = normalizePreviewRuntimeDatasetPayloads(normalized);
isolatedRead.detail.rows[0].id = "consumer-mutation";
assert.equal(normalized.detail.rows[0].id, "detail-seed");
assert.deepEqual(normalizePreviewRuntimeDatasetPayloads(null), {});
assert.deepEqual(normalizePreviewRuntimeDatasetPayloads({ " ": { rows: [1] }, broken: null }), {});

console.log("previewRuntimeDatasetPayloads ✓ normalizes, replaces, isolates, and resolves primary plus named runtime datasets");
