import React, {useEffect, useId, useRef, useState} from 'react';
import {
    Button,
    Callout,
    Dialog,
    DialogBody,
    DialogFooter,
    InputGroup,
    NonIdealState,
    Spinner,
} from '@blueprintjs/core';
import './LookupPickerDialog.css';

function firstDisplayValue(row, keys) {
    for (const key of keys) {
        const value = row?.[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
    }
    return '';
}

export function defaultLookupRowLabel(row) {
    return firstDisplayValue(row, ['label', 'name', 'title', 'display', 'value', 'id']) || 'Unnamed option';
}

export function defaultLookupRowKey(row, index) {
    return firstDisplayValue(row, ['value', 'id', 'label', 'name']) || String(index);
}

export function normalizeLookupPickerColumns(columns = []) {
    if (!Array.isArray(columns)) return [];
    return columns.map((column) => {
        if (typeof column === 'string') return {key: column, label: column};
        const key = String(column?.key || column?.field || column?.name || '').trim();
        if (!key) return null;
        return {...column, key, label: column.label || column.title || key};
    }).filter(Boolean);
}

export function normalizeLookupSearchResult(result) {
    if (Array.isArray(result)) return {rows: result, totalCount: result.length};
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    const rawTotal = result?.totalCount ?? result?.total ?? result?.count;
    const totalCount = Number.isFinite(Number(rawTotal)) ? Number(rawTotal) : rows.length;
    return {rows, totalCount};
}

export default function LookupPickerDialog({
    isOpen = false,
    title = 'Select an option',
    initialQuery = '',
    searchPlaceholder = 'Search options',
    disabled = false,
    columns = [],
    getRowKey = defaultLookupRowKey,
    getRowLabel = defaultLookupRowLabel,
    getRowDescription,
    loadRows,
    onSelect,
    onCancel,
    maxRenderedResults = 100,
    searchDelay = 180,
}) {
    const titleId = useId();
    const searchInputRef = useRef(null);
    const listRef = useRef(null);
    const [query, setQuery] = useState(String(initialQuery || ''));
    const [rows, setRows] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [retryVersion, setRetryVersion] = useState(0);
    const normalizedColumns = normalizeLookupPickerColumns(columns);
    const renderedLimit = Math.max(1, Number(maxRenderedResults) || 100);
    const visibleRows = rows.slice(0, renderedLimit);

    useEffect(() => {
        if (!isOpen) {
            setLoading(false);
            return;
        }
        setQuery(String(initialQuery || ''));
        setRows([]);
        setTotalCount(0);
        setError(null);
    }, [isOpen, initialQuery]);

    useEffect(() => {
        if (!isOpen || disabled) return undefined;
        const controller = new AbortController();
        const delay = query ? Math.max(0, Number(searchDelay) || 0) : 0;
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                if (typeof loadRows !== 'function') throw new Error('Lookup search is unavailable.');
                const result = normalizeLookupSearchResult(await loadRows({query, signal: controller.signal}));
                if (controller.signal.aborted) return;
                setRows(result.rows);
                setTotalCount(result.totalCount);
            } catch (nextError) {
                if (controller.signal.aborted || nextError?.name === 'AbortError') return;
                setRows([]);
                setTotalCount(0);
                setError(nextError instanceof Error ? nextError : new Error('Options could not be loaded.'));
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, delay);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [isOpen, disabled, query, retryVersion, searchDelay, loadRows]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const timer = setTimeout(() => searchInputRef.current?.focus?.(), 0);
        return () => clearTimeout(timer);
    }, [isOpen]);

    const cancel = () => onCancel?.();
    const select = (row) => {
        if (disabled || loading) return;
        onSelect?.(row);
    };
    const handleListKeyDown = (event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const choices = Array.from(listRef.current?.querySelectorAll?.('[data-forge-lookup-row]') || []);
        if (choices.length === 0) return;
        event.preventDefault();
        const index = choices.indexOf(document.activeElement);
        if (event.key === 'Home') choices[0].focus();
        else if (event.key === 'End') choices[choices.length - 1].focus();
        else if (event.key === 'ArrowDown') choices[Math.min(index + 1, choices.length - 1)].focus();
        else choices[Math.max(index - 1, 0)].focus();
    };

    return (
        <Dialog
            isOpen={isOpen}
            onClose={cancel}
            title={<span id={titleId}>{title}</span>}
            className="forge-lookup-picker"
            portalClassName="forge-lookup-picker-portal"
            autoFocus
            enforceFocus
            canEscapeKeyClose
            canOutsideClickClose
        >
            <DialogBody>
                <InputGroup
                    inputRef={searchInputRef}
                    type="search"
                    leftIcon="search"
                    value={query}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    disabled={disabled}
                    onChange={(event) => setQuery(event.target.value)}
                    rightElement={query ? (
                        <Button
                            icon="cross"
                            minimal
                            aria-label="Clear search"
                            disabled={disabled}
                            onClick={() => setQuery('')}
                        />
                    ) : undefined}
                />

                <div className="forge-lookup-picker__results" aria-live="polite" aria-busy={loading || undefined}>
                    {disabled ? (
                        <NonIdealState
                            icon="lock"
                            title="Selection unavailable"
                            description="This field cannot be changed right now."
                            layout="vertical"
                        />
                    ) : loading ? (
                        <div className="forge-lookup-picker__state" role="status">
                            <Spinner size={24} />
                            <span>Loading options…</span>
                        </div>
                    ) : error ? (
                        <Callout intent="danger" icon="error" title="Options could not be loaded" role="alert">
                            <p>{error.message || 'Try the search again.'}</p>
                            <Button icon="refresh" text="Try again" onClick={() => setRetryVersion((value) => value + 1)} />
                        </Callout>
                    ) : visibleRows.length === 0 ? (
                        <NonIdealState
                            icon="search"
                            title={query ? 'No matching options' : 'No options available'}
                            description={query ? 'Try a different search.' : 'There are no options to select.'}
                            layout="vertical"
                        />
                    ) : (
                        <>
                            {normalizedColumns.length > 0 ? (
                                <div
                                    className="forge-lookup-picker__columns"
                                    style={{gridTemplateColumns: `repeat(${normalizedColumns.length}, minmax(0, 1fr))`}}
                                    aria-hidden="true"
                                >
                                    {normalizedColumns.map((column) => <span key={column.key}>{column.label}</span>)}
                                </div>
                            ) : null}
                            <div ref={listRef} className="forge-lookup-picker__list" onKeyDown={handleListKeyDown}>
                                {visibleRows.map((row, index) => {
                                    const label = String(getRowLabel?.(row, index) || defaultLookupRowLabel(row));
                                    const description = getRowDescription?.(row, index);
                                    return (
                                        <button
                                            key={String(getRowKey?.(row, index) ?? defaultLookupRowKey(row, index))}
                                            type="button"
                                            className="forge-lookup-picker__row"
                                            data-forge-lookup-row=""
                                            disabled={disabled}
                                            aria-label={`Select ${label}`}
                                            onClick={() => select(row)}
                                        >
                                            {normalizedColumns.length > 0 ? (
                                                <span
                                                    className="forge-lookup-picker__cells"
                                                    style={{gridTemplateColumns: `repeat(${normalizedColumns.length}, minmax(0, 1fr))`}}
                                                >
                                                    {normalizedColumns.map((column) => (
                                                        <span key={column.key} title={String(row?.[column.key] ?? '')}>
                                                            {column.render ? column.render(row) : String(row?.[column.key] ?? '')}
                                                        </span>
                                                    ))}
                                                </span>
                                            ) : (
                                                <span className="forge-lookup-picker__row-copy">
                                                    <strong title={label}>{label}</strong>
                                                    {description ? <span>{description}</span> : null}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            {rows.length > renderedLimit || totalCount > visibleRows.length ? (
                                <p className="forge-lookup-picker__limit" role="status">
                                    Showing the first {visibleRows.length} of {Math.max(totalCount, rows.length)} results. Refine your search to narrow the list.
                                </p>
                            ) : null}
                        </>
                    )}
                </div>
            </DialogBody>
            <DialogFooter actions={<Button text="Cancel" onClick={cancel} />} />
        </Dialog>
    );
}
