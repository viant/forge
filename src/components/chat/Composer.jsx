// Composer.jsx – TextArea prompt with send/upload/tools controls
import React, { useState } from "react";
import { Button, TextArea } from "@blueprintjs/core";


export default function Composer({
    tools = [],
    onSubmit,
    onOpenAttach,
    onAbort,
    showTools = false,
    showUpload = false,
    showAbort = false,
    disabled = false,
    attachments = [],
    onRemoveAttachment,
}) {
    const [draft, setDraft] = useState("");
    const [selectedTools, setSelectedTools] = useState([]);

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

    const topPad = (attachments && attachments.length) ? Math.min(12 + attachments.length * 22, 100) : 12;

    return (
        <form className="flex flex-col gap-1 mt-2" onSubmit={handleSubmit}>
            <div className="flex w-full items-start">
                <div className="composer-wrapper" style={{ flex: 1, minWidth: 0 }}>
                    {showUpload && (
                        <Button
                            icon="plus"
                            minimal
                            small
                            className="composer-attach"
                            disabled={disabled}
                            onClick={(e) => { e.preventDefault(); onOpenAttach?.(); }}
                        />
                    )}
                    {attachments && attachments.length > 0 && (
                        <div className="composer-attachments">
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
                        style={{ borderRadius: 14, resize: "vertical", minHeight: 40, paddingRight: 32, paddingLeft: showUpload ? 44 : 12, paddingTop: topPad }}
                        disabled={disabled}
                    />

                    {/* Single action button: send by default or abort when showAbort */}
                    <Button
                        icon={showAbort ? "cross" : "send-message"}
                        minimal
                        intent={showAbort ? "danger" : undefined}
                        className="composer-send"
                        title={showAbort ? "Abort generation" : "Send"}
                        {...( 
                            showAbort
                                ? { onClick: handleAbort, disabled: false, type: "button" }
                                : {
                                      type: "submit",
                                      disabled: actionDisabled,
                                      loading: disabled,
                                  }
                        )}
                    />
                </div>
            </div>

            {/* no external attach row; plus icon lives inside the input */}
        </form>
    );
}
