import assert from "node:assert/strict";

import { buildReportRuntimePreviewRequestKey } from "./useReportRuntimePreviewRows.js";

assert.equal(buildReportRuntimePreviewRequestKey("", 0), "");
assert.equal(buildReportRuntimePreviewRequestKey("runtime::1", 0), "runtime::1::0");
assert.equal(buildReportRuntimePreviewRequestKey("runtime::1", 3), "runtime::1::3");
assert.equal(buildReportRuntimePreviewRequestKey(" runtime::2 ", "7"), "runtime::2::7");
assert.equal(buildReportRuntimePreviewRequestKey("runtime::3", "not-a-number"), "runtime::3::0");

console.log("useReportRuntimePreviewRows ✓ builds deterministic runtime preview request keys");
