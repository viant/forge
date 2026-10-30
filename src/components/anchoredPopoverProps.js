// Shared geometry for anchored panels, including library-owned Select popovers.
export const FLOATING_PANEL_PADDING = 12;
export const FLOATING_PANEL_GAP = 8;

export function anchoredPopoverProps({placement = 'bottom-start', popoverClassName = '', modifiers = {}, ...props} = {}) {
    const alignment = placement.split('-')[1];
    const sides = [placement.split('-')[0], 'bottom', 'top', 'right', 'left'];
    const placements = [...new Set(sides)].map(side => alignment ? `${side}-${alignment}` : side);
    return {
        shouldReturnFocusOnClose: true,
        ...props,
        placement,
        usePortal: true,
        positioningStrategy: 'fixed',
        boundary: [],
        rootBoundary: 'viewport',
        popoverClassName: `forge-anchored-popover ${popoverClassName}`.trim(),
        modifiers: {
            ...modifiers,
            offset: {enabled: true, options: {offset: [0, FLOATING_PANEL_GAP]}},
            flip: {enabled: true, options: {padding: FLOATING_PANEL_PADDING, fallbackPlacements: placements.filter(value => value !== placement)}},
            preventOverflow: {enabled: true, options: {padding: FLOATING_PANEL_PADDING, altAxis: true, tether: false}},
        },
    };
}
