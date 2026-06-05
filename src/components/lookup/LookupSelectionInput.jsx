import React, { useId } from "react";
import { Icon } from "@blueprintjs/core";
import "./LookupSelectionInput.css";

function normalizeSelections(selections = []) {
    return Array.isArray(selections) ? selections : [];
}

export default function LookupSelectionInput({
    selections = [],
    inputValue = "",
    placeholder = "Enter value",
    browseLabel = "Browse",
    addLabel = "Add value",
    allowManualEntry = true,
    disabled = false,
    onInputChange,
    onInputCommit,
    onBrowse,
    onRemoveSelection,
    className = "",
}) {
    const inputId = useId();
    const normalizedSelections = normalizeSelections(selections);
    const canBrowse = typeof onBrowse === "function";
    const canType = allowManualEntry && !disabled;
    const trimmedValue = String(inputValue || "").trim();
    const hasEndButton = canBrowse || (allowManualEntry && typeof onInputCommit === "function");
    const endButtonLabel = canBrowse ? browseLabel : addLabel;

    const commitInput = () => {
        if (!canType || !trimmedValue || typeof onInputCommit !== "function") {
            return;
        }
        onInputCommit(trimmedValue);
    };

    const openBrowse = () => {
        if (!canBrowse || disabled) {
            return;
        }
        onBrowse();
    };

    const handleEndButton = () => {
        if (canBrowse) {
            openBrowse();
            return;
        }
        commitInput();
    };

    return (
        <div className={["forge-lookup-selection-input", disabled ? "is-disabled" : "", className].filter(Boolean).join(" ")}>
            {normalizedSelections.length > 0 ? (
                <div className="forge-lookup-selection-input__chips" aria-label="Selected lookup values">
                    {normalizedSelections.map((selection, index) => (
                        <button
                            key={`${selection?.value ?? selection?.label ?? index}_${index}`}
                            type="button"
                            className="forge-lookup-chip"
                            onClick={() => onRemoveSelection?.(index)}
                            disabled={disabled || typeof onRemoveSelection !== "function"}
                            title={selection?.label || String(selection?.value || "")}
                        >
                            <span>{selection?.label || String(selection?.value || "")}</span>
                            {typeof onRemoveSelection === "function" && !disabled ? <span aria-hidden="true">x</span> : null}
                        </button>
                    ))}
                </div>
            ) : null}
            <div className={["forge-lookup-selection-input__control", hasEndButton ? "has-end-button" : ""].filter(Boolean).join(" ")}>
                <input
                    id={inputId}
                    type="text"
                    className="forge-lookup-selection-input__field"
                    value={inputValue}
                    placeholder={placeholder}
                    readOnly={!allowManualEntry}
                    disabled={disabled}
                    onClick={() => {
                        if (!allowManualEntry) {
                            openBrowse();
                        }
                    }}
                    onChange={(event) => onInputChange?.(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key !== "Enter") {
                            return;
                        }
                        event.preventDefault();
                        commitInput();
                    }}
                />
                {hasEndButton ? (
                    <button
                        type="button"
                        className="forge-lookup-selection-input__end-button"
                        onClick={handleEndButton}
                        disabled={disabled || (!canBrowse && !trimmedValue)}
                        aria-label={endButtonLabel}
                        title={endButtonLabel}
                    >
                        <Icon icon={canBrowse ? "chevron-down" : "plus"} size={14} />
                    </button>
                ) : null}
            </div>
        </div>
    );
}
