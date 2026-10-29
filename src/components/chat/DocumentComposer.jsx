import React, {useEffect, useId, useRef, useState} from 'react';
import Button from '../Button.jsx';
import Icon from '../Icon.jsx';
import SelectControl from '../SelectControl.jsx';
import {typographyProps} from '../Typography.jsx';
import CameraCapture from './CameraCapture.jsx';
import UploadChips from './UploadChips.jsx';
import useFileDrop from './useFileDrop.js';
import './documentChat.css';

function Disclosure({icon, label, children, disabled}) {
    const ref = useRef(null);
    const id = useId();
    const [open, setOpen] = useState(false);
    useEffect(() => {
        const outside = event => {if (!ref.current?.contains(event.target)) ref.current?.removeAttribute('open');};
        document.addEventListener('pointerdown', outside);
        return () => document.removeEventListener('pointerdown', outside);
    }, []);
    return <details ref={ref} className="forge-composer-disclosure" onToggle={event => setOpen(event.currentTarget.open)} onKeyDown={event => {
        if (event.key !== 'Escape' || !ref.current?.open) return;
        event.preventDefault(); event.stopPropagation(); ref.current.open = false; ref.current.querySelector('summary')?.focus();
    }}>
        <summary {...typographyProps('small')} role="button" aria-label={label} aria-expanded={open} aria-controls={id} aria-disabled={disabled || undefined}
            onClick={event => {if (disabled) event.preventDefault();}}>
            <Icon name={icon}/>{label === 'Add photos or files' ? null : <span>{label}</span>}
        </summary>
        <div id={id} className="forge-composer-options" role="group" aria-label={label}>{children}</div>
    </details>;
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
            <div className="forge-document-toolbar" data-testid="chat-composer-bar">
                {showUpload ? <Disclosure label="Add photos or files" icon="lucide:plus" disabled={disabled}>
                    <Button variant="ghost" icon="lucide:paperclip" disabled={disabled} onClick={event => {
                        const disclosure = event.currentTarget.closest('details');
                        disclosure?.removeAttribute('open');
                        disclosure?.querySelector('summary')?.focus();
                        onOpenAttach?.();
                    }}>Add photos or files</Button>
                    {typeof onCaptureImage === 'function' ? <CameraCapture disabled={disabled} onCapture={onCaptureImage} documentAppearance/> : null}
                </Disclosure> : null}
                {(agentOptions.length || modelOptions.length || reasoningOptions.length || hasToolsPicker || showSettings) ? <Disclosure label="Tools" icon="lucide:sliders-horizontal" disabled={disabled}>
                    {choice('Agent', agentOptions, agentValue, onAgentChange)}
                    {choice('Model', modelOptions, modelValue, onModelChange)}
                    {choice('Reasoning', reasoningOptions, reasoningValue, onReasoningChange)}
                    {hasToolsPicker ? <>
                        <label className="forge-composer-auto-tools" {...typographyProps('body')}><input type="checkbox" checked={!!autoSelectTools} disabled={disabled} onChange={event => onAutoSelectToolsChange?.(event.target.checked)}/>Auto tools</label>
                        <Button variant="ghost" disabled={disabled || !!autoSelectTools} onClick={openBundles}>Choose toolsets</Button>
                    </> : null}
                    {showSettings ? <Button variant="ghost" icon="lucide:settings" disabled={disabled} onClick={onOpenSettings}>Settings</Button> : null}
                    {usageSummary ? <span {...typographyProps('metadata')} title={usageTooltip}>{usageSummary}</span> : null}
                </Disclosure> : null}
                <div className="forge-document-submit">
                    {showMic ? <Button variant="ghost" icon={micOn ? 'lucide:square' : 'lucide:mic'} hideLabel aria-label={micOn ? 'Disable mic' : 'Enable mic'} aria-pressed={micOn} disabled={disabled} data-testid="chat-composer-mic" onClick={toggleMic}/> : null}
                    {showAbort ? <Button variant="ghost" icon="lucide:square" hideLabel aria-label="Stop response" data-testid="chat-composer-abort" onClick={onAbort}/> : null}
                    <Button variant="primary" icon="lucide:arrow-up" hideLabel className="forge-document-send" type="submit" aria-label={submitText} title={submitText} disabled={!canSend} data-testid="chat-composer-send"/>
                </div>
            </div>
        </div>
        <span id={instructionsId} className="forge-composer-instructions">Enter sends your message. Shift+Enter adds a new line.</span>
        {bundlesDialog}
    </form>;
}
