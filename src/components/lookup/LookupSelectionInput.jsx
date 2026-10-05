import React, { useId } from "react";
import { Button, Icon, Spinner } from "@blueprintjs/core";
import "./LookupSelectionInput.css";

function normalizeSelections(selections = []) {
    return Array.isArray(selections) ? selections : [];
}

export default function LookupSelectionInput({
    id,
    selections = [],
    inputValue = "",
    placeholder = "Enter value",
    browseLabel = "Browse",
    addLabel = "Add value",
    interactionMode,
    allowManualEntry = true,
    disabled = false,
    busy = false,
    error = "",
    onInputChange,
    onInputCommit,
    onBrowse,
    onRemoveSelection,
    className = "",
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    "aria-required": ariaRequired,
    "data-forge-widget": forgeWidget,
    "data-forge-control-id": forgeControlId,
    "data-forge-part": forgePart,
    "data-forge-field-track-control": fieldTrackControl,
}) {
    const generatedInputId = useId();
    const inputId = id || generatedInputId;
    const feedbackId = `${inputId}-lookup-status`;
    const feedback = String(error || (busy ? (interactionMode === "search" ? "Searching…" : "Opening options…") : "")).trim();
    const describedBy = [ariaDescribedBy, feedback ? feedbackId : ""].filter(Boolean).join(" ") || undefined;
    const normalizedSelections = normalizeSelections(selections);
    const canBrowse = typeof onBrowse === "function";
    const isSearch = interactionMode === "search";
    const canType = allowManualEntry && !disabled;
    const trimmedValue = String(inputValue || "").trim();
    const hasEndButton = canBrowse || (allowManualEntry && typeof onInputCommit === "function");
    const endButtonLabel = canBrowse ? browseLabel : addLabel;
    const isFieldTrackControl = fieldTrackControl === true || fieldTrackControl === "true";
    const useBrowseTrigger = isFieldTrackControl && !allowManualEntry && canBrowse;
    const selectedLabel = normalizedSelections
        .map((selection) => selection?.label || selection?.value)
        .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
        .map(String)
        .join(", ");
    const triggerValue = String(inputValue || selectedLabel || "").trim();

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
        <div className={["forge-lookup-selection-input", isSearch ? "forge-lookup-selection-input--search" : "", disabled ? "is-disabled" : "", (ariaInvalid || error) ? "is-invalid" : "", className].filter(Boolean).join(" ")}>
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
            {useBrowseTrigger ? (
                <Button
                    id={inputId}
                    type="button"
                    className={["forge-lookup-selection-input__trigger", triggerValue ? "" : "is-placeholder"].filter(Boolean).join(" ")}
                    aria-label={ariaLabel}
                    aria-labelledby={ariaLabelledBy}
                    aria-describedby={describedBy}
                    aria-invalid={ariaInvalid || !!error || undefined}
                    aria-required={ariaRequired}
                    aria-busy={busy || undefined}
                    aria-haspopup="dialog"
                    data-forge-widget={forgeWidget}
                    data-forge-control-id={forgeControlId}
                    data-forge-part={forgePart}
                    data-forge-field-track-control={fieldTrackControl}
                    fill
                    alignText="start"
                    ellipsizeText
                    text={triggerValue || placeholder}
                    rightIcon={busy ? undefined : "caret-down"}
                    loading={busy}
                    disabled={disabled || busy}
                    onClick={openBrowse}
                />
            ) : (
                <div className={["forge-lookup-selection-input__control", hasEndButton ? "has-end-button" : ""].filter(Boolean).join(" ")}>
                    <input
                        id={inputId}
                        type="text"
                        className="forge-lookup-selection-input__field"
                        aria-label={ariaLabel}
                        aria-labelledby={ariaLabelledBy}
                        aria-describedby={describedBy}
                        aria-invalid={ariaInvalid || !!error || undefined}
                        aria-required={ariaRequired}
                        aria-busy={busy || undefined}
                        data-forge-widget={forgeWidget}
                        data-forge-control-id={forgeControlId}
                        data-forge-part={forgePart}
                        value={inputValue}
                        placeholder={placeholder}
                        readOnly={!allowManualEntry}
                        disabled={disabled || (busy && !isSearch)}
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
                            disabled={disabled || busy || (!canBrowse && !trimmedValue)}
                            aria-label={endButtonLabel}
                            title={endButtonLabel}
                        >
                            {busy
                                ? <Spinner size={14} />
                                : <Icon icon={canBrowse ? (isSearch ? "search" : "chevron-down") : "plus"} size={14} />}
                        </button>
                    ) : null}
                </div>
            )}
            {feedback ? (
                <div
                    id={feedbackId}
                    className={["forge-lookup-selection-input__feedback", error ? "is-error" : ""].filter(Boolean).join(" ")}
                    role={error ? "alert" : "status"}
                >
                    {feedback}
                </div>
            ) : null}
        </div>
    );
}
