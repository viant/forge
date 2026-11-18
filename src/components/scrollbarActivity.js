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
    const area = scroller.parentElement;
    if (area?.classList.contains('forge-scroll-area')) {
        for (const track of area.querySelectorAll(':scope>.forge-scroll-area__track')) {
            const vertical = track.dataset.forgeScrollbar === 'vertical';
            const viewport = vertical ? scroller.clientHeight : scroller.clientWidth;
            const content = vertical ? scroller.scrollHeight : scroller.scrollWidth;
            const range = Math.max(0, content - viewport);
            track.hidden = range <= 0;
            if (!range) continue;
            const thumb = track.firstElementChild;
            const length = vertical ? track.clientHeight : track.clientWidth;
            const style = getComputedStyle(thumb);
            const minimum = Number.parseFloat(vertical ? style.minHeight : style.minWidth) || 0;
            const size = Math.min(length, Math.max(minimum, length * viewport / content));
            const offset = Math.max(0, Math.min(range, vertical ? scroller.scrollTop : scroller.scrollLeft)) / range * (length - size);
            thumb.style[vertical ? 'height' : 'width'] = `${size}px`;
            thumb.style.transform = `translate${vertical ? 'Y' : 'X'}(${offset}px)`;
            if (area.dataset.scrollbarDragging) {
                thumb.getAnimations().filter(animation => animation.id === 'forge-scrollbar-activity').forEach(animation => animation.cancel());
            } else {
                showScrollbar(thumb, [{opacity:1,visibility:'visible'}, {opacity:1,visibility:'visible',offset:.65}, {opacity:0,visibility:'hidden'}]);
            }
        }
        return;
    }
    const colorSource = scroller === document?.scrollingElement ? boundary : scroller;
    const visible = `${getComputedStyle(colorSource).getPropertyValue('--forge-border-color').trim()} transparent`;
    showScrollbar(scroller, [
        {scrollbarColor:visible}, {scrollbarColor:visible,offset:.65}, {scrollbarColor:'transparent transparent'},
    ]);
}
