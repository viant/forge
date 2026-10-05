const SECTION_APPEARANCES = new Set(['primary', 'quiet']);
const SECTION_CONTENT_INSETS = new Set(['flush']);

export function resolveSectionAppearance(section = {}) {
    const candidate = String(section?.appearance || '').trim().toLowerCase();
    return SECTION_APPEARANCES.has(candidate) ? candidate : '';
}

export function sectionAppearanceAttributes(section = {}) {
    const appearance = resolveSectionAppearance(section);
    return appearance ? {'data-forge-section-appearance': appearance} : {};
}

export function resolveSectionContentInset(section = {}) {
    const candidate = String(section?.contentInset || '').trim().toLowerCase();
    return SECTION_CONTENT_INSETS.has(candidate) ? candidate : '';
}

export function sectionContentInsetAttributes(section = {}) {
    const contentInset = resolveSectionContentInset(section);
    return contentInset ? {'data-forge-section-content-inset': contentInset} : {};
}

export function resolveSectionProperties(section = {}) {
    const properties = {...(section?.properties || {})};
    properties.collapsible = section?.collapsible === true || properties.collapsible === true;
    return properties;
}

export function resolveSectionOpenState(section = {}, viewState = {}) {
    const properties = resolveSectionProperties(section);
    const fallback = properties?.collapseProps?.defaultIsOpen !== false;
    if (section?.persistState !== true) return fallback;
    const stateKey = String(section?.stateKey || '').trim();
    if (!stateKey) return fallback;
    const stored = viewState?.sections?.[stateKey]?.isOpen;
    return typeof stored === 'boolean' ? stored : fallback;
}

export function mergeSectionOpenState(viewState = {}, stateKey, isOpen) {
    const key = String(stateKey || '').trim();
    if (!key) return viewState || {};
    return {
        ...(viewState || {}),
        sections: {
            ...(viewState?.sections || {}),
            [key]: {
                ...(viewState?.sections?.[key] || {}),
                isOpen: isOpen === true,
            },
        },
    };
}
