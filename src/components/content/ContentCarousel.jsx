import NativeControlTarget from '../../runtime/NativeControlTarget.jsx';
import React, {useEffect, useId, useMemo, useState} from 'react';
import {useSignals} from '@preact/signals-react/runtime';
import {getViewSignal} from '../../core/store/signals.js';
import {useViewPartition} from '../useViewPartition.js';
import ContentImage from './ContentImage.jsx';
import {contentRecords, contentAction} from './contentModel.js';
import './content.css';

export default function ContentCarousel({id, context, value = [], onClick, disabled, autoRotateMs = 0, wholeSlideAction = false, className = '', style, 'aria-label': ariaLabel = 'Featured content'}) {
    useSignals();
    const slides = useMemo(() => contentRecords(value), [value]), generatedId = useId();
    const [activeId, setActiveId] = useState(null), [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false), [paused, setPaused] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);
    const controlId = id || generatedId;
    const viewSignal = context?.identity?.windowId ? getViewSignal(context.identity.windowId) : null;
    const selection = useViewPartition(viewSignal, 'carousels', controlId).value;
    const selectedId = viewSignal ? selection?.itemId : activeId;
    const found = slides.findIndex((slide, i) => (slide.id ?? i) === selectedId);
    const index = found >= 0 ? found : 0, active = slides[index];
    const publish = position => {
        const slide = slides[position];
        if (!viewSignal) {setActiveId(slide?.id ?? position);return;}
        const previous = viewSignal.peek() || {};
        const carousels = {...previous.carousels};
        if (slide) {
            const next = {itemId: slide.id ?? position, title: slide.title || '', index: position, total: slides.length};
            const current = carousels[controlId];
            if (current && Object.keys(next).every(key => current[key] === next[key])) return;
            carousels[controlId] = next;
        } else {
            if (!(controlId in carousels)) return;
            delete carousels[controlId];
        }
        viewSignal.value = {...previous, carousels};
    };
    const choose = next => {if (slides.length) publish((next + slides.length) % slides.length);};
    // The shared view partition is the selection source; derive its descriptive
    // fields from the current collection rather than retaining stale records.
    useEffect(() => {if (viewSignal) publish(index);}, [viewSignal, controlId, selectedId, index, active?.id, active?.title, slides.length]);
    useEffect(() => () => {
        if (!viewSignal) return;
        const previous = viewSignal.peek() || {}, carousels = {...previous.carousels};
        if (!(controlId in carousels)) return;
        delete carousels[controlId];
        viewSignal.value = {...previous, carousels};
    }, [viewSignal, controlId]);
    useEffect(() => {
        const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        if (!query) return;
        const update = () => setReducedMotion(query.matches);
        update();query.addEventListener?.('change', update);
        return () => query.removeEventListener?.('change', update);
    }, []);
    const interval = Number(autoRotateMs);
    useEffect(() => {
        if (!Number.isFinite(interval) || interval < 1000 || slides.length < 2 || paused || hovered || focused || reducedMotion || disabled) return;
        const timer = setInterval(() => choose(index + 1), interval);
        return () => clearInterval(timer);
    }, [interval, index, activeId, slides, paused, hovered, focused, reducedMotion, disabled]);
    if (!active) return null;
    const native=(suffix,locked,invoke,child)=><NativeControlTarget context={context} item={{id:`${controlId}:${suffix}`,type:'button'}} disabled={locked} actions={invoke?{click:invoke}:{}}>{child}</NativeControlTarget>;
    const open=(event,strict=false)=>(strict&&onClick?.operate?onClick.operate:onClick)?.(contentAction(active,event));
    const panelId = `${id || generatedId}-slide`;
    return <section id={id} className={`forge-content-carousel ${className}`} style={style} role="region" aria-roledescription="carousel" aria-label={ariaLabel}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)}
        onBlurCapture={event => {if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);}}
        onKeyDown={event => {if (!disabled && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {event.preventDefault();choose(index + (event.key === 'ArrowRight' ? 1 : -1));}}}>
        <article id={panelId} className="forge-content-carousel__slide" role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${slides.length}`}>
            <ContentImage src={active.image} alt={active.imageAlt || ''} className="forge-content-carousel__image"/>
            {active.graphicImage ? <div className="forge-content-carousel__graphic" aria-hidden="true"><ContentImage src={active.graphicImage} className="forge-content-carousel__graphic-image"/></div> : null}
            {wholeSlideAction ? native('open',disabled||active.disabled,({event})=>open(event,true),<button type="button" className="forge-content-carousel__open" aria-label={`Open ${active.title || 'featured item'}`} disabled={disabled || active.disabled} onClick={event => open(event)}/>) : null}
            <div className="forge-content-carousel__copy">
                <h2>{active.title}</h2>{active.description ? <p>{active.description}</p> : null}
                {active.actionLabel ? native('action',disabled||active.disabled,({event})=>open(event,true),<button type="button" className="forge-content-action" disabled={disabled || active.disabled} onClick={event => open(event)}>{active.actionLabel}</button>) : null}
            </div>
        </article>
        {slides.length > 1 ? <>
            {native('previous',disabled,()=>choose(index-1),<button type="button" className="forge-content-carousel__previous" aria-label="Previous featured item" disabled={disabled} onClick={() => choose(index - 1)}>‹</button>)}
            {native('next',disabled,()=>choose(index+1),<button type="button" className="forge-content-carousel__next" aria-label="Next featured item" disabled={disabled} onClick={() => choose(index + 1)}>›</button>)}
            <div className="forge-content-carousel__pages" role="group" aria-label="Choose featured item">{slides.map((slide, position) => <NativeControlTarget key={slide.id ?? position} context={context} item={{id:`${controlId}:page:${slide.id ?? position}`,type:'button'}} disabled={disabled} actions={{click:()=>choose(position)}}><button type="button" key={slide.id ?? position} aria-label={`Go to featured item ${position + 1}`} aria-current={position === index ? 'true' : undefined} aria-controls={panelId} disabled={disabled} onClick={() => choose(position)}/></NativeControlTarget>)}</div>
            {interval >= 1000 && !reducedMotion ? native('pause',disabled,()=>setPaused(!paused),<button type="button" className="forge-content-carousel__pause" disabled={disabled} aria-label={paused ? 'Resume rotation' : 'Pause rotation'} onClick={() => setPaused(!paused)}>{paused ? '▶' : 'Ⅱ'}</button>) : null}
        </> : null}
    </section>;
}
