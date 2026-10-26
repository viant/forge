import {isChartNumericValue, readChartDataValue} from './chartData.js';

const appearanceKeys = ['font', 'fontSize', 'fontFamily', 'fontWeight', 'lineHeight', 'letterSpacing', 'background', 'border', 'borderRadius', 'strokeWidth', 'strokeDasharray', 'barSize'];

export function validateChartAppearance(chart = {}) {
    if (chart.appearance != null && chart.appearance !== 'document') throw new Error(`Unknown chart appearance: ${chart.appearance}`);
    if (chart.layout != null && chart.layout !== 'small-multiples') throw new Error(`Unknown chart layout: ${chart.layout}`);
    if (chart.layout && !['line', 'area'].includes(chart.type)) throw new Error('Small multiples require line or area charts.');
    if (chart.appearance !== 'document') return;
    for (const source of [chart, chart.style || {}, chart.cartesianGrid || {}, ...(chart.series?.values || []), ...Object.values(chart.seriesOptions || {})]) {
        if (appearanceKeys.some(key => Object.hasOwn(source, key) && source[key] !== '' && source[key] != null)) throw new Error('Document charts use the shared appearance and tokens instead of inline styling.');
    }
}

export function resolveDocumentChartStyle(element) {
    const css = element && typeof getComputedStyle === 'function' ? getComputedStyle(element) : null;
    const number = (name, fallback) => {
        const value = Number.parseFloat(css?.getPropertyValue(`--forge-chart-${name}`));
        return Number.isFinite(value) && value >= 0 ? value : fallback;
    };
    return {
        lineWidth: number('line-width', 2),
        pointRadius: number('point-radius', 3),
        pointStrokeWidth: number('point-stroke-width', 1),
        barSize: number('bar-size', 8),
        plotHeight: number('plot-height', 240),
        smallPlotHeight: number('small-plot-height', 160),
        columnSize: number('column-size', 32),
        axisWidth: number('axis-width', 56),
        axisTickMargin: number('axis-tick-margin', 10),
        insetTop: number('inset-top', 16),
        insetRight: number('inset-right', 16),
        insetBottom: number('inset-bottom', 16),
        axisLineHeight: number('axis-line-height', Number.parseFloat(css?.getPropertyValue('--forge-type-small-line-height')) || 18),
    };
}

// One shared extent keeps sparse and single-observation panels comparable.
export function sharedChartDomain(rows = [], series = [], authoredDomain) {
    if (Array.isArray(authoredDomain) && authoredDomain.length === 2 && authoredDomain.every(Number.isFinite)) return authoredDomain;
    let min = 0, max = 0;
    for (const row of rows) for (const entry of series) {
        const value = readChartDataValue(row, entry.value);
        if (isChartNumericValue(value)) { min = Math.min(min, Number(value)); max = Math.max(max, Number(value)); }
    }
    return min === max ? [min, max + 1] : [min, max];
}

export function comparisonBarLayout(value, domain) {
    if (!isChartNumericValue(value)) return null;
    const [min, max] = domain;
    const range = max - min || 1;
    const origin = (0 - min) / range * 100;
    const end = (Number(value) - min) / range * 100;
    return {left: Math.min(origin, end), width: Math.abs(end - origin)};
}

export function resolveReportRuntimeChartRowLimit(block = {}) {
    const spec=block?.content?.chartSpec || block.chartSpec || {};
    const explicit=Math.trunc(Number(block?.content?.rowLimit ?? block.rowLimit ?? 0));
    if(Number.isInteger(explicit) && (explicit>0 || spec.appearance==='document' && explicit===0)) return explicit;
    return ['horizontal_bar','funnel_bar'].includes(String(spec.type || '').trim().toLowerCase()) ? 10 : 0;
}
