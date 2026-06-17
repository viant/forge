import assert from "node:assert/strict";

import { normalizeReportRuntimeHostIntent } from "./reportRuntimeHostIntent.js";

assert.deepEqual(normalizeReportRuntimeHostIntent({
  intentKind: "detailTarget",
  title: "Resolved detail target",
  description: "Ready for host routing.",
  targetRef: "target://steward/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "Display",
    campaign: "Prospect Sprint",
  },
}), {
  intentKind: "detailTarget",
  title: "Resolved detail target",
  description: "Ready for host routing.",
  targetRef: "target://steward/performance/channel-detail",
  navigationMode: "hostRoute",
  parameters: {
    channel: "Display",
    campaign: "Prospect Sprint",
  },
});

assert.equal(normalizeReportRuntimeHostIntent({
  intentKind: "unknown",
  targetRef: "target://steward/performance/channel-detail",
  navigationMode: "hostRoute",
}), null);

console.log("reportRuntimeHostIntent ✓ normalizes explicit runtime host intent contracts");
