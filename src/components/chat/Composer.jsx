// Composer.jsx – TextArea prompt with send/upload/tools controls
import React, { useState } from "react";
import { Button, TextArea, Tooltip } from "@blueprintjs/core";
import { PaperPlaneRight, StopCircle, Microphone, MicrophoneSlash } from '@phosphor-icons/react';


export default function Composer({
    tools = [],
    onSubmit,
    onOpenAttach,
    onOpenSettings,
    onAbort,
    showTools = false,
    showUpload = false,
    showSettings = false,
    showAbort = false,
    uploadTooltip = 'upload',
    settingsTooltip,
    sendTooltip,
    abortTooltip,
    showMic = false,
    micTooltip,
    micOn: micOnProp,
    defaultMicOn = false,
    onToggleMic,
    disabled = false,
    attachments = [],
    onRemoveAttachment,
}) {
    const [draft, setDraft] = useState("");
    const [selectedTools, setSelectedTools] = useState([]);
    const [micOnInternal, setMicOnInternal] = useState(!!defaultMicOn);
    const micOn = (micOnProp !== undefined) ? !!micOnProp : micOnInternal;
    const toggleMic = () => {
        const next = !micOn;
        if (micOnProp === undefined) setMicOnInternal(next);
        onToggleMic?.(next);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (disabled) return; // Block submission while disabled
        if (!draft.trim()) return;
        onSubmit?.({ content: draft, toolNames: selectedTools });
        setDraft("");
    };

    const handleAbort = (e) => {
        e.preventDefault();
        onAbort?.();
    };

    // Reflect global loading lock by disabling the action controls and showing a spinner
    const actionDisabled = disabled;
    const isTerminate = !!showAbort;
    const iconEl = isTerminate ? (
        <StopCircle size={18} weight="fill" />
    ) : (
        <PaperPlaneRight size={18} weight="fill" />
    );

    const topPad = (attachments && attachments.length) ? Math.min(12 + attachments.length * 22, 100) : 12;
    const leftIcons = (showUpload ? 1 : 0) + (showSettings ? 1 : 0);
    const rightIcons = 1 + (showMic ? 1 : 0); // send/abort + optional mic
    const attachmentsLeft = 6 + 30 * leftIcons; // align with absolute left controls (6 + 30px per icon)
    const textPadLeft = 12 + 32 * leftIcons;    // base 12 + 32px per icon for inner padding
    const textPadRight = 32 + (rightIcons - 1) * 36; // allow room for mic + send
    const attachmentsRight = 40 + (rightIcons - 1) * 36; // overlay space for right-side icons

    const withTooltip = (node, content) => content ? (
        <Tooltip content={content} hoverOpenDelay={250}>{node}</Tooltip>
    ) : node;

    return (
        <form className="flex flex-col gap-1 mt-2" onSubmit={handleSubmit}>
            <div className="flex w-full items-start">
                <div className="composer-wrapper" style={{ flex: 1, minWidth: 0 }}>
                    {showUpload && (
                        withTooltip(
                            <Button
                                icon="plus"
                                minimal
                                small
                                className="composer-attach"
                                disabled={disabled}
                                title={uploadTooltip}
                                aria-label={uploadTooltip}
                                onClick={(e) => { e.preventDefault(); onOpenAttach?.(); }}
                            />,
                            uploadTooltip
                        )
                    )}
                    {showSettings && (
                        withTooltip(
                            <Button
                                icon="cog"
                                minimal
                                small
                                className="composer-attach"
                                style={{ left: showUpload ? 36 : 6 }}
                                disabled={disabled}
                                aria-label={settingsTooltip || "Settings"}
                                title={settingsTooltip || "Settings"}
                                onClick={(e) => { e.preventDefault(); onOpenSettings?.(); }}
                            />,
                            settingsTooltip
                        )
                    )}
                    {attachments && attachments.length > 0 && (
                        <div className="composer-attachments" style={{ left: attachmentsLeft, right: attachmentsRight }}>
                            <table style={{ width: '100%', tableLayout: 'fixed' }}>
                                <colgroup>
                                    <col style={{ width: '28px' }} />
                                    <col />
                                </colgroup>
                                <tbody>
                                {attachments.map((att, idx) => (
                                    <tr key={`${att.name}-${idx}`}>
                                        <td style={{ padding: '2px 0' }}>
                                            <Button
                                                minimal
                                                small
                                                icon="cross"
                                                onClick={() => onRemoveAttachment?.(idx)}
                                                aria-label={`Remove ${att.name}`}
                                            />
                                        </td>
                                        <td style={{ padding: '2px 0' }}>
                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {att.name}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <TextArea
                        fill
                        placeholder="Type your message…"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        style={{ borderRadius: 14, resize: "vertical", minHeight: 40, paddingRight: textPadRight, paddingLeft: textPadLeft, paddingTop: topPad }}
                        disabled={disabled}
                    />

                    {showMic && withTooltip(
                        <Button
                            minimal
                            className="composer-mic"
                            style={{ width: 28, height: 28, right: 44 }}
                            onClick={(e) => { e.preventDefault(); toggleMic(); }}
                            disabled={disabled}
                            aria-pressed={micOn}
                            aria-label={micTooltip || (micOn ? 'Disable mic' : 'Enable mic')}
                            title={micTooltip || (micOn ? 'Disable mic' : 'Enable mic')}
                        >
                            {micOn ? <Microphone size={18} weight="fill" /> : <MicrophoneSlash size={18} />}
                        </Button>,
                        micTooltip
                    )}

                    {/* Single action button: send by default or abort when showAbort */}
                    {withTooltip(
                        <Button
                            icon={iconEl}
                            minimal
                            intent={isTerminate ? "danger" : "primary"}
                            className="composer-send"
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 9999,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            aria-label={isTerminate ? (abortTooltip || "Terminate") : (sendTooltip || "Send")}
                            title={isTerminate ? (abortTooltip || "Terminate") : (sendTooltip || "Send")}
                            {...( 
                                isTerminate
                                    ? { onClick: handleAbort, disabled: false, type: "button" }
                                    : {
                                          type: "submit",
                                          disabled: actionDisabled,
                                          loading: disabled,
                                      }
                            )}
                        />,
                        isTerminate ? abortTooltip : sendTooltip
                    )}
                </div>
            </div>

            {/* no external attach row; plus icon lives inside the input */}
        </form>
    );
}
