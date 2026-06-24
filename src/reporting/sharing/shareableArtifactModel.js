function normalizeString(value = "") {
  return String(value || "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value = null) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizePositiveInteger(value = 0) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
}

function titleCaseWords(value = "") {
  return normalizeString(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeLifecycle(value = "") {
  const normalized = normalizeString(value).toLowerCase();
  return normalized || "";
}

function normalizeBadge(badge = null) {
  if (!isPlainObject(badge)) {
    return null;
  }
  const id = normalizeString(badge.id || badge.label);
  const label = normalizeString(badge.label || badge.id);
  if (!id || !label) {
    return null;
  }
  const tone = normalizeString(badge.tone);
  return {
    id,
    label,
    ...(tone ? { tone } : {}),
  };
}

function normalizeCapabilities(capabilities = null) {
  if (!isPlainObject(capabilities)) {
    return null;
  }
  const next = Object.entries(capabilities).reduce((acc, [key, value]) => {
    if (typeof value === "boolean") {
      acc[normalizeString(key)] = value;
    }
    return acc;
  }, {});
  return Object.keys(next).length > 0 ? next : null;
}

function normalizeGrants(grants = []) {
  const normalized = (Array.isArray(grants) ? grants : [])
    .map((grant) => {
      if (!isPlainObject(grant)) {
        return null;
      }
      const principalRef = normalizeString(grant.principalRef);
      const role = normalizeString(grant.role);
      if (!principalRef && !role) {
        return null;
      }
      return {
        ...(principalRef ? { principalRef } : {}),
        ...(role ? { role } : {}),
      };
    })
    .filter(Boolean);
  return normalized.length > 0 ? normalized : [];
}

function buildArtifactRef(kind = "", artifactId = "") {
  const normalizedKind = normalizeString(kind);
  const normalizedArtifactId = normalizeString(artifactId);
  return normalizedKind && normalizedArtifactId
    ? `${normalizedKind}://${normalizedArtifactId}`
    : "";
}

function resolveArtifactKind(value = null) {
  return normalizeString(
    value?.shareable?.artifactKind
    || value?.artifactKind
    || value?.source?.artifactKind
    || value?.source?.kind
    || value?.kind,
  );
}

function resolveArtifactId(value = null) {
  return normalizeString(
    value?.shareable?.artifactId
    || value?.payloadId
    || value?.viewId
    || value?.savedViewId
    || value?.snapshotId
    || value?.publishedSnapshotId
    || value?.id
    || value?.source?.payloadId
    || value?.source?.sourceArtifactId
    || value?.sourceArtifactId,
  );
}

function resolveArtifactRef(value = null, fallbackArtifactRef = "") {
  const explicitArtifactRef = normalizeString(
    value?.shareable?.artifactRef
    || value?.artifactRef
    || value?.source?.artifactRef
    || fallbackArtifactRef,
  );
  if (explicitArtifactRef) {
    return explicitArtifactRef;
  }
  return buildArtifactRef(resolveArtifactKind(value), resolveArtifactId(value));
}

function buildCapabilityChips(capabilities = null) {
  if (!capabilities) {
    return [];
  }
  return Object.entries(capabilities)
    .filter(([, value]) => value === true)
    .map(([key]) => `Can ${titleCaseWords(key)}`)
    .filter(Boolean);
}

function buildBadgeChips(badges = []) {
  return (Array.isArray(badges) ? badges : [])
    .map((badge) => normalizeString(badge?.label))
    .filter(Boolean);
}

function normalizeChipLabels(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeString(value))
    .filter(Boolean);
}

function summarizeDiagnostics(diagnostics = []) {
  const count = (Array.isArray(diagnostics) ? diagnostics : []).length;
  if (count <= 0) {
    return "";
  }
  return count === 1
    ? "1 governance field needs attention."
    : `${count} governance fields need attention.`;
}

function resolveShareableArtifactState(value = null) {
  const hasNestedShareable = isPlainObject(value?.shareable);
  const baseValue = isPlainObject(value) ? cloneValue(value) : null;
  const nestedShareable = hasNestedShareable ? cloneValue(value.shareable) : null;
  const candidate = baseValue
    ? {
        ...baseValue,
        ...(nestedShareable || {}),
      }
    : (nestedShareable || null);
  if (!candidate) {
    return null;
  }
  const lifecycle = normalizeLifecycle(candidate.lifecycle);
  const ownerRef = normalizeString(candidate.ownerRef);
  const policyRef = normalizeString(candidate.policyRef);
  const explicitShareableVersion = normalizePositiveInteger(
    nestedShareable?.version || candidate.shareableVersion,
  );
  const badges = (Array.isArray(candidate.badges) ? candidate.badges : (Array.isArray(candidate.shareableBadges) ? candidate.shareableBadges : []))
    .map((badge) => normalizeBadge(badge))
    .filter(Boolean);
  const capabilities = normalizeCapabilities(candidate.capabilities || candidate.shareableCapabilities);
  const grants = normalizeGrants(candidate.grants || candidate.shareableGrants);
  const hasExplicitShareableState = hasNestedShareable
    || !!lifecycle
    || !!ownerRef
    || !!policyRef
    || badges.length > 0
    || !!capabilities
    || grants.length > 0
    || explicitShareableVersion > 0;
  return {
    candidate,
    hasNestedShareable,
    hasExplicitShareableState,
    lifecycle,
    ownerRef,
    policyRef,
    explicitShareableVersion,
    badges,
    capabilities,
    grants,
  };
}

export function extractShareableArtifactState(value = null) {
  const state = resolveShareableArtifactState(value);
  if (!state?.hasExplicitShareableState) {
    return null;
  }
  return {
    ...(state.hasNestedShareable ? { shareable: cloneValue(value.shareable) } : {}),
    ...(state.lifecycle ? { lifecycle: state.lifecycle } : {}),
    ...(state.ownerRef ? { ownerRef: state.ownerRef } : {}),
    ...(state.policyRef ? { policyRef: state.policyRef } : {}),
    ...(state.explicitShareableVersion > 0 ? { shareableVersion: state.explicitShareableVersion } : {}),
    ...(state.badges.length > 0 ? { badges: state.badges } : {}),
    ...(state.capabilities ? { capabilities: state.capabilities } : {}),
    ...(state.grants.length > 0 ? { grants: state.grants } : {}),
  };
}

export function buildShareableArtifactSummary(value = null, {
  fallbackArtifactRef = "",
  fallbackVersion = 0,
} = {}) {
  const state = resolveShareableArtifactState(value);
  if (!state?.hasExplicitShareableState) {
    return null;
  }
  const version = state.explicitShareableVersion
    || normalizePositiveInteger(state.candidate.documentVersion || fallbackVersion);
  const artifactRef = resolveArtifactRef(state.candidate, fallbackArtifactRef);
  const capabilityChips = buildCapabilityChips(state.capabilities);
  const badgeChips = buildBadgeChips(state.badges);
  const normalizedCapabilityChips = capabilityChips.length > 0
    ? capabilityChips
    : normalizeChipLabels(state.candidate?.shareableCapabilityChips);
  const normalizedBadgeChips = badgeChips.length > 0
    ? badgeChips
    : normalizeChipLabels(state.candidate?.shareableBadgeChips);
  const metaChips = [
    state.lifecycle,
    version > 0 ? `v${version}` : "",
    state.ownerRef ? `Owner ${state.ownerRef}` : "",
    state.policyRef,
    ...normalizedBadgeChips,
    ...normalizedCapabilityChips,
    state.grants.length > 0 ? `${state.grants.length} ${state.grants.length === 1 ? "grant" : "grants"}` : "",
  ].filter(Boolean);
  const diagnostics = [];
  if (!state.lifecycle) {
    diagnostics.push({
      code: "shareableLifecycleMissing",
      severity: "warning",
      message: "Shareable artifact metadata should declare a lifecycle state.",
    });
  }
  const immutableLifecycle = state.lifecycle === "published" || state.lifecycle === "archived";
  if (immutableLifecycle) {
    if (!artifactRef) {
      diagnostics.push({
        code: "shareableArtifactRefMissing",
        severity: "warning",
        message: `${titleCaseWords(state.lifecycle)} artifacts should declare a stable artifact ref.`,
      });
    }
    if (version < 1) {
      diagnostics.push({
        code: "shareableVersionMissing",
        severity: "warning",
        message: `${titleCaseWords(state.lifecycle)} artifacts should expose an immutable shareable version.`,
      });
    }
    if (!state.ownerRef) {
      diagnostics.push({
        code: "shareableOwnerMissing",
        severity: "warning",
        message: `${titleCaseWords(state.lifecycle)} artifacts should declare an owner ref.`,
      });
    }
    if (!state.policyRef) {
      diagnostics.push({
        code: "shareablePolicyMissing",
        severity: "warning",
        message: `${titleCaseWords(state.lifecycle)} artifacts should declare a policy ref.`,
      });
    }
  }
  const shareableNotice = diagnostics.length > 0
    ? {
      level: "warning",
      message: state.lifecycle
        ? `${titleCaseWords(state.lifecycle)} governance metadata is incomplete. ${summarizeDiagnostics(diagnostics)}`
        : `Governance metadata is incomplete. ${summarizeDiagnostics(diagnostics)}`,
    }
    : (state.lifecycle === "published"
      ? {
        level: "info",
        message: "Published artifact is governance-complete for immutable sharing and export.",
      }
      : (state.lifecycle === "archived"
        ? {
          level: "info",
          message: "Archived artifact retains immutable governance metadata for historical access.",
        }
        : (state.lifecycle === "draft"
          ? {
            level: "info",
            message: "Draft artifact metadata is ready for local review; publishing creates the immutable shared version.",
          }
          : null)));
  return {
    ...(artifactRef ? { artifactRef } : {}),
    ...(state.lifecycle ? { lifecycle: state.lifecycle } : {}),
    ...(version > 0 ? { shareableVersion: version } : {}),
    ...(state.ownerRef ? { ownerRef: state.ownerRef } : {}),
    ...(state.policyRef ? { policyRef: state.policyRef } : {}),
    ...(state.badges.length > 0 ? { shareableBadges: state.badges } : {}),
    ...(normalizedBadgeChips.length > 0 ? { shareableBadgeChips: normalizedBadgeChips } : {}),
    ...(state.capabilities ? { shareableCapabilities: state.capabilities } : {}),
    ...(normalizedCapabilityChips.length > 0 ? { shareableCapabilityChips: normalizedCapabilityChips } : {}),
    ...(state.grants.length > 0 ? { shareableGrants: state.grants } : {}),
    ...(metaChips.length > 0 ? { shareableMetaChips: metaChips } : {}),
    ...(diagnostics.length > 0 ? { shareableDiagnostics: diagnostics } : {}),
    ...(shareableNotice ? { shareableNotice } : {}),
  };
}
