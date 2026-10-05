import {resolveSectionAppearance} from './containerChrome.js';

const GRID_LAYOUT_APPEARANCES = new Set(['divided-sections']);

export function resolveGridLayoutAppearance(layout = {}) {
    const candidate = String(layout?.appearance || '').trim().toLowerCase();
    return GRID_LAYOUT_APPEARANCES.has(candidate) ? candidate : '';
}

export function gridLayoutAttributes(layout = {}) {
    const appearance = resolveGridLayoutAppearance(layout);
    return {
        'data-forge-part': 'grid',
        ...(appearance ? {'data-forge-layout-appearance': appearance} : {}),
    };
}

export function gridLayoutItemAttributes(entry = {}) {
    const sectionAppearance = resolveSectionAppearance(entry?.section);
    return {
        'data-forge-part': 'grid-item',
        ...(sectionAppearance ? {'data-forge-grid-item-section-appearance': sectionAppearance} : {}),
    };
}
