import {FLOATING_PANEL_GAP, FLOATING_PANEL_PADDING} from '../anchoredPopoverProps.js';

export function composerMenuPlacement(anchor, height, viewport) {
    const inset = FLOATING_PANEL_GAP + FLOATING_PANEL_PADDING;
    const above = Math.max(0, anchor.top - viewport.offsetTop - inset);
    const below = Math.max(0, viewport.offsetTop + viewport.height - anchor.bottom - inset);
    const top = height <= above || (height > below && above >= below);
    return {placement: top ? 'top-start' : 'bottom-start', maxHeight: Math.max(1, top ? above : below)};
}
