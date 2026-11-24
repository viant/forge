import React, {useEffect, useId, useRef, useState} from 'react';
import {Dialog, InputGroup} from '@blueprintjs/core';
import Button from '../../components/Button.jsx';
import Icon from '../../components/Icon.jsx';
import SelectControl from '../../components/SelectControl.jsx';
import Typography from '../../components/Typography.jsx';
import ScrollArea from '../../components/ScrollArea.jsx';
import {DocumentPresentationContext} from '../../components/documentPresentation.js';
import {SectionPattern} from '../../components/patterns/index.js';
import ForgeFormGroup from '../../packs/blueprint/ForgeFormGroup.jsx';

// Independently authored, synthetic native composition. The real producer keeps
// its fields, validation and guarded close/submit actions when adopting the recipe.
const outline = [
    {id: 'identity', title: 'Identity'},
    {id: 'settings', title: 'Account Settings'},
    {id: 'contact', title: 'Contact Information'},
];
const empty = {organization: '', name: '', category: '', currency: 'usd', timezone: '', reference: '', contact: '', phone: '', email: ''};
const existing = {...empty, organization: 'design', name: 'Design workspace', category: 'internal', timezone: 'america-los-angeles'};

// Read the browser's existing constraint results; do not create a second set of
// business validators. Product integrations use their existing validation owner.
function nativeErrors(form) {
    return Object.fromEntries(Array.from(form.elements)
        .filter(control => control.name && control.willValidate && !control.validity.valid)
        .map(control => [control.name, control.validity.valueMissing
            ? `${control.labels?.[0]?.textContent.replace(/\s*\*\s*$/, '').trim() || control.name} is required.`
            : control.validationMessage]));
}

