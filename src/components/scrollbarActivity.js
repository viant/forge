// One native scroll-activity recipe, installed by the selected theme owner.
const scope = '[data-forge-theme="design-system-2"], [data-agently-theme="design-system-2"]';
function showScrollbar(target, frames) {
    const active = target.getAnimations().find(animation => animation.id === 'forge-scrollbar-activity');
    if (active) {
        // Keep the visible effect attached while scrolling. Cancelling it first
        // briefly restores the hidden base style on every native scroll event.
        active.effect.setKeyframes(frames);
        active.currentTime = 0;
        active.play();
        return;
    }
    const animation = target.animate(frames, {duration: 800});
    animation.id = 'forge-scrollbar-activity';
}

export function revealScrollbar(event) {
    const target = event.target;
    const document = target?.ownerDocument || (target?.nodeType === 9 ? target : null);
    const scroller = target?.nodeType === 9 ? target.scrollingElement : target;
    if (!scroller) return;
    const boundary = scroller.closest?.(scope) || (scroller === document?.scrollingElement ? document.querySelector(scope) : null);
    if (!boundary || window.matchMedia('(forced-colors: active)').matches) return;
    const colorSource = scroller === document?.scrollingElement ? boundary : scroller;
    const visible = `${getComputedStyle(colorSource).getPropertyValue('--forge-border-color').trim()} transparent`;
    showScrollbar(scroller, [
        {scrollbarColor:visible}, {scrollbarColor:visible,offset:.65}, {scrollbarColor:'transparent transparent'},
    ]);
}
