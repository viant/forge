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
