import assert from "node:assert/strict";

import {
  applyPreviewExportBehavior,
  attachPreviewExportBehaviorApi,
  normalizePreviewExportBehavior,
  replacePreviewExportBehaviors,
} from "./previewExportBehaviors.js";

assert.deepEqual(normalizePreviewExportBehavior({
  match: {
    phase: " status ",
    source: " savedPayload ",
    format: " PDF ",
    artifactRef: " report://demo ",
    title: " Capacity Q3 ",
    jobId: " job-1 ",
    artifactId: " artifact-1 ",
  },
  error: " export failed ",
}), {
  match: {
    phase: "status",
    source: "savedPayload",
    format: "pdf",
    artifactRef: "report://demo",
    title: "Capacity Q3",
    jobId: "job-1",
    artifactId: "artifact-1",
  },
  error: "export failed",
});

const metrics = attachPreviewExportBehaviorApi({});
assert.equal(replacePreviewExportBehaviors(metrics, [
  {
    match: {
      phase: "status",
      jobId: "job-1",
    },
    result: {
      jobId: "job-1",
      status: "failed",
      error: "Renderer rejected reportPrint.",
    },
  },
]), 1);

assert.deepEqual(
  await applyPreviewExportBehavior(metrics, {
    phase: "status",
    jobId: "job-1",
  }),
  {
    jobId: "job-1",
    status: "failed",
    error: "Renderer rejected reportPrint.",
  },
);
assert.deepEqual(metrics.exportBehaviors, []);

replacePreviewExportBehaviors(metrics, [
  {
    match: {
      phase: "artifact",
      artifactId: "artifact-1",
    },
    error: "Artifact lookup failed.",
  },
]);

await assert.rejects(
  () => applyPreviewExportBehavior(metrics, {
    phase: "artifact",
    artifactId: "artifact-1",
  }),
  /Artifact lookup failed/,
);
assert.deepEqual(metrics.exportBehaviors, []);

replacePreviewExportBehaviors(metrics, [
  {
    match: {
      phase: "submit",
      source: "savedPayload",
      format: "pdf",
      artifactRef: "reportBuilder.savedReportPayload://rbreport_market_brief",
      title: "Market Brief",
    },
    error: "Preview export submit was rejected for Market Brief.",
    result: {
      jobId: "demo-export-job-submit-failed",
      status: "failed",
      artifactRef: "reportBuilder.savedReportPayload://rbreport_market_brief",
      format: "pdf",
      scope: "savedPayload",
      error: "Preview export submit was rejected for Market Brief.",
    },
  },
]);

await assert.rejects(
  async () => {
    try {
      await applyPreviewExportBehavior(metrics, {
        phase: "submit",
        source: "savedPayload",
        format: "pdf",
        artifactRef: "reportBuilder.savedReportPayload://rbreport_market_brief",
        title: "Market Brief",
      });
    } catch (error) {
      assert.deepEqual(error?.toolResult, {
        jobId: "demo-export-job-submit-failed",
        status: "failed",
        artifactRef: "reportBuilder.savedReportPayload://rbreport_market_brief",
        format: "pdf",
        scope: "savedPayload",
        error: "Preview export submit was rejected for Market Brief.",
      });
      throw error;
    }
  },
  /Preview export submit was rejected for Market Brief/,
);
assert.deepEqual(metrics.exportBehaviors, []);

console.log("previewExportBehaviors ✓ overrides preview export outcomes deterministically for targeted proof scenarios");
