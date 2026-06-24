import assert from "node:assert/strict";

import {
  resolveReportRuntimeDetailParameterValue,
  resolveReportRuntimeDetailTarget,
} from "./reportRuntimeDetailTarget.js";

assert.deepEqual(resolveReportRuntimeDetailParameterValue("$value", {
  runtimeValue: "Display",
}), {
  resolved: true,
  value: "Display",
});

assert.deepEqual(resolveReportRuntimeDetailParameterValue("$row.campaign", {
  row: {
    campaign: "Prospect Sprint",
  },
}), {
  resolved: true,
  value: "Prospect Sprint",
});

assert.deepEqual(resolveReportRuntimeDetailParameterValue("$row.scopeFilter", {
  selectionRows: [
    { scopeFilter: "national" },
    { scopeFilter: "national" },
  ],
}), {
  resolved: true,
  value: "national",
});

assert.deepEqual(resolveReportRuntimeDetailParameterValue("$row.campaign", {
  selectionRows: [
    { campaign: "Prospect Sprint" },
    { campaign: "Family Reach" },
  ],
}), {
  resolved: false,
  field: "campaign",
  ambiguous: true,
});

assert.deepEqual(resolveReportRuntimeDetailTarget({
  targetRef: "target://example/performance/channel-detail",
  navigationMode: "hostRoute",
  title: "Channel detail",
  description: "Open the selected channel detail view.",
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
  targetRef: "target://example/performance/channel-detail",
  navigationMode: "hostRoute",
  title: "Channel detail",
  description: "Open the selected channel detail view.",
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

console.log("reportRuntimeDetailTarget ✓ resolves detail target parameters for authored runtime flows");
