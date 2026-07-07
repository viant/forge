import React from "react";
import { Icon } from "@blueprintjs/core";

import {
    resolveDashboardRowActionIdentity,
    resolveDashboardRowActionKey,
    resolveDashboardRowActionPresentation,
    resolveDashboardRowActionVisibleLabel,
} from "./dashboardRowActionPresentation.js";

function normalizeString(value = "") {
    return value == null ? "" : String(value).trim();
}

export default function ReportBuilderRuntimeActionStrip({
    actions = [],
    displayMode = "compact",
    ariaLabel = "Runtime actions",
    className = "",
    onExecute = () => {},
}) {
    const normalizedDisplayMode = normalizeString(displayMode).toLowerCase() === "full"
        ? "full"
        : (normalizeString(displayMode).toLowerCase() === "icon" ? "icon" : "compact");
    const normalizedActions = Array.isArray(actions) ? actions.filter(Boolean) : [];
    if (normalizedActions.length === 0) {
        return null;
    }
    return (
        <div
            className={[
                "forge-dashboard-row-actions",
                "forge-dashboard-row-actions--leading",
                normalizedDisplayMode === "compact" ? "forge-dashboard-row-actions--compact" : "",
                className,
            ].filter(Boolean).join(" ")}
            aria-label={ariaLabel}
            role="group"
        >
            {normalizedActions.map((action, actionIndex) => {
                const label = normalizeString(action?.label || action?.id || "Action");
                const actionForPresentation = {
                    ...action,
                    kind: normalizeString(action?.kind || action?.execution?.kind || action?.actionKind),
                    label,
                };
                const presentation = resolveDashboardRowActionPresentation(actionForPresentation);
                const visibleLabel = resolveDashboardRowActionVisibleLabel(actionForPresentation, {
                    displayMode: normalizedDisplayMode,
                });
                const iconOnly = !visibleLabel;
                return (
                    <button
                        key={resolveDashboardRowActionKey(actionForPresentation, actionIndex)}
                        type="button"
                        className={[
                            "forge-dashboard-row-action",
                            normalizedDisplayMode === "compact" ? "forge-dashboard-row-action--compact" : "",
                            iconOnly ? "forge-dashboard-row-action--icon-only" : "",
                            presentation.className,
                        ].filter(Boolean).join(" ")}
                        data-testid="report-runtime-row-action"
                        data-action-id={resolveDashboardRowActionIdentity(actionForPresentation)}
                        data-action-kind={presentation.kind}
                        data-action-display={normalizedDisplayMode}
                        aria-label={label}
                        title={label}
                        disabled={action?.disabled === true}
                        onClick={() => onExecute(action)}
                    >
                        <span className="forge-dashboard-row-action__icon" aria-hidden="true">
                            <Icon icon={presentation.icon} size={12} />
                        </span>
                        {visibleLabel ? (
                            <span className="forge-dashboard-row-action__label">
                                {visibleLabel}
                            </span>
                        ) : null}
                        <span className="forge-dashboard-row-action__sr-label">
                            {label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
