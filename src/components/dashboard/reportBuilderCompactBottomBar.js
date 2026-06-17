export function buildReportBuilderCompactBottomBarActions({
    bottomBar = [],
    onOpenSetup,
    onOpenChart,
    onRunPrimary,
} = {}) {
    return (Array.isArray(bottomBar) ? bottomBar : []).map((action) => {
        switch (action?.id) {
            case "setup":
                return {
                    ...action,
                    onClick: onOpenSetup,
                };
            case "chart":
                return {
                    ...action,
                    onClick: onOpenChart,
                };
            case "run":
                return {
                    ...action,
                    onClick: onRunPrimary,
                };
            default:
                return null;
        }
    }).filter(Boolean);
}
