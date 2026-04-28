import {resolveKey} from "../../utils/selector.js";

export const US_STATE_TILES = [
    {key: 'AK', label: 'Alaska', col: 1, row: 1},
    {key: 'ME', label: 'Maine', col: 12, row: 1},
    {key: 'VT', label: 'Vermont', col: 10, row: 2},
    {key: 'NH', label: 'New Hampshire', col: 11, row: 2},
    {key: 'MA', label: 'Massachusetts', col: 12, row: 2},
    {key: 'WA', label: 'Washington', col: 1, row: 3},
    {key: 'ID', label: 'Idaho', col: 2, row: 3},
    {key: 'MT', label: 'Montana', col: 3, row: 3},
    {key: 'ND', label: 'North Dakota', col: 4, row: 3},
    {key: 'MN', label: 'Minnesota', col: 5, row: 3},
    {key: 'IL', label: 'Illinois', col: 6, row: 3},
    {key: 'WI', label: 'Wisconsin', col: 7, row: 3},
    {key: 'MI', label: 'Michigan', col: 8, row: 3},
    {key: 'NY', label: 'New York', col: 10, row: 3},
    {key: 'RI', label: 'Rhode Island', col: 11, row: 3},
    {key: 'CT', label: 'Connecticut', col: 12, row: 3},
    {key: 'OR', label: 'Oregon', col: 1, row: 4},
    {key: 'NV', label: 'Nevada', col: 2, row: 4},
    {key: 'WY', label: 'Wyoming', col: 3, row: 4},
    {key: 'SD', label: 'South Dakota', col: 4, row: 4},
    {key: 'IA', label: 'Iowa', col: 5, row: 4},
    {key: 'IN', label: 'Indiana', col: 6, row: 4},
    {key: 'OH', label: 'Ohio', col: 7, row: 4},
    {key: 'PA', label: 'Pennsylvania', col: 8, row: 4},
    {key: 'NJ', label: 'New Jersey', col: 10, row: 4},
    {key: 'CA', label: 'California', col: 1, row: 5},
    {key: 'UT', label: 'Utah', col: 2, row: 5},
    {key: 'CO', label: 'Colorado', col: 3, row: 5},
    {key: 'NE', label: 'Nebraska', col: 4, row: 5},
    {key: 'MO', label: 'Missouri', col: 5, row: 5},
    {key: 'KY', label: 'Kentucky', col: 6, row: 5},
    {key: 'WV', label: 'West Virginia', col: 7, row: 5},
    {key: 'VA', label: 'Virginia', col: 8, row: 5},
    {key: 'MD', label: 'Maryland', col: 9, row: 5},
    {key: 'DE', label: 'Delaware', col: 10, row: 5},
    {key: 'AZ', label: 'Arizona', col: 2, row: 6},
    {key: 'NM', label: 'New Mexico', col: 3, row: 6},
    {key: 'KS', label: 'Kansas', col: 4, row: 6},
    {key: 'AR', label: 'Arkansas', col: 5, row: 6},
    {key: 'TN', label: 'Tennessee', col: 6, row: 6},
    {key: 'NC', label: 'North Carolina', col: 7, row: 6},
    {key: 'SC', label: 'South Carolina', col: 8, row: 6},
    {key: 'DC', label: 'District of Columbia', col: 9, row: 6},
    {key: 'HI', label: 'Hawaii', col: 1, row: 7},
    {key: 'OK', label: 'Oklahoma', col: 4, row: 7},
    {key: 'LA', label: 'Louisiana', col: 5, row: 7},
    {key: 'MS', label: 'Mississippi', col: 6, row: 7},
    {key: 'AL', label: 'Alabama', col: 7, row: 7},
    {key: 'GA', label: 'Georgia', col: 8, row: 7},
    {key: 'TX', label: 'Texas', col: 4, row: 8},
    {key: 'FL', label: 'Florida', col: 9, row: 8},
];

