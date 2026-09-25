import React, { useState } from "react";
import { Button, Dialog, InputGroup } from "@blueprintjs/core";

export default function ReportBuilderTabActions({ tab, tabCount, hasGroup, removalCount, onAdd, onRemove, onEdit, onUndo, canUndo, onEditingChange, actionsDisabled = false }) {
    const [action, setAction] = useState("");
    const [title, setTitle] = useState("");
    const canRemove = !!tab?.sectionId || (!hasGroup && tab?.entries?.length > 0);
    const close = () => { setAction(""); onEditingChange?.(false); };
    return (
        <div className="forge-report-builder__design-outline-topbar-actions">
            <Button small minimal icon="undo" disabled={!canUndo} onClick={onUndo} aria-label="Undo last design change">Undo</Button>
            <Button small outlined icon="add" disabled={actionsDisabled} onClick={() => { setTitle(`Tab ${tabCount + 1}`); setAction("add"); onEditingChange?.(true); }}>Add tab</Button>
            <Button small minimal icon="trash" disabled={actionsDisabled || !canRemove} onClick={() => { setAction("remove"); onEditingChange?.(true); }}>Remove tab</Button>
            {hasGroup ? <Button small minimal icon="edit" disabled={actionsDisabled} onClick={onEdit}>Edit report tabs</Button> : null}
            <Dialog isOpen={!!action} onClose={close} title={action === "remove" ? `Remove ${tab?.label || "tab"}?` : "Add report tab"}>
                <form onSubmit={(event) => {
                    event.preventDefault();
                    if (action === "add") {
                        if (!title.trim()) return;
                        onAdd(title.trim());
                    } else onRemove(tab.id);
                    close();
                }}>
                    <div className="bp6-dialog-body">
                        {action === "add" ? <label>Tab name<InputGroup autoFocus value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Tab name" /></label> : (
                            <p>Remove “{tab?.label}” and {removalCount} {removalCount === 1 ? "block" : "blocks"}, including nested blocks? Blocks shared with other tabs will remain.</p>
                        )}
                    </div>
                    <div className="bp6-dialog-footer"><div className="bp6-dialog-footer-actions">
                        <Button onClick={close}>Cancel</Button>
                        <Button type="submit" intent={action === "remove" ? "danger" : "primary"} disabled={action === "add" && !title.trim()}>
                            {action === "remove" ? "Remove tab and blocks" : "Add tab"}
                        </Button>
                    </div></div>
                </form>
            </Dialog>
        </div>
    );
}
