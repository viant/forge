import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {useForgeTheme} from './ThemeBoundary.jsx';
import {revealScrollbar} from './scrollbarActivity.js';
import './ScrollArea.css';

// Native overflow owns scrolling, focus, paging and reading position. These
// pointer handles only replace the space-consuming scrollbar presentation.
const ScrollArea = forwardRef(function ScrollArea({children, className = '', ...props}, ref) {
    const theme = useForgeTheme();
    const viewport = useRef(null);
    const drag = useRef(null);
    useImperativeHandle(ref, () => viewport.current);
    const endDrag = event => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        drag.current = null;
        delete viewport.current.parentElement.dataset.scrollbarDragging;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        revealScrollbar({target: viewport.current});
    };
    const startDrag = event => {
        if (event.button !== 0) return;
        event.preventDefault();
        const thumb = event.currentTarget;
        const axis = thumb.parentElement.dataset.forgeScrollbar;
        const vertical = axis === 'vertical';
        const view = viewport.current;
        drag.current = {
            pointerId: event.pointerId, vertical,
            origin: vertical ? event.clientY : event.clientX,
        };
        view.parentElement.dataset.scrollbarDragging = axis;
        thumb.setPointerCapture(event.pointerId);
        revealScrollbar({target: view});
    };
    const moveDrag = event => {
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId) return;
        const view = viewport.current, thumb = event.currentTarget, track = thumb.parentElement;
        const range = active.vertical ? view.scrollHeight - view.clientHeight : view.scrollWidth - view.clientWidth;
        const travel = (active.vertical ? track.clientHeight : track.clientWidth) - (active.vertical ? thumb.offsetHeight : thumb.offsetWidth);
        const point = active.vertical ? event.clientY : event.clientX;
        // Paging can extend the native scroll range during a drag. Advance from
        // its current position using current geometry, rather than a stale range.
        const current = active.vertical ? view.scrollTop : view.scrollLeft;
        const next = Math.max(0, Math.min(range, current + (point - active.origin) * range / Math.max(1, travel)));
        active.origin = point;
        if (active.vertical) view.scrollTop = next;
        else view.scrollLeft = next;
    };
    if (theme?.themeId !== 'design-system-2') return <div {...props} className={className} ref={viewport}>{children}</div>;
    return <div className="forge-scroll-area">
        <div {...props} className={`forge-scroll-area__viewport ${className}`} ref={viewport}>{children}</div>
        {['vertical', 'horizontal'].map(axis => <div className="forge-scroll-area__track" data-forge-scrollbar={axis} aria-hidden="true" key={axis}>
            <div className="forge-scroll-area__thumb" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}/>
        </div>)}
    </div>;
});

export default ScrollArea;
