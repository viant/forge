function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeLimit(limit = 0) {
  const numeric = Number(limit);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function parseTimestampMs(value = "") {
  const parsed = Date.parse(normalizeString(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildPreviewExportJobList(exportJobs = new Map(), {
  artifactRef = "",
  limit = 0,
} = {}) {
  const normalizedArtifactRef = normalizeString(artifactRef);
  const numericLimit = normalizeLimit(limit);
  const jobs = Array.from(exportJobs instanceof Map ? exportJobs.values() : [])
    .filter((entry) => !normalizedArtifactRef || normalizeString(entry?.artifactRef) === normalizedArtifactRef)
    .sort((left, right) => {
      const delta = parseTimestampMs(right?.submittedAt) - parseTimestampMs(left?.submittedAt);
      if (delta !== 0) {
        return delta;
      }
      return normalizeString(right?.jobId).localeCompare(normalizeString(left?.jobId));
    });
  const sliced = numericLimit > 0 ? jobs.slice(0, numericLimit) : jobs;
  return {
    jobs: sliced.map((entry) => ({
      jobId: normalizeString(entry?.jobId),
      status: normalizeString(entry?.status),
      artifactId: normalizeString(entry?.status) === "succeeded" ? normalizeString(entry?.artifactId) : "",
      artifactRef: normalizeString(entry?.artifactRef),
      format: normalizeString(entry?.format),
      scope: normalizeString(entry?.scope),
      error: normalizeString(entry?.error),
      submittedAt: normalizeString(entry?.submittedAt),
      completedAt: normalizeString(entry?.completedAt),
      retentionTtl: Number(entry?.retentionTtl || 0) || 0,
    })),
    totalCount: jobs.length,
  };
}

export function buildPreviewExportArtifactList(exportArtifacts = new Map(), {
  artifactRef = "",
  limit = 0,
} = {}) {
  const normalizedArtifactRef = normalizeString(artifactRef);
  const numericLimit = normalizeLimit(limit);
  const artifacts = Array.from(exportArtifacts instanceof Map ? exportArtifacts.values() : [])
    .filter((entry) => !normalizedArtifactRef || normalizeString(entry?.artifactRef) === normalizedArtifactRef)
    .sort((left, right) => {
      const delta = parseTimestampMs(right?.createdAt) - parseTimestampMs(left?.createdAt);
      if (delta !== 0) {
        return delta;
      }
      return normalizeString(right?.artifactId).localeCompare(normalizeString(left?.artifactId));
    });
  const sliced = numericLimit > 0 ? artifacts.slice(0, numericLimit) : artifacts;
  return {
    artifacts: sliced.map((entry) => ({
      artifactId: normalizeString(entry?.artifactId),
      jobId: normalizeString(entry?.jobId),
      artifactRef: normalizeString(entry?.artifactRef),
      format: normalizeString(entry?.format),
      contentType: normalizeString(entry?.contentType),
      createdAt: normalizeString(entry?.createdAt),
      retentionTtl: Number(entry?.retentionTtl || 0) || 0,
    })),
    totalCount: artifacts.length,
  };
}

export function applyPreviewExportStatusResult(exportJobs = new Map(), exportArtifacts = new Map(), jobId = "", result = {}, {
  completedAt = "",
} = {}) {
  const normalizedJobId = normalizeString(jobId);
  const currentJob = exportJobs instanceof Map ? exportJobs.get(normalizedJobId) : null;
  if (!normalizedJobId || !currentJob) {
    return null;
  }
  const normalizedStatus = normalizeString(result?.status || currentJob?.status);
  const nextCompletedAt = normalizeString(
    result?.completedAt
    || (normalizedStatus === "succeeded" || normalizedStatus === "failed" ? completedAt : "")
    || currentJob?.completedAt
  );
  const nextJob = {
    ...currentJob,
    ...result,
    jobId: normalizedJobId,
    status: normalizedStatus,
    artifactId: normalizedStatus === "succeeded"
      ? normalizeString(result?.artifactId || currentJob?.artifactId)
      : "",
    artifactRef: normalizeString(result?.artifactRef || currentJob?.artifactRef),
    format: normalizeString(result?.format || currentJob?.format),
    scope: normalizeString(result?.scope || currentJob?.scope),
    error: normalizeString(result?.error || currentJob?.error),
    submittedAt: normalizeString(result?.submittedAt || currentJob?.submittedAt),
    completedAt: nextCompletedAt,
    retentionTtl: Number(result?.retentionTtl || currentJob?.retentionTtl || 0) || 0,
  };
  exportJobs.set(normalizedJobId, nextJob);
  if (normalizedStatus === "succeeded" && nextJob.artifactId && exportArtifacts instanceof Map) {
    const currentArtifact = exportArtifacts.get(nextJob.artifactId)
      || exportArtifacts.get(normalizeString(currentJob?.artifactId))
      || {};
    exportArtifacts.set(nextJob.artifactId, {
      ...currentArtifact,
      artifactId: nextJob.artifactId,
      jobId: normalizedJobId,
      artifactRef: nextJob.artifactRef,
      format: nextJob.format,
      contentType: normalizeString(result?.contentType || currentArtifact?.contentType),
      bytes: currentArtifact?.bytes,
      createdAt: normalizeString(result?.createdAt || currentArtifact?.createdAt || nextCompletedAt),
      retentionTtl: Number(result?.retentionTtl || currentArtifact?.retentionTtl || nextJob.retentionTtl || 0) || 0,
    });
  }
  return nextJob;
}