function FullScreenForm({variant, state, onClose, onComplete, titleId}) {
    const id = useId();
    const formRef = useRef(null);
    const bodyRef = useRef(null);
    const outlineRef = useRef(null);
    const sectionRefs = useRef({});
    const sectionJump = useRef(null);
    const editing = variant === 'Apply';
    const disabled = state === 'Disabled';
    const [values, setValues] = useState({... (editing ? existing : empty)});
    const [errors, setErrors] = useState({});
    const [attempted, setAttempted] = useState(state === 'Validation errors');
    const [active, setActive] = useState('identity');
    const title = editing ? 'Edit Workspace' : 'New Workspace';
    const fieldsBySection = {identity: ['organization', 'name', 'category'], settings: ['currency', 'timezone', 'reference'], contact: ['contact', 'phone', 'email']};
    const sectionErrors = section => fieldsBySection[section].filter(name => errors[name]);

    useEffect(() => {
        if (state === 'Validation errors' && formRef.current) setErrors(nativeErrors(formRef.current));
    }, [state]);

    useEffect(() => {
        const nav = outlineRef.current;
        const current = nav?.querySelector('[aria-current="location"]');
        if (!current || nav.scrollWidth <= nav.clientWidth) return;
        const bounds = nav.getBoundingClientRect(), item = current.getBoundingClientRect();
        const gutter = parseFloat(getComputedStyle(nav).paddingInlineStart) || 0;
        const overflow = item.left < bounds.left + gutter ? item.left - bounds.left - gutter
            : item.right > bounds.right - gutter ? item.right - bounds.right + gutter : 0;
        if (overflow) nav.scrollTo({left: nav.scrollLeft + overflow, behavior: 'instant'});
    }, [active]);

    const goToSection = (section, field) => {
        const node = sectionRefs.current[section];
        const viewport = bodyRef.current;
        setActive(section);
        (field || node?.querySelector('input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'))?.focus({preventScroll: true});
        if (node && viewport) {
            const inset = parseFloat(getComputedStyle(viewport).scrollPaddingTop) || 0;
            const margin = parseFloat(getComputedStyle(node).scrollMarginTop) || 0;
            const top = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight,
                viewport.scrollTop + node.getBoundingClientRect().top - viewport.getBoundingClientRect().top - inset - margin));
            sectionJump.current = Math.abs(viewport.scrollTop - top) > 1 ? {section, top} : null;
            viewport.scrollTo({top, behavior: 'instant'});
        }
    };
    const followScroll = event => {
        const viewport = event.currentTarget;
        const jump = sectionJump.current;
        sectionJump.current = null;
        // A native instant jump still emits scroll; retain its requested section
        // when two destinations share a position clamped to the bottom.
        if (jump && Math.abs(viewport.scrollTop - jump.top) <= 1) {
            setActive(jump.section);
            return;
        }
        if (viewport.scrollHeight <= viewport.clientHeight) return;
        // The final card may not reach the top before the native scroll ends.
        if (viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1) {
            setActive(outline[outline.length - 1].id);
            return;
        }
        const inset = parseFloat(getComputedStyle(viewport).scrollPaddingTop) || 0;
        // Track the upper quarter of the unobscured reading area, so a middle
        // card can become current even in a tall window where it cannot top-align.
        const top = viewport.getBoundingClientRect().top + inset + Math.max(0, viewport.clientHeight - inset) / 4;
        const current = outline.reduce((visible, section) => {
            const node = sectionRefs.current[section.id];
            const margin = node ? parseFloat(getComputedStyle(node).scrollMarginTop) || 0 : 0;
            return node && node.getBoundingClientRect().top <= top + margin + 1 ? section.id : visible;
        }, outline[0].id);
        setActive(current);
    };
    const update = name => event => setValues(current => ({...current, [name]: event.target.value}));
    const field = (name, label, {required = false, options, helper, placeholder, type = 'text'} = {}) => {
        const fieldId = `${id}-${name}`, helperId = `${fieldId}-feedback`, error = errors[name];
        const props = {id: fieldId, name, value: values[name], onChange: update(name), required, disabled,
            'aria-invalid': error ? true : undefined, 'aria-describedby': error || helper ? helperId : undefined, 'data-forge-type': 'body'};
        return <ForgeFormGroup key={name} label={label} labelFor={fieldId} labelInfo={required ? <span className="forge-fullscreen-required" aria-hidden="true">*</span> : undefined}
            helperId={helperId} helperText={error || helper ? <span className="forge-fullscreen-field-feedback"><Icon name={error ? 'lucide:triangle-alert' : 'lucide:info'}/><span>{error || helper}</span></span> : undefined} intent={error ? 'danger' : undefined} feedbackRole="small">
            {options ? <SelectControl {...props} onKeyDown={event => {
                // Let the native open picker consume Escape before Dialog does.
                // Keep its default dismissal; no additional open-state flag.
                if (event.key === 'Escape' && event.currentTarget.matches(':open')) event.stopPropagation();
            }}>{options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</SelectControl>
                : <InputGroup {...props} intent={error ? 'danger' : undefined} type={type} placeholder={placeholder} autoComplete="off"/>}
        </ForgeFormGroup>;
    };
    const content = {
        identity: <>
            {field('organization', 'Organization', {required: true, options: [['', 'Select an organization…'], ['design', 'Design team'], ['research', 'Research team']]})}
            {field('name', 'Workspace name', {required: true, placeholder: 'Enter a workspace name…'})}
            {field('category', 'Category', {required: true, options: [['', 'Select a category…'], ['internal', 'Internal'], ['shared', 'Shared']]})}
        </>,
        settings: <>
            {field('currency', 'Currency', {required: true, options: [['usd', 'USD — US Dollar'], ['cad', 'CAD — Canadian Dollar']], helper: 'Currency cannot be changed after the workspace is created.'})}
            {field('timezone', 'Time zone', {required: true, options: [['', 'Select a time zone…'], ['america-los-angeles', 'Pacific Time — Los Angeles'], ['america-new-york', 'Eastern Time — New York'], ['utc', 'Coordinated Universal Time']]})}
            {field('reference', 'Reference ID', {placeholder: 'Enter an ID…'})}
        </>,
        contact: <>
            {field('contact', 'Contact name', {placeholder: 'Enter a contact name…'})}
            {field('phone', 'Phone', {type: 'tel', placeholder: 'Enter a phone number…'})}
            {field('email', 'Email', {type: 'email', placeholder: 'Enter an email address…'})}
        </>,
    };
    return <form ref={formRef} className="forge-fullscreen-form" aria-label={`${title} example`}
        onChangeCapture={event => {
            const section = event.target.closest('[data-fullscreen-section]');
            if (section) setActive(section.dataset.fullscreenSection);
            if (attempted) setErrors(nativeErrors(event.currentTarget));
        }}
        onInvalidCapture={event => {
            event.preventDefault();
            const first = Array.from(event.currentTarget.elements).find(control => control.willValidate && !control.validity.valid);
            if (event.target !== first) return;
            setAttempted(true);
            setErrors(nativeErrors(event.currentTarget));
            const section = first?.closest('[data-fullscreen-section]');
            if (section) goToSection(section.dataset.fullscreenSection, first);
        }}
        onSubmit={event => {event.preventDefault(); onComplete(editing ? 'Example changes applied locally.' : 'Example workspace created locally.');}}>
        <header className="forge-fullscreen-header">
            <span className="forge-fullscreen-brand" aria-hidden="true"><Icon name="lucide:layers"/></span>
            <Typography as="h2" typeRole="heading" id={titleId} tabIndex={-1} data-fullscreen-title>{title}</Typography>
            <Button variant="ghost" icon="lucide:x" hideLabel aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}/>
        </header>
        <ScrollArea ref={bodyRef} className="forge-fullscreen-body" onScroll={followScroll}>
            <div className="forge-fullscreen-content">
                <nav ref={outlineRef} className="forge-fullscreen-outline" aria-label="Form sections">
                    <ol>{outline.map((section, index) => {
                        const count = sectionErrors(section.id).length;
                        return <li key={section.id}><Button variant="ghost" className="forge-fullscreen-destination"
                            aria-controls={`${id}-${section.id}`} aria-current={active === section.id ? 'location' : undefined}
                            aria-label={`${index + 1}. ${section.title}${count ? `, ${count} ${count === 1 ? 'field needs' : 'fields need'} attention` : ''}`}
                            data-invalid={count ? 'true' : undefined} onClick={() => goToSection(section.id)}>
                            <span className="forge-fullscreen-number" aria-hidden="true">{count ? <Icon name="lucide:circle-alert"/> : index + 1}</span>
                            <span className="forge-fullscreen-destination-copy"><Typography typeRole="section">{section.title}</Typography></span>
                        </Button></li>;
                    })}</ol>
                </nav>
                <DocumentPresentationContext.Provider value={true}><div className="forge-fullscreen-sections">{outline.map((section, index) => <div key={section.id} id={`${id}-${section.id}`} data-fullscreen-section={section.id}
                    ref={node => {sectionRefs.current[section.id] = node;}} onFocusCapture={() => setActive(section.id)}>
                    <SectionPattern className="forge-fullscreen-section" appearance="primary" collapsible={false}
                        title={<span className="forge-fullscreen-section-title" data-invalid={sectionErrors(section.id).length ? 'true' : undefined}><span className="forge-fullscreen-number" aria-hidden="true">{sectionErrors(section.id).length ? <Icon name="lucide:circle-alert"/> : index + 1}</span><Typography typeRole="section">{section.title}</Typography></span>}>
                        <div className="forge-fullscreen-fields">{content[section.id]}</div>
                    </SectionPattern>
                </div>)}</div></DocumentPresentationContext.Provider>
            </div>
        </ScrollArea>
        <footer className="forge-fullscreen-footer"><div className="forge-fullscreen-footer-content">
            <div className="forge-fullscreen-actions"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" disabled={disabled}>{editing ? 'Apply' : 'Create Workspace'}</Button></div>
        </div></footer>
    </form>;
}

export default function FullScreenExample({variant = 'Create', state = 'Default', thumbnail = false}) {
    const id = useId();
    const [open, setOpen] = useState(false);
    const [result, setResult] = useState('');
    const titleId = `${id}-title`;
    const complete = message => {setResult(message); setOpen(false);};
    return <div className="catalog-fullscreen-example">
        <div className="catalog-row"><Button variant="secondary" onClick={() => setOpen(true)}>Open full screen</Button>{!thumbnail && <Typography typeRole="small" className="catalog-muted">Opens over the whole workspace. Synthetic form; no product data is created.</Typography>}</div>
        {result && <Typography typeRole="small" role="status">{result}</Typography>}
        <Dialog className="forge-fullscreen-dialog" isOpen={open} onClose={() => setOpen(false)} aria-labelledby={titleId}
            shouldReturnFocusOnClose onOpened={node => node.querySelector('[data-fullscreen-title]')?.focus()}>
            <FullScreenForm variant={variant} state={state} titleId={titleId} onClose={() => setOpen(false)} onComplete={complete}/>
        </Dialog>
    </div>;
}
