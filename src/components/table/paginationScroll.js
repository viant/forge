export function findPaginationScrollContainer(scroller, styleReader = null) {
    const readStyle = styleReader || (
        typeof getComputedStyle === 'function' ? getComputedStyle : null
    );
    let current = scroller?.parentElement || null;
    while (current) {
        const overflowY = String(readStyle?.(current)?.overflowY || '').toLowerCase();
        if (
            current.scrollHeight > current.clientHeight + 1
            && ['auto', 'scroll', 'overlay'].includes(overflowY)
        ) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
}

export function resetPaginationScroll(scroller, preserveScrollPosition = false, styleReader = null) {
    if (!scroller || preserveScrollPosition === true) return false;
    scroller.scrollTop = 0;
    const container = findPaginationScrollContainer(scroller, styleReader);
    if (container && typeof scroller.getBoundingClientRect === 'function' && typeof container.getBoundingClientRect === 'function') {
        const tableTop = scroller.getBoundingClientRect().top;
        const containerTop = container.getBoundingClientRect().top;
        if (Number.isFinite(tableTop) && Number.isFinite(containerTop)) {
            container.scrollTop = Math.max(0, container.scrollTop + tableTop - containerTop);
        }
    }
    return true;
}
