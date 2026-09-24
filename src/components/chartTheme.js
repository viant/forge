const LEGACY_CHART_ROLE_BY_COLOR = new Map([
    ['#1f77b4', 1],
    ['#ff7f0e', 2],
    ['#2ca02c', 3],
    ['#d62728', 4],
    ['#9467bd', 5],
    ['#8c564b', 6],
    ['#2f6de1', 1],
    ['#7a46d8', 2],
    ['#db2f7d', 3],
    ['#f55d1f', 4],
    ['#d79619', 5],
    ['#2aa84a', 6],
    ['#137cbd', 1],
    ['#0f9960', 2],
    ['#d9822b', 3],
    ['#8f398f', 4],
    ['#c23030', 5],
    ['#5c7080', 6],
]);

function normalizedColor(value) {
    return String(value || '').trim().toLowerCase();
}

export function chartSeriesColor(role, fallback) {
    const normalizedRole = ((Number(role) || 1) - 1) % 6 + 1;
    return `var(--forge-chart-series-${normalizedRole}, ${fallback})`;
}

export function resolveThemeAwareChartColor(value, index = 0, {forceRole = false} = {}) {
    const color = String(value || '').trim();
    if (!color || color.startsWith('var(')) return color;
    const mappedRole = LEGACY_CHART_ROLE_BY_COLOR.get(normalizedColor(color));
    if (!mappedRole && !forceRole) return color;
    return chartSeriesColor(mappedRole || (index % 6) + 1, color);
}

export function resolveThemeAwareChartPalette(values = [], {forceRole = false} = {}) {
    return (Array.isArray(values) ? values : [])
        .map((value, index) => resolveThemeAwareChartColor(value, index, {forceRole}))
        .filter(Boolean);
}

function cssPixels(style, property, fallback) {
    const parsed = Number.parseFloat(style?.getPropertyValue?.(property));
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveChartTypography(element) {
    const style = element && typeof getComputedStyle === 'function' ? getComputedStyle(element) : null;
    const inheritedFamily = String(style?.fontFamily || '').trim();
    const tokenFamily = String(style?.getPropertyValue?.('--forge-font-family') || '').trim();
    return {
        family: tokenFamily || inheritedFamily || 'system-ui, sans-serif',
        captionSize: cssPixels(style, '--forge-type-caption-size', 11),
        captionLineHeight: cssPixels(style, '--forge-type-caption-line-height', 16),
        smallSize: cssPixels(style, '--forge-type-small-size', 12),
        smallLineHeight: cssPixels(style, '--forge-type-small-line-height', 18),
    };
}
