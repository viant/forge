import assert from "node:assert/strict";

import { extractData, isDeferredCacheHitEnvelope } from "./dataSourceExtract.js";

const payload = {
    rows: [
        {
            data: [
                { eventDate: "2026-05-10", channelId: 1, totalSpend: 123.45, impressions: 1000 },
                { eventDate: "2026-05-11", channelId: 1, totalSpend: 234.56, impressions: 2000 },
            ],
            metrics: [{ status: "ok" }],
        },
    ],
};

const extracted = extractData(
    {
        data: "rows.0.data",
        metrics: "rows.0.metrics",
    },
    null,
    payload,
);

assert.deepEqual(extracted.records, [
    { eventDate: "2026-05-10", channelId: 1, totalSpend: 123.45, impressions: 1000 },
    { eventDate: "2026-05-11", channelId: 1, totalSpend: 234.56, impressions: 2000 },
]);
assert.deepEqual(extracted.stats, [{ status: "ok" }]);

const nullRowsPayload = {
    rows: null,
    cache: { hit: false },
};
const nullRowsExtracted = extractData(
    {
        data: "rows.0.data",
    },
    null,
    nullRowsPayload,
);
assert.deepEqual(nullRowsExtracted.records, []);
assert.equal(isDeferredCacheHitEnvelope(nullRowsPayload), false);

const deferredCachePayload = {
    rows: null,
    cache: { hit: true, fetchedAt: "2026-07-01T19:14:35.344023Z", ttlSeconds: 1800 },
};
assert.equal(isDeferredCacheHitEnvelope(deferredCachePayload), true);

console.log("dataSourceExtract ✓ explicit selectors override generic envelope rows");
