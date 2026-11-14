// Reveal the native thumb during scroll activity; retain native scrolling.
export function revealScrollbar(event) {
    const scroller = event.target;
    if (!scroller.matches?.('.bp6-menu, [role="menu"], .bp6-popover-content:has(.bp6-menu)') && !scroller.closest?.('.forge-chat-container')) return;
    if (!scroller.closest('[data-forge-theme="design-system-2"], [data-agently-theme="design-system-2"]')) return;
    if (window.matchMedia('(forced-colors: active)').matches) return;
    scroller.getAnimations().filter(animation => animation.id === 'forge-scrollbar-activity').forEach(animation => animation.cancel());
    const visible = `${getComputedStyle(scroller).getPropertyValue('--forge-border-strong').trim()} transparent`;
    const animation = scroller.animate([
        {scrollbarColor:visible}, {scrollbarColor:visible,offset:.65}, {scrollbarColor:'transparent transparent'},
    ], {duration:800});
    animation.id = 'forge-scrollbar-activity';
}
