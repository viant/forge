import { buildShareableArtifactSummary } from "../../reporting/sharing/shareableArtifactModel.js";
import { buildShareableLifecycleActionViewState } from "../../reporting/lifecycle/shareableLifecycleModel.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function titleCaseWords(value = "") {
    return normalizeString(value)
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeBadgeLabels(badges = []) {
    return (Array.isArray(badges) ? badges : [])
        .map((badge) => normalizeString(badge?.label || badge?.id))
        .filter(Boolean);
}

function normalizeCapabilityLabels(labels = []) {
    return (Array.isArray(labels) ? labels : [])
        .map((label) => normalizeString(label))
        .filter(Boolean);
}

function normalizeGrantLabels(grants = []) {
    return (Array.isArray(grants) ? grants : [])
        .map((grant) => {
            const principalRef = normalizeString(grant?.principalRef);
            const role = normalizeString(grant?.role);
            if (!principalRef && !role) {
                return "";
            }
            if (principalRef && role) {
                return `${principalRef} (${role})`;
            }
            return principalRef || role;
        })
        .filter(Boolean);
}

function normalizePositiveInteger(value = 0) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
}

export function buildReportBuilderShareableArtifactViewState(value = null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const normalizedValue = buildShareableArtifactSummary(value) || value;
    const artifactRef = normalizeString(normalizedValue?.artifactRef);
    const lifecycle = normalizeString(normalizedValue?.lifecycle);
    const ownerRef = normalizeString(normalizedValue?.ownerRef);
    const policyRef = normalizeString(normalizedValue?.policyRef);
    const shareableVersion = normalizePositiveInteger(normalizedValue?.shareableVersion);
    const badgeLabels = normalizeBadgeLabels(normalizedValue?.shareableBadges);
    const capabilityLabels = normalizeCapabilityLabels(normalizedValue?.shareableCapabilityChips);
    const grantLabels = normalizeGrantLabels(normalizedValue?.shareableGrants);
    const shareableNotice = normalizedValue?.shareableNotice && typeof normalizedValue.shareableNotice === "object" && !Array.isArray(normalizedValue.shareableNotice)
        ? {
            level: normalizeString(normalizedValue.shareableNotice.level) || "info",
            message: normalizeString(normalizedValue.shareableNotice.message),
        }
        : null;
    const diagnostics = (Array.isArray(normalizedValue?.shareableDiagnostics) ? normalizedValue.shareableDiagnostics : [])
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry) => ({
            code: normalizeString(entry.code),
            severity: normalizeString(entry.severity) || "warning",
            message: normalizeString(entry.message),
        }))
        .filter((entry) => entry.message);
    const metaChips = (Array.isArray(normalizedValue?.shareableMetaChips) ? normalizedValue.shareableMetaChips : [])
        .map((chip) => normalizeString(chip))
        .filter(Boolean);
    if (!artifactRef && !lifecycle && !ownerRef && !policyRef && badgeLabels.length === 0 && capabilityLabels.length === 0 && grantLabels.length === 0 && metaChips.length === 0 && !shareableNotice && diagnostics.length === 0) {
        return null;
    }
    const summaryText = [
        lifecycle ? titleCaseWords(lifecycle) : "",
        ownerRef ? `Owner ${ownerRef}` : "",
        policyRef,
    ].filter(Boolean).join(" • ");
    const rows = [
        artifactRef ? { id: "artifactRef", label: "Artifact", value: artifactRef } : null,
        shareableVersion > 0 ? { id: "version", label: "Version", value: `v${shareableVersion}` } : null,
        badgeLabels.length > 0 ? { id: "badges", label: "Badges", value: badgeLabels.join(", ") } : null,
        capabilityLabels.length > 0 ? { id: "capabilities", label: "Capabilities", value: capabilityLabels.join(", ") } : null,
        grantLabels.length > 0 ? { id: "grants", label: "Grants", value: grantLabels.join(" • ") } : null,
    ].filter(Boolean);
    const actionViewState = buildShareableLifecycleActionViewState(normalizedValue);
    if (Array.isArray(actionViewState?.availableActions) && actionViewState.availableActions.length > 0) {
        rows.push({
            id: "availableActions",
            label: "Available actions",
            value: actionViewState.availableActions.join(", "),
        });
    }
    if (Array.isArray(actionViewState?.blockedActions) && actionViewState.blockedActions.length > 0) {
        rows.push({
            id: "blockedActions",
            label: "Blocked actions",
            value: actionViewState.blockedActions.join(", "),
        });
    }
    return {
        shareableTitle: "Governance & Sharing",
        ...(summaryText ? { shareableText: summaryText } : {}),
        ...(metaChips.length > 0 ? { shareableMetaChips: metaChips } : {}),
        ...(rows.length > 0 ? { shareableRows: rows } : {}),
        ...(diagnostics.length > 0 ? { shareableDiagnostics: diagnostics } : {}),
        ...(shareableNotice ? { shareableNotice } : {}),
    };
}
