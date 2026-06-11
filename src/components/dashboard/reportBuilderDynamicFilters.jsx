import React, { useState } from "react";
import { Icon } from "@blueprintjs/core";

import { LookupSelectionInput } from "./reportBuilderComponents.jsx";

function normalizeArray(value) {
    if (Array.isArray(value)) {
        return value.filter((entry) => entry !== undefined && entry !== null && entry !== "");
    }
    if (value === undefined || value === null || value === "") {
        return [];
    }
    return [value];
}

export function DynamicFilterGroup({
    group,
    rows,
    resolveLookup,
    onAddRow,
    onChangeFilter,
    onPick,
    onAddManualSelection,
    onRemoveSelection,
    onToggleEnabled,
    onRemoveRow,
}) {
    const filters = Array.isArray(group.filters) ? group.filters : [];
    const [manualDrafts, setManualDrafts] = useState({});

    const renderAddLineButton = () => (
        <button type="button" className="forge-report-builder-add-line-button" onClick={onAddRow}>
            <span className="forge-report-builder-add-line-button__icon">
                <Icon icon="add" size={13} />
            </span>
            <span>{group.addLabel || "Add line"}</span>
        </button>
    );

    return (
        <section className="forge-report-builder-dynamic-group">
            <div className="forge-report-builder-dynamic-group__header">
                <div>
                    <h4>{group.label || group.id}</h4>
                    {group.description ? <p>{group.description}</p> : null}
                </div>
                {renderAddLineButton()}
            </div>
            <div className="forge-report-builder-dynamic-group__rows">
                {(rows || []).length === 0 ? (
                    <div className="forge-report-builder-dynamic-group__empty">
                        No filters added yet.
                    </div>
                ) : null}
                {(rows || []).map((row) => {
                    const selectedFilter = filters.find((entry) => String(entry?.id || "").trim() === String(row.filterId || "").trim()) || filters[0] || null;
                    const lookup = resolveLookup?.(group, selectedFilter, row.id) || null;
                    const placeholder = selectedFilter?.placeholder || selectedFilter?.label || "Select value";
                    const dialogId = lookup?.dialogId || selectedFilter?.dialogId || selectedFilter?.lookup?.dialogId || "";
                    const enabled = row?.enabled !== false;
                    const allowManualEntry = selectedFilter?.manualEntry === true;
                    const manualDraft = manualDrafts[row.id] || "";
                    return (
                        <div key={row.id} className={[
                            "forge-report-builder-dynamic-row",
                            enabled ? "" : "is-disabled",
                        ].filter(Boolean).join(" ")} data-report-builder-row-id={row.id}>
                            <div className="forge-report-builder-dynamic-row__controls">
                                <select
                                    className="forge-report-builder-select forge-report-builder-select--targeting-key"
                                    value={row.filterId || ""}
                                    onChange={(event) => onChangeFilter(row.id, event.target.value)}
                                >
                                    {filters.map((entry) => (
                                        <option key={entry.id} value={entry.id}>
                                            {entry.label || entry.id}
                                        </option>
                                    ))}
                                </select>
                                <LookupSelectionInput
                                    selections={row.selections || []}
                                    inputValue={manualDraft}
                                    placeholder={allowManualEntry ? (selectedFilter?.manualPlaceholder || placeholder) : placeholder}
                                    browseLabel={placeholder}
                                    allowManualEntry={allowManualEntry}
                                    disabled={!enabled}
                                    onInputChange={(value) => setManualDrafts((current) => ({
                                        ...current,
                                        [row.id]: value,
                                    }))}
                                    onInputCommit={(value) => {
                                        const added = onAddManualSelection(row.id, selectedFilter, value);
                                        if (added) {
                                            setManualDrafts((current) => ({
                                                ...current,
                                                [row.id]: "",
                                            }));
                                        }
                                    }}
                                    onBrowse={dialogId ? () => onPick(row.id, selectedFilter, lookup) : null}
                                    onRemoveSelection={(index) => onRemoveSelection(row.id, index)}
                                />
                            </div>
                            <div className="forge-report-builder-dynamic-row__actions">
                                <button
                                    type="button"
                                    className={[
                                        "forge-report-builder-row-toggle",
                                        enabled ? "is-enabled" : "is-disabled",
                                    ].join(" ")}
                                    onClick={() => onToggleEnabled(row.id)}
                                    aria-pressed={enabled}
                                    title={enabled ? "Filter is active" : "Filter is off"}
                                >
                                    <Icon icon={enabled ? "eye-open" : "eye-off"} size={12} />
                                    <span>{enabled ? "On" : "Off"}</span>
                                </button>
                                <button
                                    type="button"
                                    className="forge-report-builder-remove-row"
                                    onClick={() => onRemoveRow(row.id)}
                                    aria-label="Remove filter row"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function resolveFamilyOptionKey(filterDef = {}, fallbackId = "") {
    const direct = String(filterDef?.targetingFeatureKey || "").trim();
    if (direct) {
        return direct;
    }
    const filterId = String(filterDef?.id || fallbackId || "").trim();
    return filterId.replace(/^(include|exclude)/i, "");
}

export function buildDynamicFamilyOptions(family = {}, dynamicFilterGroups = []) {
    const includeGroup = dynamicFilterGroups.find((entry) => String(entry?.id || "").trim() === "include");
    const excludeGroup = dynamicFilterGroups.find((entry) => String(entry?.id || "").trim() === "exclude");
    const includeById = new Map(normalizeArray(includeGroup?.filters).map((entry) => [String(entry?.id || "").trim(), entry]));
    const excludeById = new Map(normalizeArray(excludeGroup?.filters).map((entry) => [String(entry?.id || "").trim(), entry]));
    const optionMap = new Map();

    const register = (direction, filterId) => {
        const keyId = String(filterId || "").trim();
        if (!keyId) return;
        const filterDef = direction === "include" ? includeById.get(keyId) : excludeById.get(keyId);
        if (!filterDef) return;
        const optionKey = resolveFamilyOptionKey(filterDef, keyId);
        const existing = optionMap.get(optionKey) || {
            key: optionKey,
            label: String(filterDef?.label || optionKey).trim(),
            includeFilter: null,
            excludeFilter: null,
        };
        existing[direction === "include" ? "includeFilter" : "excludeFilter"] = filterDef;
        if (!existing.label) {
            existing.label = String(filterDef?.label || optionKey).trim();
        }
        optionMap.set(optionKey, existing);
    };

    normalizeArray(family.includeFilterIds).forEach((filterId) => register("include", filterId));
    normalizeArray(family.excludeFilterIds).forEach((filterId) => register("exclude", filterId));

    return Array.from(optionMap.values());
}

export function buildDynamicFamilyRows(state = {}, family = {}, dynamicFilterGroups = []) {
    const options = buildDynamicFamilyOptions(family, dynamicFilterGroups);
    const includeRows = normalizeArray(state?.dynamicGroups?.include).filter((row) => normalizeArray(family.includeFilterIds).includes(String(row?.filterId || "").trim()));
    const excludeRows = normalizeArray(state?.dynamicGroups?.exclude).filter((row) => normalizeArray(family.excludeFilterIds).includes(String(row?.filterId || "").trim()));
    const enrich = (rows, direction) => rows.map((row) => {
        const option = options.find((entry) => {
            const target = direction === "include" ? entry.includeFilter : entry.excludeFilter;
            return String(target?.id || "").trim() === String(row?.filterId || "").trim();
        }) || null;
        return {
            ...row,
            direction,
            optionKey: option?.key || "",
        };
    });
    return [...enrich(includeRows, "include"), ...enrich(excludeRows, "exclude")];
}

export function DynamicFamilyGroup({
    family,
    rows,
    options,
    resolveLookup,
    onAddRow,
    onChangeFilter,
    onChangeDirection,
    onPick,
    onAddManualSelection,
    onRemoveSelection,
    onToggleEnabled,
    onRemoveRow,
}) {
    const [manualDrafts, setManualDrafts] = useState({});

    return (
        <section className="forge-report-builder-dynamic-group forge-report-builder-dynamic-group--family">
            <div className="forge-report-builder-dynamic-group__header">
                <div>
                    <h4>{family.label}</h4>
                    {family.description ? <p>{family.description}</p> : null}
                </div>
                <button type="button" className="forge-report-builder-add-line-button" onClick={onAddRow}>
                    <span className="forge-report-builder-add-line-button__icon">
                        <Icon icon="add" size={13} />
                    </span>
                    <span>Add line</span>
                </button>
            </div>
            <div className="forge-report-builder-dynamic-group__rows">
                {rows.map((row) => {
                    const option = options.find((entry) => entry.key === row.optionKey) || options[0] || null;
                    const effectiveOptionKey = row.optionKey || option?.key || "";
                    const selectedFilter = row.direction === "exclude" ? option?.excludeFilter : option?.includeFilter;
                    const fallbackFilter = selectedFilter || option?.includeFilter || option?.excludeFilter || null;
                    const groupRef = { id: row.direction };
                    const lookup = resolveLookup?.(groupRef, fallbackFilter, row.id) || null;
                    const placeholder = fallbackFilter?.placeholder || fallbackFilter?.label || "Select value";
                    const dialogId = lookup?.dialogId || fallbackFilter?.dialogId || fallbackFilter?.lookup?.dialogId || "";
                    const enabled = row?.enabled !== false;
                    const allowManualEntry = fallbackFilter?.manualEntry === true;
                    const manualDraft = manualDrafts[row.id] || "";
                    const canInclude = !!option?.includeFilter;
                    const canExclude = !!option?.excludeFilter;
                    return (
                        <div key={row.id} className={["forge-report-builder-dynamic-row", enabled ? "" : "is-disabled"].filter(Boolean).join(" ")} data-report-builder-row-id={row.id}>
                            <div className="forge-report-builder-dynamic-row__controls">
                                <select
                                    className="forge-report-builder-select forge-report-builder-select--targeting-key"
                                    value={effectiveOptionKey}
                                    onChange={(event) => onChangeFilter(row.id, row.direction, event.target.value)}
                                >
                                    {options.map((entry) => (
                                        <option key={entry.key} value={entry.key}>{entry.label}</option>
                                    ))}
                                </select>
                                <div className="forge-report-builder-direction-toggle" role="radiogroup" aria-label="Filter direction">
                                    <button
                                        type="button"
                                        className={["forge-report-builder-direction-toggle__button", row.direction === "include" ? "is-active" : ""].filter(Boolean).join(" ")}
                                        disabled={!canInclude}
                                        aria-pressed={row.direction === "include"}
                                        onClick={() => onChangeDirection(row.id, row.direction, effectiveOptionKey, "include")}
                                    >
                                        Include
                                    </button>
                                    <button
                                        type="button"
                                        className={["forge-report-builder-direction-toggle__button", row.direction === "exclude" ? "is-active" : ""].filter(Boolean).join(" ")}
                                        disabled={!canExclude}
                                        aria-pressed={row.direction === "exclude"}
                                        onClick={() => onChangeDirection(row.id, row.direction, effectiveOptionKey, "exclude")}
                                    >
                                        Exclude
                                    </button>
                                </div>
                                <LookupSelectionInput
                                    selections={row.selections || []}
                                    inputValue={manualDraft}
                                    placeholder={allowManualEntry ? (fallbackFilter?.manualPlaceholder || placeholder) : placeholder}
                                    browseLabel={placeholder}
                                    allowManualEntry={allowManualEntry}
                                    disabled={!enabled}
                                    onInputChange={(value) => setManualDrafts((current) => ({ ...current, [row.id]: value }))}
                                    onInputCommit={(value) => {
                                        const added = onAddManualSelection(row.id, row.direction, fallbackFilter, value);
                                        if (added) {
                                            setManualDrafts((current) => ({ ...current, [row.id]: "" }));
                                        }
                                    }}
                                    onBrowse={dialogId ? () => onPick(row.id, row.direction, fallbackFilter, lookup) : null}
                                    onRemoveSelection={(index) => onRemoveSelection(row.id, row.direction, index)}
                                />
                            </div>
                            <div className="forge-report-builder-dynamic-row__actions">
                                <button
                                    type="button"
                                    className={["forge-report-builder-row-toggle", enabled ? "is-enabled" : "is-disabled"].join(" ")}
                                    onClick={() => onToggleEnabled(row.id, row.direction)}
                                    aria-pressed={enabled}
                                >
                                    <Icon icon={enabled ? "eye-open" : "eye-off"} size={12} />
                                    <span>{enabled ? "On" : "Off"}</span>
                                </button>
                                <button
                                    type="button"
                                    className="forge-report-builder-remove-row"
                                    onClick={() => onRemoveRow(row.id, row.direction)}
                                    aria-label="Remove filter row"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
