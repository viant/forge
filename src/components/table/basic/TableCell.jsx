import React, {useEffect, useRef, useState} from "react";
import {Button, Icon} from "@blueprintjs/core";
import ProgressBar from "../../control/ProgressBar.jsx";
import {useCellEvents} from "../../../hooks/event.js";
import {resolveTableLink} from "../../../utils/tableLink.js";
import { resolveLinkTarget } from "../../../utils/linkTarget.js";
import { evaluatePlainVisibleWhen } from "../../visibleWhen.js";
import {resolveTableCellBadge} from './tableCellBadge.js';
import {resolveTableStackedValue} from './tableStackedValue.js';

const defaultCellProperties = (item) => {
    const properties = {};
    switch (item.type) {
        case "checkbox":
            properties["disabled"] = true;
            properties["inlined"] = "true";
            break;
        case "radio":
            properties["disabled"] = true;
            break;
        case "button":
            properties["icon"] = item.icon;
            properties["title"] = item.tooltip;
            properties["minimal"] = true;
            properties["small"] = true;
            break;
        default:
            break;
    }
    return properties;
};

const TableCell = ({
                       context,
                       cell,
                       rowStyle,
                       rowClassName,
                       cellSelection,
                       columnHandlers,
                       onRowClick,
                       enforceColumnSize = true,
                       onShowFullContent,
                   }) => {
    let {displayedText, value, align} = cell;
    const dataSource = context?.handlers?.dataSource || {};
    const isSelected = typeof dataSource.isSelected === "function"
        ? dataSource.isSelected
        : () => false;
    const {col, row} = cellSelection;
    const {cellProperties = {}} = col;
    const cellEvents = useCellEvents({context, cellSelection, columnHandlers, onRowClick});
    const {events, stateEvents} = cellEvents;
    // Column-level visibility (per-row)
    if (stateEvents.onVisible) {
        try {
            const vis = stateEvents.onVisible();
            if (vis === false) {
                return <td className="row"/>;
            }
        } catch (_) { /* ignore */ }
    }
    // Filter out any custom expression props (e.g., disabledExpr) so they don't leak to DOM
    const filteredProps = Object.fromEntries(
        Object.entries(cellProperties || {}).filter(([k]) => !/Expr$/.test(k))
    );
    const cellProps = {...defaultCellProperties(col), ...filteredProps, ...events};
    // Allow dynamic readonly/disabled
    if (stateEvents.onReadonly) {
        try {
            if (stateEvents.onReadonly()) {
                cellProps.disabled = true;
            }
        } catch (_) { /* ignore */ }
    }
    const {type} = col;
    let tdClass = ["row", rowClassName, cell.className].filter(Boolean).join(" ");
    if (isSelected({...cellSelection})) {
        tdClass += " selected-cell";
    }

    // Get 'enforceColumnSize' from 'col' or default to true
    const enforceCellSize = col.enforceColumnSize !== undefined ? col.enforceColumnSize : enforceColumnSize;

    if (stateEvents.onValue) {
        const computed = stateEvents.onValue();
        if (computed !== undefined) {
            value = computed;
            displayedText = computed;
        }
    }

    // Initialize refs and state for text truncation detection
    const textRef = useRef(null);
    const [showMoreButton, setShowMoreButton] = useState(false);

    useEffect(() => {
        if (textRef.current && enforceCellSize) {
            const isOverflowing = textRef.current.scrollWidth > textRef.current.clientWidth;
            setShowMoreButton(isOverflowing);
        } else {
            setShowMoreButton(false);
        }
    }, [displayedText, enforceCellSize]);

    const handleMoreClick = (event) => {
        event.stopPropagation();
        if (onShowFullContent) {
            onShowFullContent(displayedText);
        }
    };

    let cellContent = null;
    switch (type) {
        case "icon":
            cellContent = <Icon
                icon={value}
                size={10}
                small={true}
                onClick={handleMoreClick}
                style={{marginLeft: 4}}
            />
            break;
        case "button":
            cellContent = <Button {...cellProps} />;
            break;
        case "progress":
            cellContent = (
                <ProgressBar value={value} text={displayedText} {...cellProps} row={row}/>
            );
            break;
        case "checkbox":
            if (col.multiSelect) {
                cellContent = (
                    <input
                        type="checkbox"
                        checked={isSelected({...cellSelection})}
                        onChange={(event) => {
                            event.stopPropagation();
                            context?.handlers?.dataSource?.toggleSelection?.(cellSelection);
                        }}
                        onClick={(event) => event.stopPropagation()}
                    />
                );
            } else {
                cellContent = (
                    <input
                        type="checkbox"
                        checked={value === true || value === 1 || String(value).toLowerCase() === 'true'}
                        disabled
                        readOnly
                        aria-label={col.label || col.name || col.id || 'Boolean value'}
                    />
                );
            }
            break;
        case "link": {
            const isZeroRelation = col?.format === 'relationCount'
                && /^0(?:\s|$)/.test(String(displayedText ?? '').trim());
            if (isZeroRelation) {
                cellContent = displayedText;
                break;
            }
            if (col?.link?.visibleWhen && !evaluatePlainVisibleWhen(col.link.visibleWhen, context)) {
                cellContent = displayedText;
                break;
            }
            const link = resolveTableLink({row, column: col, value})
                || resolveLinkTarget({ linkConfig: col?.link, row, value, context });
            if (!link) {
                cellContent = displayedText;
                break;
            }
            if (link.kind === 'window') {
                cellContent = (
                    <button
                        type="button"
                        title={link.title || displayedText || link.text}
                        className="forge-table-link"
                        style={{background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer'}}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            context?.handlers?.window?.openTarget?.({ target: link, context });
                        }}
                    >
                        {col?.format === 'relationCount' ? displayedText : link.text}
                    </button>
                );
                break;
            }
            if (link.kind === 'dialog') {
                cellContent = (
                    <button
                        type="button"
                        title={link.title || displayedText || link.text}
                        className="forge-table-link"
                        style={{background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer'}}
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            context?.handlers?.window?.openDialog?.({
                                context,
                                execution: {args: [link.dialogId, {awaitResult: link.awaitResult}]},
                                parameters: link.parameters,
                            });
                        }}
                    >
                        {col?.format === 'relationCount' ? displayedText : link.text}
                    </button>
                );
                break;
            }
            cellContent = (
                <a
                    href={link.href}
                    target={link.target}
                    rel={link.rel}
                    title={link.title || link.text}
                    className="forge-table-link"
                    onClick={(event) => event.stopPropagation()}
                >
                    {link.text}
                </a>
            );
            break;
        }
        case "stacked": {
            const stacked = resolveTableStackedValue(value);
            cellContent = (
                <div className="forge-table-stacked-summary">
                    {stacked.meta ? <div className="forge-table-stacked-summary__meta">{stacked.meta}</div> : null}
                    {stacked.title ? <div className="forge-table-stacked-summary__title">{stacked.title}</div> : null}
                    <div className="forge-table-stacked-summary__body">{stacked.body}</div>
                    {stacked.body && onShowFullContent ? (
                        <button
                            type="button"
                            className="forge-table-stacked-summary__expand"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onShowFullContent(stacked.body);
                            }}
                        >
                            {stacked.expandLabel}
                        </button>
                    ) : null}
                </div>
            );
            break;
        }
        default:
            if (enforceCellSize) {
                cellContent = (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "100%",
                        }}
                    >
                        <span ref={textRef} className="cell-content" style={{ width: "100%"}}>
                            {displayedText}
                        </span>
                        {showMoreButton && (
                            <button
                                type="button"
                                className="forge-table-cell-expand"
                                aria-label={`Show full ${col.name || col.label || col.id || 'cell'} content`}
                                title="Show full content"
                                onClick={handleMoreClick}
                                style={{
                                    display: 'inline-flex',
                                    flex: '0 0 auto',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginLeft: 4,
                                    minWidth: 24,
                                    minHeight: 24,
                                    padding: 4,
                                    border: 0,
                                    background: 'transparent',
                                    color: 'inherit',
                                    cursor: 'pointer',
                                }}
                            >
                                <Icon icon="maximize" size={10} small={true}/>
                            </button>
                        )}
                    </div>
                );
            } else {
                cellContent = displayedText;
            }
            break;
    }

    const resolvedBadge = resolveTableCellBadge(row, col.badge, context);
    if (resolvedBadge) {
        const badgeContent = (
            <span
                className={`forge-table-cell-badge is-${resolvedBadge.tone}${resolvedBadge.className ? ` ${resolvedBadge.className}` : ''}`}
                title={resolvedBadge.tooltip}
            >
                {resolvedBadge.icon === 'sparkles'
                    ? <span className="forge-sparkles-icon" aria-hidden="true">✦</span>
                    : (resolvedBadge.icon ? <Icon icon={resolvedBadge.icon} size={12}/> : null)}
                <span>{resolvedBadge.label}</span>
            </span>
        );
        cellContent = resolvedBadge.replaceValue ? badgeContent : (
            <div className="forge-table-cell-stack">
                <div className="forge-table-cell-stack__primary">{cellContent}</div>
                {badgeContent}
            </div>
        );
    }

    const tdStyle = {
        textAlign: align,
        ...(rowStyle || {}),
        ...(cell.style || {}),
        ...(cell.maxWidth && {maxWidth: cell.maxWidth, minWidth: cell.minWidth}),
        ...(String(col?.sticky || '').toLowerCase() === 'left' ? {left: col.stickyOffset || 0} : {}),
    };
    if (String(col?.sticky || '').toLowerCase() === 'left') tdClass += ' is-sticky-left';
    if (col?.stickyEdge) tdClass += ' is-sticky-edge';

    // Expose the raw value as a data attribute so CSS can style cells by content
    const dataAttrs = {};
    if (value != null && (type === undefined || type === 'text' || type === '')) {
        const raw = String(value).trim().toLowerCase().replace(/\s+/g, '-');
        if (raw) dataAttrs['data-value'] = raw;
    }
    if (col.id) dataAttrs['data-col'] = col.id;
    if (type) dataAttrs['data-type'] = type;
    if (col.link) dataAttrs['data-link-kind'] = col.link.kind || (col.link.href || col.link.hrefTemplate ? 'external' : 'configured');

    return (
        <td style={tdStyle} className={tdClass} {...dataAttrs}>
            {cellContent}
        </td>
    );
};

export default TableCell;
