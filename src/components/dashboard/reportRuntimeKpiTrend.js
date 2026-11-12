const POSITIVE_TREND_COLOR = "var(--forge-status-success-foreground, #18794e)";
const NEGATIVE_TREND_COLOR = "var(--forge-status-danger-foreground, #c23030)";
const ZERO_TREND_COLOR = "var(--forge-interaction-color, #2563eb)";
const NON_TREND_COLOR = "var(--forge-text-secondary, #30404d)";

export function resolveRuntimeKpiTrend(value, enabled = false) {
    const numeric = Number(value);
    if (enabled !== true || !Number.isFinite(numeric)) {
        return { kind: "neutral", arrow: "", color: NON_TREND_COLOR };
    }
    if (numeric > 0) {
        return { kind: "positive", arrow: "↑", color: POSITIVE_TREND_COLOR };
    }
    if (numeric < 0) {
        return { kind: "negative", arrow: "↓", color: NEGATIVE_TREND_COLOR };
    }
    return { kind: "neutral", arrow: "→", color: ZERO_TREND_COLOR };
}
