/* Shared responsive contract for Forge components and patterns.
 *
 * Breakpoints describe interaction/layout behavior, not brand styling, so they
 * are owned here instead of being duplicated by Agently and product pages.
 * Hosts may override the CSS roles below when a surface has a different
 * container context, but consumers should not invent competing names.
 */
export const FORGE_FORM_FACTOR_BREAKPOINTS = Object.freeze({
    phoneMaxWidth: 767,
    tabletMaxWidth: 1099,
});

export const FORGE_RESPONSIVE_VARIABLES = Object.freeze({
    touchTargetMin: '--forge-touch-target-min',
    pageGutter: '--forge-layout-page-gutter',
    pageGutterCompact: '--forge-layout-page-gutter-compact',
    sectionGap: '--forge-layout-section-gap',
    contentMax: '--forge-layout-content-max',
});

export const forgeFormFactorForWidth = (width) => {
    const value = Number(width);
    if (!Number.isFinite(value) || value <= 0 || value <= FORGE_FORM_FACTOR_BREAKPOINTS.phoneMaxWidth) return 'phone';
    if (value <= FORGE_FORM_FACTOR_BREAKPOINTS.tabletMaxWidth) return 'tablet';
    return 'desktop';
};
