import assert from "node:assert/strict";

import { applyPreviewRequestRefinements } from "./previewRuntimeRefinements.js";

const rows = [
  { eventDate: "2026-05-01", channelV2: "Display", country: "US" },
  { eventDate: "2026-05-01", channelV2: "CTV", country: "US" },
  { eventDate: "2026-05-02", channelV2: "Display", country: "CA" },
];

assert.deepEqual(
  applyPreviewRequestRefinements(rows, {
    refinements: [
      { op: "keep", field: "channelV2", values: ["Display"] },
    ],
  }),
  [
    { eventDate: "2026-05-01", channelV2: "Display", country: "US" },
    { eventDate: "2026-05-02", channelV2: "Display", country: "CA" },
  ],
);

assert.deepEqual(
  applyPreviewRequestRefinements(rows, {
    semanticSelection: {
      refinements: [
        { op: "exclude", field: "country", values: ["US"] },
      ],
    },
  }),
  [
    { eventDate: "2026-05-02", channelV2: "Display", country: "CA" },
  ],
);

assert.deepEqual(
  applyPreviewRequestRefinements(rows, {
    refinements: [
      { op: "drill", field: "eventDate", values: ["2026-05-01"] },
      { op: "keep", field: "channelV2", values: ["CTV"] },
    ],
  }),
  [
    { eventDate: "2026-05-01", channelV2: "CTV", country: "US" },
  ],
);

console.log("previewRuntimeRefinements ✓ applies generic request refinements in the preview runtime");
