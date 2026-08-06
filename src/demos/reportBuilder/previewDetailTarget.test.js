import assert from "node:assert/strict";

import { resolvePreviewDetailParameterValue, resolvePreviewDetailTarget } from "./previewDetailTarget.js";

assert.deepEqual(resolvePreviewDetailParameterValue("$value", {
  runtimeValue: "Display",
}), {
  resolved: true,
  value: "Display",
});

assert.deepEqual(resolvePreviewDetailParameterValue("$row.campaign", {
  row: {
    campaign: "Prospect Sprint",
  },
}), {
  resolved: true,
  value: "Prospect Sprint",
});

assert.deepEqual(resolvePreviewDetailParameterValue("$row.scopeFilter", {
  selectionRows: [
    { scopeFilter: "national" },
    { scopeFilter: "national" },
  ],
}), {
  resolved: true,
  value: "national",
});

assert.deepEqual(resolvePreviewDetailParameterValue("$row.campaign", {
  selectionRows: [
    { campaign: "Prospect Sprint" },
    { campaign: "Family Reach" },
  ],
}), {
  resolved: false,
  field: "campaign",
  ambiguous: true,
});

assert.deepEqual(resolvePreviewDetailTarget({
  targetRef: "target://steward/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "$value",
    scope: "$row.scopeFilter",
    campaign: "$row.campaign",
  },
}, {
  runtimeValue: "Display",
  selectionRows: [
    { scopeFilter: "national", campaign: "Prospect Sprint" },
    { scopeFilter: "national", campaign: "Family Reach" },
  ],
}), {
  targetRef: "target://steward/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "Display",
    scope: "national",
  },
  unresolvedParameters: [
    {
      parameter: "campaign",
      field: "campaign",
      ambiguous: true,
    },
  ],
});

console.log("previewDetailTarget ✓ resolves detail target parameters from row and contributing chart rows");
