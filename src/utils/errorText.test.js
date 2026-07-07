import assert from "node:assert/strict";

import { normalizeServiceErrorText } from "./errorText.js";

const rawConnectionRefused = 'GET error: 500 Internal Server Error: code: -32603, message: failed to send request: Post "http://localhost:5002/mcp": dial tcp [::1]:5002: connect: connection refused, data: [123 34 99 97 112 97 98 105 108 105 116 105 101 115 34]';

assert.equal(
    normalizeServiceErrorText(rawConnectionRefused, { serviceLabel: "reporting service" }),
    "Could not reach the reporting service at http://localhost:5002/mcp. Make sure the local service is running, then run again.",
);

assert.equal(
    normalizeServiceErrorText({ message: rawConnectionRefused }, { serviceLabel: "chart data service" }),
    "Could not reach the chart data service at http://localhost:5002/mcp. Make sure the local service is running, then run again.",
);

assert.equal(
    normalizeServiceErrorText('GET error: 500 Internal Server Error: code: -32603, message: failed to send request: Post "http://localhost:5002/mcp": context deadline exceeded', { serviceLabel: "reporting service" }),
    "The reporting service at http://localhost:5002/mcp did not respond in time. Try again after the service is available.",
);

assert.equal(
    normalizeServiceErrorText('GET error: 500 Internal Server Error: code: -32603, message: backend exploded, data: [1 2 3]', { serviceLabel: "reporting service" }),
    "backend exploded",
);

assert.equal(
    normalizeServiceErrorText("boom", { serviceLabel: "reporting service" }),
    "boom",
);

console.log("errorText ✓ normalizes verbose transport failures into explicit user-facing messages");
