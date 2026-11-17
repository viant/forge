// One native scroll-activity recipe, installed by the selected theme owner.
const scope = '[data-forge-theme="design-system-2"], [data-agently-theme="design-system-2"]';
export function revealScrollbar(event) {
    const target = event.target;
    const document = target?.ownerDocument || (target?.nodeType === 9 ? target : null);
    const scroller = target?.nodeType === 9 ? target.scrollingElement : target;
    if (!scroller) return;
    const boundary = scroller.closest?.(scope) || (scroller === document?.scrollingElement ? document.querySelector(scope) : null);
    if (!boundary || window.matchMedia('(forced-colors: active)').matches) return;
    scroller.getAnimations().filter(animation => animation.id === 'forge-scrollbar-activity').forEach(animation => animation.cancel());
    const colorSource = scroller === document?.scrollingElement ? boundary : scroller;
    const visible = `${getComputedStyle(colorSource).getPropertyValue('--forge-border-color').trim()} transparent`;
    const animation = scroller.animate([
        {scrollbarColor:visible}, {scrollbarColor:visible,offset:.65}, {scrollbarColor:'transparent transparent'},
    ], {duration:800});
    animation.id = 'forge-scrollbar-activity';
}
