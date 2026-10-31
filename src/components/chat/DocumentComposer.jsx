import React, {useCallback, useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import Button from '../Button.jsx';
import Popover from '../Popover.jsx';
import {composerMenuPlacement} from './composerMenuPlacement.js';
import Icon from '../Icon.jsx';
import SelectControl from '../SelectControl.jsx';
import {typographyProps} from '../Typography.jsx';
import CameraCapture from './CameraCapture.jsx';
import UploadChips from './UploadChips.jsx';
import useFileDrop from './useFileDrop.js';
import './documentChat.css';

function Disclosure({icon, label, children, disabled, placementGroup}) {
    const id = useId();
    const [open, setOpen] = useState(false);
    useEffect(() => {if (disabled) setOpen(false);}, [disabled]);
    // The group chooses direction before either menu opens.
    return <Popover minimal popupKind="dialog" placement={placementGroup?.placement || 'top-start'} isOpen={open} onInteraction={setOpen}
        disabled={disabled} shouldReturnFocusOnClose popoverClassName="forge-composer-popover"
        modifiersCustom={placementGroup ? [{name: 'flip', enabled: false}] : undefined}
        content={<div className="forge-composer-group-content" style={placementGroup ? {maxHeight: placementGroup.maxHeight} : undefined}>
            <div id={id} className="forge-composer-options" role="dialog" aria-label={label}>{children}</div>
        </div>}>
        <Button variant="ghost" className="forge-composer-trigger" {...typographyProps('small')}
            aria-label={label} aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="dialog" disabled={disabled}
            onKeyDown={event => {if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); setOpen(false);}}}>
            <Icon name={icon}/>{label === 'Add photos or files' ? null : <span>{label}</span>}
        </Button>
    </Popover>;
}

