const fieldTrackSelectTokens = [
    '--forge-font-family',
    '--forge-type-body-size',
    '--forge-type-body-line-height',
    '--forge-surface-raised',
    '--forge-surface-subtle',
    '--forge-text',
    '--forge-text-muted',
    '--forge-interaction-color',
    '--forge-selected-background',
    '--forge-control-radius',
    '--forge-focus-color',
    '--forge-overlay-shadow',
];

export function inheritFieldTrackSelectTokens(popover, trigger) {
    const portal = popover?.closest?.('.forge-field-track-select-portal');
    if (!portal || !trigger?.ownerDocument?.defaultView) return;

    const source = trigger.ownerDocument.defaultView.getComputedStyle(trigger);
    for (const token of fieldTrackSelectTokens) {
        const value = source.getPropertyValue(token).trim();
        if (value) portal.style.setProperty(token, value);
    }
    if (source.fontFamily) portal.style.fontFamily = source.fontFamily;
    if (source.fontSize) portal.style.fontSize = source.fontSize;
    if (source.lineHeight) portal.style.lineHeight = source.lineHeight;
}