export const DEFAULT_GEO_PALETTE = ['#d9f0ea', '#9fd8ce', '#55b9aa', '#187f78', '#0c4d52'];

export function normalizeGeoKey(value) {
    return String(value ?? '').trim().toUpperCase();
}

export function pickPaletteColor(value, minValue, maxValue, palette = DEFAULT_GEO_PALETTE) {
    const colors = Array.isArray(palette) && palette.length > 0 ? palette : DEFAULT_GEO_PALETTE;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '#eef3f8';
    }
    if (maxValue <= minValue) {
        return colors[colors.length - 1];
    }
    const ratio = Math.max(0, Math.min(1, (numeric - minValue) / (maxValue - minValue)));
    const index = Math.min(colors.length - 1, Math.floor(ratio * colors.length));
    return colors[index];
}

export function findGeoColorRule(row, colorConfig = {}) {
    const rules = Array.isArray(colorConfig.rules) ? colorConfig.rules : [];
    const colorField = colorConfig.field;
    if (colorField && rules.length > 0) {
        const fieldValue = resolveKey(row || {}, colorField);
        return rules.find((rule) => {
            const expected = rule?.value ?? rule?.equals ?? rule?.when;
            return expected !== undefined && String(fieldValue) === String(expected);
        });
    }
    return null;
}

export function resolveGeoColor({row, value, minValue, maxValue, colorConfig = {}}) {
    const match = findGeoColorRule(row, colorConfig);
    if (match?.color) {
        return match.color;
    }
    return pickPaletteColor(value, minValue, maxValue, colorConfig.palette || DEFAULT_GEO_PALETTE);
}

export function buildGeoConfig(container = {}, titleize = (value) => value) {
    const groupedGeo = container.dashboard?.geo;
    const geo = groupedGeo || container.geo || {};
    const metric = geo.metric || container.metric || {};
    const metricKey = metric.key || geo.valueKey || geo.metricKey || 'value';
    const key = geo.key || geo.codeKey || geo.regionKey || 'stateCode';
    return {
        shape: geo.shape || 'us-states',
        key,
        labelKey: geo.labelKey || geo.label || geo.nameKey,
        dimension: geo.dimension || key,
        metricKey,
        metricLabel: metric.label || geo.valueLabel || titleize(metricKey),
        format: metric.format || geo.format,
        aggregate: geo.aggregate || 'sum',
        color: {
            ...(geo.color || {}),
            palette: geo.color?.palette || geo.palette || DEFAULT_GEO_PALETTE,
            empty: geo.color?.empty || geo.emptyColor || '#eef3f8',
        },
        legend: geo.legend !== false,
    };
}

export function aggregateGeoRows(collection = [], config) {
    const byKey = new Map();
    for (const row of collection || []) {
        const key = normalizeGeoKey(resolveKey(row, config.key));
        if (!key) {
            continue;
        }
        const rawValue = resolveKey(row, config.metricKey);
        const value = Number(rawValue);
        const current = byKey.get(key) || {
            key,
            row,
            rows: [],
            count: 0,
            valueCount: 0,
            value: 0,
        };
        current.rows.push(row);
        current.count += 1;

        if (Number.isFinite(value)) {
            if (config.aggregate === 'max') {
                current.value = current.valueCount === 0 ? value : Math.max(current.value, value);
            } else if (config.aggregate === 'min') {
                current.value = current.valueCount === 0 ? value : Math.min(current.value, value);
            } else if (config.aggregate === 'avg') {
                current.value += value;
            } else if (config.aggregate === 'first') {
                current.value = current.valueCount === 0 ? value : current.value;
            } else {
                current.value += value;
            }
            current.valueCount += 1;
        }

        byKey.set(key, current);
    }

    if (config.aggregate === 'avg') {
        for (const entry of byKey.values()) {
            entry.value = entry.valueCount > 0 ? entry.value / entry.valueCount : 0;
        }
    }

    return byKey;
}