export default function DocumentComposer({renderInput, onSubmit, inputHostRef, draft, attachments = [], onRemoveAttachment, uploads = [], onCancelUpload, onRetryUpload,
    disabled, inputInvalid, showUpload, onDropFiles, onOpenAttach, onCaptureImage, showMic, micOn, toggleMic,
    showAbort, onAbort, submitText, queueTray, usageSummary, usageTooltip,
    agentOptions = [], agentValue, onAgentChange, modelOptions = [], modelValue, onModelChange,
    reasoningOptions = [], reasoningValue, onReasoningChange, autoSelectTools, onAutoSelectToolsChange,
    hasToolsPicker, openBundles, bundlesDialog, showSettings, onOpenSettings}) {
    const choice = (label, options, value, change) => options.length > 0 ? <label className="forge-composer-setting" {...typographyProps('label')}>
        <span>{label}</span><SelectControl {...typographyProps('body')} aria-label={label} value={value || ''} disabled={disabled}
            onChange={event => change?.(event.target.value)}>
            {!options.some(option => String(option.value ?? option.id) === String(value || '')) ? <option value="">Default</option> : null}
            {options.map(option => <option key={String(option.value ?? option.id)} value={String(option.value ?? option.id)}>{option.label || option.name || option.value || option.id}</option>)}
        </SelectControl>
    </label> : null;
    const showTools = !!(agentOptions.length || modelOptions.length || reasoningOptions.length || hasToolsPicker || showSettings);
    const attachContent = <>
        <Button variant="ghost" icon="lucide:paperclip" disabled={disabled} onClick={event => {
            const disclosure = event.currentTarget.closest('details');
            disclosure?.removeAttribute('open');
            disclosure?.querySelector('summary')?.focus();
            onOpenAttach?.();
        }}>Add photos or files</Button>
        {typeof onCaptureImage === 'function' ? <CameraCapture disabled={disabled} onCapture={onCaptureImage} documentAppearance/> : null}
    </>;
    const toolsContent = <>
        {choice('Agent', agentOptions, agentValue, onAgentChange)}
        {choice('Model', modelOptions, modelValue, onModelChange)}
        {choice('Reasoning', reasoningOptions, reasoningValue, onReasoningChange)}
        {hasToolsPicker ? <>
            <label className="forge-composer-auto-tools" {...typographyProps('body')}><input type="checkbox" checked={!!autoSelectTools} disabled={disabled} onChange={event => onAutoSelectToolsChange?.(event.target.checked)}/>Auto tools</label>
            <Button variant="ghost" disabled={disabled || !!autoSelectTools} onClick={openBundles}>Choose toolsets</Button>
        </> : null}
        {showSettings ? <Button variant="ghost" icon="lucide:settings" disabled={disabled} onClick={onOpenSettings}>Settings</Button> : null}
        {usageSummary ? <span {...typographyProps('metadata')} title={usageTooltip}>{usageSummary}</span> : null}
    </>;
    const toolbar = useRef(null);
    const attachMeasure = useRef(null);
    const toolsMeasure = useRef(null);
    const [placementGroup, setPlacementGroup] = useState(null);
    const updatePlacement = useCallback(() => {
        const panels = [attachMeasure.current, toolsMeasure.current].filter(Boolean);
        if (!toolbar.current || !panels.length) return;
        const viewport = window.visualViewport || {offsetTop: 0, height: window.innerHeight};
        const height = Math.max(...panels.map(panel => panel.scrollHeight));
        const next = composerMenuPlacement(toolbar.current.getBoundingClientRect(), height, viewport);
        setPlacementGroup(previous => previous?.placement === next.placement && previous?.maxHeight === next.maxHeight ? previous : next);
    }, []);
    useLayoutEffect(updatePlacement);
    useLayoutEffect(() => {
        const panels = [attachMeasure.current, toolsMeasure.current].filter(Boolean);
        if (!panels.length) return;
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updatePlacement);
        for (const node of [...panels, toolbar.current.closest('form')]) observer?.observe(node);
        window.addEventListener('resize', updatePlacement);
        document.addEventListener('scroll', updatePlacement, true);
        window.visualViewport?.addEventListener('resize', updatePlacement);
        window.visualViewport?.addEventListener('scroll', updatePlacement);
        updatePlacement();
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', updatePlacement);
            document.removeEventListener('scroll', updatePlacement, true);
            window.visualViewport?.removeEventListener('resize', updatePlacement);
            window.visualViewport?.removeEventListener('scroll', updatePlacement);
        };
    }, [showUpload, showTools, updatePlacement]);
    const [keyboardFocus, setKeyboardFocus] = useState(false);
    const {fileDrag, dropHandlers} = useFileDrop(onDropFiles, showUpload && !disabled);
    useEffect(() => {
        const key = event => {if (event.key === 'Tab') setKeyboardFocus(true);};
        document.addEventListener('keydown', key);
        return () => document.removeEventListener('keydown', key);
    }, []);
    const instructionsId = useId();
    const canSend = !disabled && !inputInvalid && (!!String(draft).trim() || attachments.length > 0);
    return <form className={`chat-composer forge-document-composer${keyboardFocus ? ' is-keyboard-focus' : ''}`} onPointerDownCapture={() => setKeyboardFocus(false)} data-testid="chat-composer" onSubmit={onSubmit}>
        {queueTray}
        <div className={`forge-document-composer-shell${fileDrag ? ' is-file-dragging' : ''}`} data-testid="chat-composer-shell" {...dropHandlers}>
            {fileDrag ? <div className="forge-composer-file-drop" role="status" {...typographyProps('label')}>
                <Icon name="lucide:paperclip"/><span>Drop files to upload</span>
            </div> : null}
            <UploadChips uploads={uploads} attachments={attachments} onRemove={onRemoveAttachment}
                onCancel={onCancelUpload} onRetry={showUpload ? onRetryUpload : undefined} disabled={disabled}/>
            <div ref={inputHostRef} className="forge-document-input">{renderInput({className: 'forge-document-textarea', documentAppearance: true, describedBy: instructionsId})}</div>
            <div ref={toolbar} className="forge-document-toolbar" data-testid="chat-composer-bar">
                {showUpload ? <Disclosure label="Add photos or files" icon="lucide:plus" disabled={disabled} placementGroup={placementGroup}>{attachContent}</Disclosure> : null}
                {showTools ? <Disclosure label="Tools" icon="lucide:sliders-horizontal" disabled={disabled} placementGroup={placementGroup}>{toolsContent}</Disclosure> : null}
                <div className="forge-document-submit">
                    {showMic ? <Button variant="ghost" icon={micOn ? 'lucide:square' : 'lucide:mic'} hideLabel aria-label={micOn ? 'Disable mic' : 'Enable mic'} aria-pressed={micOn} disabled={disabled} data-testid="chat-composer-mic" onClick={toggleMic}/> : null}
                    {showAbort ? <Button variant="primary" icon="lucide:square" hideLabel className="forge-document-send" aria-label="Stop response" title="Stop response" data-testid="chat-composer-abort" onClick={onAbort}/>
                        : <Button variant="primary" icon="lucide:arrow-up" hideLabel className="forge-document-send" type="submit" aria-label={submitText} title={submitText} disabled={!canSend} data-testid="chat-composer-send"/>}
                </div>
            </div>
        </div>
        <div className="forge-composer-measure forge-composer-popover" aria-hidden="true" inert="">
            {showUpload ? <div ref={attachMeasure} className="forge-composer-options">{attachContent}</div> : null}
            {showTools ? <div ref={toolsMeasure} className="forge-composer-options">{toolsContent}</div> : null}
        </div>
        <span id={instructionsId} className="forge-composer-instructions">Enter sends your message. Shift+Enter adds a new line.</span>
        {bundlesDialog}
    </form>;
}
