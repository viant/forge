import assert from "node:assert/strict";

import {
  applyPreviewExportStatusResult,
  buildPreviewExportArtifactList,
  buildPreviewExportJobList,
} from "./previewExportHistory.js";

const exportJobs = new Map([
  ["job-1", {
    jobId: "job-1",
    status: "queued",
    artifactId: "artifact-1",
    artifactRef: "report://draft/a",
    format: "pdf",
    scope: "savedPayload",
    submittedAt: "2026-06-13T11:30:00Z",
    completedAt: "",
    retentionTtl: 7200000000000,
  }],
  ["job-2", {
    jobId: "job-2",
    status: "succeeded",
    artifactId: "artifact-2",
    artifactRef: "report://draft/a",
    format: "xlsx",
    scope: "savedPayload",
    submittedAt: "2026-06-13T11:00:00Z",
    completedAt: "2026-06-13T11:05:00Z",
    retentionTtl: 7200000000000,
  }],
  ["job-3", {
    jobId: "job-3",
    status: "failed",
    artifactId: "artifact-3",
    artifactRef: "report://draft/b",
    format: "csv",
    scope: "draft",
    error: "Export failed.",
  }],
]);

assert.deepEqual(buildPreviewExportJobList(exportJobs, {
  artifactRef: "report://draft/a",
}), {
  jobs: [
    {
      jobId: "job-1",
      status: "queued",
      artifactId: "",
      artifactRef: "report://draft/a",
      format: "pdf",
      scope: "savedPayload",
      error: "",
      submittedAt: "2026-06-13T11:30:00Z",
      completedAt: "",
      retentionTtl: 7200000000000,
    },
    {
      jobId: "job-2",
      status: "succeeded",
      artifactId: "artifact-2",
      artifactRef: "report://draft/a",
      format: "xlsx",
      scope: "savedPayload",
      error: "",
      submittedAt: "2026-06-13T11:00:00Z",
      completedAt: "2026-06-13T11:05:00Z",
      retentionTtl: 7200000000000,
    },
  ],
  totalCount: 2,
});

assert.deepEqual(buildPreviewExportJobList(exportJobs, {
  limit: 1,
}), {
  jobs: [
    {
      jobId: "job-1",
      status: "queued",
      artifactId: "",
      artifactRef: "report://draft/a",
      format: "pdf",
      scope: "savedPayload",
      error: "",
      submittedAt: "2026-06-13T11:30:00Z",
      completedAt: "",
      retentionTtl: 7200000000000,
    },
  ],
  totalCount: 3,
});

exportJobs.set("job-10", {
  jobId: "job-10",
  status: "queued",
  artifactId: "artifact-10",
  artifactRef: "report://draft/a",
  format: "pdf",
  scope: "savedPayload",
  submittedAt: "2026-06-13T12:30:00Z",
  completedAt: "",
  retentionTtl: 7200000000000,
});
assert.equal(buildPreviewExportJobList(exportJobs, { limit: 1 }).jobs[0].jobId, "job-10");

const exportArtifacts = new Map([
  ["artifact-1", {
    artifactId: "artifact-1",
    jobId: "job-1",
    artifactRef: "report://draft/a",
    format: "pdf",
    contentType: "application/pdf",
    createdAt: "",
    retentionTtl: 7200000000000,
  }],
  ["artifact-2", {
    artifactId: "artifact-2",
    jobId: "job-2",
    artifactRef: "report://draft/a",
    format: "xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    createdAt: "2026-06-13T11:05:00Z",
    retentionTtl: 7200000000000,
  }],
]);

assert.deepEqual(buildPreviewExportArtifactList(exportArtifacts, {
  artifactRef: "report://draft/a",
}), {
  artifacts: [
    {
      artifactId: "artifact-2",
      jobId: "job-2",
      artifactRef: "report://draft/a",
      format: "xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      createdAt: "2026-06-13T11:05:00Z",
      retentionTtl: 7200000000000,
    },
    {
      artifactId: "artifact-1",
      jobId: "job-1",
      artifactRef: "report://draft/a",
      format: "pdf",
      contentType: "application/pdf",
      createdAt: "",
      retentionTtl: 7200000000000,
    },
  ],
  totalCount: 2,
});

const updatedJob = applyPreviewExportStatusResult(
  exportJobs,
  exportArtifacts,
  "job-1",
  {
    status: "succeeded",
  },
  {
    completedAt: "2026-06-13T12:45:00Z",
  },
);
assert.deepEqual(updatedJob, {
  jobId: "job-1",
  status: "succeeded",
  artifactId: "artifact-1",
  artifactRef: "report://draft/a",
  format: "pdf",
  scope: "savedPayload",
  error: "",
  submittedAt: "2026-06-13T11:30:00Z",
  completedAt: "2026-06-13T12:45:00Z",
  retentionTtl: 7200000000000,
});
assert.deepEqual(exportArtifacts.get("artifact-1"), {
  artifactId: "artifact-1",
  jobId: "job-1",
  artifactRef: "report://draft/a",
  format: "pdf",
  contentType: "application/pdf",
  createdAt: "2026-06-13T12:45:00Z",
  retentionTtl: 7200000000000,
  bytes: undefined,
});

console.log("previewExportHistory ✓ builds deterministic preview export job and artifact history payloads");
