import React from 'react';

export default function ChartPoint({cx,cy,index,firstIndex,label,color,style,onSelect,onInspect,seriesKey,category}) {
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
    return <g data-series-id={seriesKey} data-category={category} data-forge-chart-point={interactive?'':undefined} role={interactive?'button':'img'} tabIndex={interactive?(index===firstIndex?0:-1):undefined} aria-label={label} onMouseEnter={onInspect} onFocus={onInspect} onClick={interactive?event=>{onInspect?.();choose(event);}:undefined} onKeyDown={interactive?keyDown:undefined}>
        {interactive && <circle className="forge-chart-point-target" cx={cx} cy={cy} r={22} fill="transparent" stroke="none"/>}
        <circle className="forge-chart-point-mark" cx={cx} cy={cy} r={style.pointRadius} strokeWidth={style.pointStrokeWidth} stroke={color} fill="var(--forge-chart-surface, #ffffff)"/>
    </g>;
}
