import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { extractData, resolveKey } from "./dataSourceExtract.js";

const cases = JSON.parse(readFileSync(new URL("../../backend/types/testdata/data_selector_fallbacks.json", import.meta.url)));
for (const fixture of cases) {
  test(`datasource declared fallback: ${fixture.name}`, () => {
    assert.deepEqual(extractData(fixture.selectors, null, fixture.payload).records, fixture.expectedRows);
  });
}

test("definitions without alternatives retain legacy envelope behavior", () => {
  const envelope = { data: [{ other: "legacy" }] };
  for (const selectors of [{ data: "missing.path" }, { data: "missing.path", dataFallbacks: [] }]) {
    assert.deepEqual(extractData(selectors, null, envelope).records, envelope.data);
  }
  assert.equal(resolveKey({ data: [{ value: 1 }] }, "data[0].value"), undefined,
    "unrelated resolveKey semantics remain unchanged");
});

test("an own undefined primary is present and cannot select an alternate", () => {
  assert.deepEqual(extractData({ data: "primary", dataFallbacks: ["backup"] }, null,
    { primary: undefined, backup: [{ value: "must-not-win" }] }).records, []);
});
