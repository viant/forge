import React from 'react';

// Keep pointer routing with the rendered points and their existing callbacks.
// No chart data or a second set of plot coordinates is needed for hit testing.
const pointActions = new WeakMap();
function pointerActions(event) {
    const current = event.currentTarget;
    const svg = current.ownerSVGElement;
    const root = current.getRootNode();
    const hitSurface = typeof root.elementsFromPoint === 'function' ? root : current.ownerDocument;
    const hits = new Set(hitSurface.elementsFromPoint(event.clientX, event.clientY)
        .map(node => node.closest('[data-forge-chart-point]'))
        .filter(node => node?.ownerSVGElement === svg));
    let nearest;
    let distance = Infinity;
    // Equal-distance ties retain the browser's existing paint/hit order.
    for (const point of hits) {
        const box = point.querySelector('.forge-chart-point-mark').getBoundingClientRect();
        const candidateDistance = (event.clientX - box.x - box.width / 2) ** 2
            + (event.clientY - box.y - box.height / 2) ** 2;
        if (candidateDistance < distance) {
            nearest = point;
            distance = candidateDistance;
        }
    }
    const point = nearest || current;
    return {point, ...pointActions.get(point)};
}

export default function ChartPoint({cx,cy,index,firstIndex,label,color,style,onSelect,onInspect,seriesKey,category}) {
    const pointRef=React.useRef(null);
    const interactive=onSelect||onInspect;
    const choose=event=>{event.stopPropagation();onSelect?.();};
    const keyDown=event=>{
        if(['Enter',' '].includes(event.key)) {event.preventDefault();choose(event);return;}
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
        event.preventDefault();event.stopPropagation();
        const points=[...event.currentTarget.parentElement.querySelectorAll('[data-forge-chart-point]')];
        const current=points.indexOf(event.currentTarget);
        const next=event.key==='Home'?0:event.key==='End'?points.length-1:Math.max(0,Math.min(points.length-1,current+(event.key==='ArrowRight'?1:-1)));
        // One tab stop per series; arrows move among its available observations.
        points.forEach((point,i)=>{point.setAttribute('tabindex',i===next?'0':'-1');});
        points[next]?.focus();
    };
    const inspectPointer = event => pointerActions(event)?.onInspect?.();
    return <g ref={node=>{if(pointRef.current)pointActions.delete(pointRef.current);pointRef.current=node;if(node)pointActions.set(node,{onInspect,onSelect});}} data-series-id={seriesKey} data-category={category} data-forge-chart-point={interactive?'':undefined} role={interactive?'button':'img'} tabIndex={interactive?(index===firstIndex?0:-1):undefined} aria-label={label} onPointerEnter={interactive?inspectPointer:undefined} onPointerMove={interactive?inspectPointer:undefined} onPointerDown={interactive?inspectPointer:undefined} onFocus={onInspect} onClick={interactive?event=>{
        // Keyboard/assistive activation belongs to the focused point.
        const actions=event.detail===0?{onInspect,onSelect}:pointerActions(event);
        event.stopPropagation();
        if(actions.point){
            actions.point.parentElement.querySelectorAll('[data-forge-chart-point]').forEach(point=>point.setAttribute('tabindex',point===actions.point?'0':'-1'));
            actions.point.focus();
        }
        actions?.onInspect?.();actions?.onSelect?.();
    }:undefined} onKeyDown={interactive?keyDown:undefined}>
        {interactive && <circle className="forge-chart-point-target" cx={cx} cy={cy} r={22} fill="transparent" stroke="none"/>}
        <circle className="forge-chart-point-mark" cx={cx} cy={cy} r={style.pointRadius} strokeWidth={style.pointStrokeWidth} stroke={color} fill="var(--forge-chart-surface, #ffffff)"/>
    </g>;
}
