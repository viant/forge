import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);

assert.equal(
  source.includes("const runtimePreviewRecoveryToken = useMemo("),
  true,
  "ReportBuilder should derive an explicit runtime preview recovery token.",
);

assert.equal(
  source.includes("semanticModelRetrySequence"),
  true,
  "Runtime preview recovery token should include semantic model reload retries.",
);

assert.equal(
  source.includes("semanticValidationRetrySequence"),
  true,
  "Runtime preview recovery token should include semantic validation retries.",
);

assert.equal(
  source.includes("buildReportRuntimePreviewRequestKey(runtimePreviewFingerprint, manualRunSequence, runtimePreviewRecoveryToken)"),
  true,
  "Runtime preview request keys should include the recovery token so semantic retries trigger reruns.",
);

console.log("reportBuilderRuntimePreviewRecoveryCoverage ✓ runtime preview request keys include semantic recovery state");
