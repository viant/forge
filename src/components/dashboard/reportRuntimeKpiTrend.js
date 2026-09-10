const POSITIVE_TREND_COLOR = "#18794e";
const NEGATIVE_TREND_COLOR = "#c23030";
const ZERO_TREND_COLOR = "#2563eb";
const NON_TREND_COLOR = "#30404d";

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
