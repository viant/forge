import assert from "node:assert/strict";

import {
  hasRuntimeFilterBinding,
  listRuntimeFilterBindings,
  matchesRuntimeFilterBindingSelection,
  matchesRuntimeFilterBindingValue,
  normalizeRuntimeFilterBinding,
  normalizeRuntimeFilterPath,
  resolveRuntimeFilterBinding,
} from "./runtimeFilterBindingModel.js";

const config = {
  dimensions: [
    {
      id: "country",
      key: "country",
      runtimeFilter: {
        includeParamPath: "filters.includeCountry",
        excludeParamPath: "filters.excludeCountry",
      },
    },
    {
      id: "region",
      key: "region",
      runtimeFilter: {
        includeParamPath: "filters.includeLocationDim",
        excludeParamPath: "filters.excludeLocationDim",
        format: "locationTuple",
        parentField: "country",
      },
    },
  ],
};

assert.equal(normalizeRuntimeFilterPath("filters.includeCountry"), "includeCountry");
assert.equal(normalizeRuntimeFilterPath("includeCountry"), "includeCountry");

assert.deepEqual(normalizeRuntimeFilterBinding(config.dimensions[0]), {
  fieldKey: "country",
  includePath: "includeCountry",
  excludePath: "excludeCountry",
  format: "",
  parentField: "",
});

assert.deepEqual(resolveRuntimeFilterBinding(config, "region"), {
  fieldKey: "region",
  includePath: "includeLocationDim",
  excludePath: "excludeLocationDim",
  format: "locationtuple",
  parentField: "country",
});

assert.equal(hasRuntimeFilterBinding(config, "country"), true);
assert.equal(hasRuntimeFilterBinding(config, "missing"), false);
assert.equal(listRuntimeFilterBindings(config).length, 2);

assert.equal(matchesRuntimeFilterBindingValue(
  { country: "US", region: "CA" },
  resolveRuntimeFilterBinding(config, "region"),
  "US/CA",
), true);

assert.equal(matchesRuntimeFilterBindingSelection(
  { country: "US", region: "CA" },
  resolveRuntimeFilterBinding(config, "region"),
  ["US/TX", "US/CA"],
), true);

console.log("runtimeFilterBindingModel ✓ normalizes and matches explicit runtime filter bindings");
