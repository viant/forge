function normalizeString(value = "") {
    return value == null ? "" : String(value).trim();
}

function titleizeActionText(value = "") {
    return String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
        .join(" ");
}

export function normalizeDashboardRowActionKind(value = "") {
    return normalizeString(value).toLowerCase();
}

export function normalizeDashboardRowActionLabel(value = "") {
    return normalizeString(value);
}

export function normalizeDashboardRowActionDisplayMode(value = "") {
    const normalized = normalizeString(value).toLowerCase();
    if (normalized === "compact" || normalized === "icon" || normalized === "icononly" || normalized === "icon-only") {
        return normalized === "compact" ? "compact" : "icon";
    }
    return "full";
}

export function resolveDashboardRowActionShortLabel(action = {}) {
    const kind = normalizeDashboardRowActionKind(action?.kind);
    const explicitLabel = normalizeDashboardRowActionLabel(
        action?.label == null
            ? (action?.id == null ? "" : action.id)
            : action.label,
    );
    if (kind === "keep") {
        return "Keep";
    }
    if (kind === "exclude") {
        return "Exclude";
    }
    if (kind === "drill") {
        const match = explicitLabel.match(/^Drill to\s+(.+)$/i);
        return titleizeActionText(match?.[1] || "") || explicitLabel || "Drill";
    }
    if (kind === "detail") {
        const match = explicitLabel.match(/^Show\s+(.+?)\s+details$/i);
        return titleizeActionText(match?.[1] || "") || explicitLabel || "Details";
    }
    return explicitLabel || "Action";
}

export function resolveDashboardRowActionVisibleLabel(action = {}, { displayMode = "full" } = {}) {
    const normalizedDisplayMode = normalizeDashboardRowActionDisplayMode(displayMode);
    const kind = normalizeDashboardRowActionKind(action?.kind);
    const explicitLabel = normalizeDashboardRowActionLabel(
        action?.label == null
            ? (action?.id == null ? "" : action.id)
            : action.label,
    );
    if (normalizedDisplayMode === "icon") {
        return "";
    }
    if (normalizedDisplayMode === "compact") {
        const shortLabel = resolveDashboardRowActionShortLabel(action);
        if (kind === "keep") {
            return explicitLabel && !/^(keep|keep only)$/i.test(explicitLabel)
                ? explicitLabel
                : shortLabel;
        }
        if (kind === "exclude") {
            return explicitLabel && !/^exclude$/i.test(explicitLabel)
                ? explicitLabel
                : shortLabel;
        }
        if (kind === "drill") {
            if (/^drill to\s+/i.test(explicitLabel)) {
                return explicitLabel;
            }
            return shortLabel && shortLabel.toLowerCase() !== "drill"
                ? `Drill to ${shortLabel}`
                : "Drill";
        }
        if (kind === "detail") {
            const detailMatch = explicitLabel.match(/^Show\s+(.+?)\s+details$/i);
            if (detailMatch?.[1]) {
                return `${titleizeActionText(detailMatch[1])} details`;
            }
            return shortLabel && shortLabel.toLowerCase() !== "details"
                ? `${shortLabel} details`
                : "Details";
        }
        return shortLabel;
    }
    return explicitLabel || resolveDashboardRowActionShortLabel(action) || "Action";
}

export function resolveDashboardRowActionPresentation(action = {}) {
    const kind = normalizeDashboardRowActionKind(action?.kind);
    if (kind === "keep") {
        return {
            kind,
            icon: "tick",
            className: "forge-dashboard-row-action--keep",
            shortLabel: resolveDashboardRowActionShortLabel(action),
        };
    }
    if (kind === "exclude") {
        return {
            kind,
            icon: "small-cross",
            className: "forge-dashboard-row-action--exclude",
            shortLabel: resolveDashboardRowActionShortLabel(action),
        };
    }
    if (kind === "drill") {
        return {
            kind,
            icon: "arrow-right",
            className: "forge-dashboard-row-action--drill",
            shortLabel: resolveDashboardRowActionShortLabel(action),
        };
    }
    if (kind === "detail") {
        return {
            kind,
            icon: "eye-open",
            className: "forge-dashboard-row-action--detail",
            shortLabel: resolveDashboardRowActionShortLabel(action),
        };
    }
    return {
        kind: kind || "action",
        icon: "more",
        className: "",
        shortLabel: resolveDashboardRowActionShortLabel(action),
    };
}

export function resolveDashboardRowActionIdentity(action = {}) {
    return normalizeDashboardRowActionLabel(action?.id)
        || normalizeDashboardRowActionLabel(action?.label)
        || normalizeDashboardRowActionKind(action?.kind)
        || "action";
}

export function resolveDashboardRowActionKey(action = {}, index = 0) {
    const normalizedIndex = Math.max(0, Number(index) || 0);
    const seed = resolveDashboardRowActionIdentity(action);
    return `${seed}:${normalizedIndex}`;
}
