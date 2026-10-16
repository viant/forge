import React, {useEffect, useId, useMemo, useState} from 'react';
import ContentImage from './ContentImage.jsx';
import {contentRecords, contentAction} from './contentModel.js';
import './content.css';

export default function ContentCarousel({id, value = [], onClick, disabled, autoRotateMs = 0, className = '', style, 'aria-label': ariaLabel = 'Featured content'}) {
    const slides = useMemo(() => contentRecords(value), [value]), generatedId = useId();
    const [activeId, setActiveId] = useState(null), [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false), [paused, setPaused] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);
    const found = slides.findIndex((slide, i) => (slide.id ?? i) === activeId);
    const index = found >= 0 ? found : 0, active = slides[index];
    const choose = next => setActiveId(slides[(next + slides.length) % slides.length]?.id ?? ((next + slides.length) % slides.length));
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
    const panelId = `${id || generatedId}-slide`;
    return <section id={id} className={`forge-content-carousel ${className}`} style={style} role="region" aria-roledescription="carousel" aria-label={ariaLabel}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)}
        onBlurCapture={event => {if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);}}
        onKeyDown={event => {if (!disabled && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {event.preventDefault();choose(index + (event.key === 'ArrowRight' ? 1 : -1));}}}>
        <article id={panelId} className="forge-content-carousel__slide" role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${slides.length}`}>
            <ContentImage src={active.image} alt={active.imageAlt || ''} className="forge-content-carousel__image"/>
            <div className="forge-content-carousel__copy">
                <h2>{active.title}</h2>{active.description ? <p>{active.description}</p> : null}
                {active.actionLabel ? <button type="button" className="forge-content-action" disabled={disabled || active.disabled} onClick={event => onClick?.(contentAction(active, event))}>{active.actionLabel}</button> : null}
            </div>
        </article>
        {slides.length > 1 ? <>
            <button type="button" className="forge-content-carousel__previous" aria-label="Previous featured item" disabled={disabled} onClick={() => choose(index - 1)}>‹</button>
            <button type="button" className="forge-content-carousel__next" aria-label="Next featured item" disabled={disabled} onClick={() => choose(index + 1)}>›</button>
            <div className="forge-content-carousel__pages" role="group" aria-label="Choose featured item">{slides.map((slide, position) => <button type="button" key={slide.id ?? position} aria-label={`Go to featured item ${position + 1}`} aria-current={position === index ? 'true' : undefined} aria-controls={panelId} disabled={disabled} onClick={() => choose(position)}/>)}</div>
            {interval >= 1000 && !reducedMotion ? <button type="button" className="forge-content-carousel__pause" disabled={disabled} aria-label={paused ? 'Resume rotation' : 'Pause rotation'} onClick={() => setPaused(!paused)}>{paused ? '▶' : 'Ⅱ'}</button> : null}
        </> : null}
    </section>;
}
