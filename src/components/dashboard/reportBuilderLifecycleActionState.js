import {
    buildShareableLifecycleActionViewState,
    buildShareableLifecycleTransition,
} from "../../reporting/lifecycle/shareableLifecycleModel.js";

function normalizeString(value = "") {
    return String(value || "").trim();
}

function normalizePositiveInteger(value = 0) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0;
}

function isPlainObject(value = null) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

export function resolveReportBuilderLifecycleHandler(value = null) {
    const handler = isPlainObject(value) ? value : null;
    const transitionArtifact = typeof handler?.transitionArtifact === "function"
        ? handler.transitionArtifact
        : null;
    const shareArtifact = typeof handler?.shareArtifact === "function"
        ? handler.shareArtifact
        : null;
    const runAction = typeof handler?.runAction === "function"
        ? handler.runAction
        : null;
    if (!transitionArtifact && !shareArtifact && !runAction) {
        return null;
    }
    return {
        ...(transitionArtifact ? { transitionArtifact } : {}),
        ...(shareArtifact ? { shareArtifact } : {}),
        ...(runAction ? { runAction } : {}),
    };
}

export function buildReportBuilderLifecycleActionRequest(actionId = "", summary = null, {
    reason = "",
    metadata = {},
} = {}) {
    if (!isPlainObject(summary)) {
        return null;
    }
    const action = normalizeString(actionId).toLowerCase();
    const artifactRef = normalizeString(summary?.artifactRef);
    const lifecycle = normalizeString(summary?.lifecycle).toLowerCase();
    const version = normalizePositiveInteger(summary?.shareableVersion || summary?.documentVersion || summary?.version);
    const normalizedReason = normalizeString(reason);
    const normalizedMetadata = isPlainObject(metadata) ? metadata : {};
    if (!action || !artifactRef) {
        return null;
    }
    if (action === "share") {
        return {
            action,
            artifactRef,
            ...(version > 0 ? { version } : {}),
            ...(lifecycle ? { lifecycle } : {}),
            ...(Object.keys(normalizedMetadata).length > 0 ? { metadata: normalizedMetadata } : {}),
        };
    }
    if (action === "publish" || action === "archive") {
        const transition = buildShareableLifecycleTransition({
            artifactRef,
            from: lifecycle,
            to: action === "publish" ? "published" : "archived",
            ...(normalizedReason ? { reason: normalizedReason } : {}),
        });
        if (!transition) {
            return null;
        }
        return {
            action,
            artifactRef,
            ...(version > 0 ? { version } : {}),
            ...(lifecycle ? { lifecycle } : {}),
            transition,
            ...(Object.keys(normalizedMetadata).length > 0 ? { metadata: normalizedMetadata } : {}),
        };
    }
    return null;
}

export function buildReportBuilderLifecycleActionState(summary = null, {
    handler = null,
    busyActionId = "",
} = {}) {
    if (!isPlainObject(summary)) {
        return null;
    }
    const actionState = buildShareableLifecycleActionViewState(summary);
    if (!actionState) {
        return null;
    }
    const resolvedHandler = resolveReportBuilderLifecycleHandler(handler);
    const busyId = normalizeString(busyActionId).toLowerCase();
    const availableActions = Array.isArray(actionState?.availableActions) ? actionState.availableActions : [];
    const blockedActions = new Set(
        (Array.isArray(actionState?.blockedActions) ? actionState.blockedActions : [])
            .map((entry) => normalizeString(entry)),
    );
    const actions = [];

    const addAction = ({
        id = "",
        label = "",
        available = false,
        disabledReason = "",
    } = {}) => {
        const normalizedId = normalizeString(id).toLowerCase();
        const normalizedLabel = normalizeString(label);
        if (!normalizedId || !normalizedLabel) {
            return;
        }
        const busy = normalizedId === busyId;
        actions.push({
            id: normalizedId,
            label: busy ? `${normalizedLabel}...` : normalizedLabel,
            disabled: !available || busy,
            disabledReason: normalizeString(disabledReason),
            busy,
        });
    };

    if (availableActions.includes("Share") || blockedActions.has("Share")) {
        const canShare = availableActions.includes("Share");
        const available = canShare && (!!resolvedHandler?.shareArtifact || !!resolvedHandler?.runAction);
        addAction({
            id: "share",
            label: "Share",
            available,
            disabledReason: available
                ? ""
                : (canShare
                ? "No share provider is connected for this workspace."
                : "Share capability is not granted for this artifact."),
        });
    }

    if (availableActions.includes("Publish") || blockedActions.has("Publish")) {
        const canPublish = availableActions.includes("Publish");
        const available = canPublish && (!!resolvedHandler?.transitionArtifact || !!resolvedHandler?.runAction);
        addAction({
            id: "publish",
            label: "Publish",
            available,
            disabledReason: available
                ? ""
                : (canPublish
                ? "No lifecycle provider is connected for this workspace."
                : "Publish capability is not granted for this artifact."),
        });
    }

    if (availableActions.includes("Archive") || blockedActions.has("Archive")) {
        const canArchive = availableActions.includes("Archive");
        const available = canArchive && (!!resolvedHandler?.transitionArtifact || !!resolvedHandler?.runAction);
        addAction({
            id: "archive",
            label: "Archive",
            available,
            disabledReason: available
                ? ""
                : (canArchive
                ? "No lifecycle provider is connected for this workspace."
                : "Archive capability is not granted for this artifact."),
        });
    }

    return actions.length > 0 ? { actions } : null;
}
