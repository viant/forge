// Composer.jsx – TextArea prompt with send/upload/tools controls
import React, { useState } from "react";
import { Button, TextArea, FileInput } from "@blueprintjs/core";


export default function Composer({
    tools = [],
    onSubmit,
    onUpload,
    onAbort,
    showTools = false,
    showUpload = false,
    showAbort = false,
    disabled = false,
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

    return (
        <form className="flex flex-col gap-1 mt-2" onSubmit={handleSubmit}>
            <div className="flex w-full items-start">
                <div className="composer-wrapper" style={{ flex: 1, minWidth: 0 }}>
                    <TextArea
                        fill
                        placeholder="Type your message…"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        style={{ borderRadius: 14, resize: "vertical", minHeight: 40, paddingRight: 32 }}
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

            <div className="flex items-center gap-2">
                {showUpload && (
                    <FileInput text="Upload" onInputChange={(e) => onUpload?.(e)} disabled={disabled} />
                )}
            </div>
        </form>
    );
}
