import UnifiedIcon from '../../Icon.jsx';
import React from "react";
import {Tooltip, Position} from '@blueprintjs/core';
import {useForgeTheme} from '../../ThemeBoundary.jsx';

const TableHeader = ({ context,
                       fillerWidth = 0, columns, tableTitle, sortConfig, onColumnReorder, columnReorderRegions = {} }) => {
    const isDesignSystem2 = useForgeTheme()?.themeId === 'design-system-2';
    const dragging = React.useRef(null);
    const [dropTarget, setDropTarget] = React.useState(null);
    const reorderable = column => isDesignSystem2 && !!onColumnReorder && !column.multiSelect && !!(column.displayName || column.name);
    const region = column => columnReorderRegions[column.id] ?? String(column.sticky || '').toLowerCase();
    const sameRegion = (left, right) => region(left) === region(right);
    const finishDrag = () => {dragging.current = null; setDropTarget(null);};
    const { onSort, sortColumnId, sortDirection, disabled = false } = sortConfig;
    const handlers = context?.handlers || {};
    const dataSourceConfig = context?.dataSource || {};
    const dataSourceHandlers = handlers.dataSource || {};
    const setAllSelection = typeof dataSourceHandlers.setAllSelection === "function"
        ? dataSourceHandlers.setAllSelection
        : () => {};
    const resetSelection = typeof dataSourceHandlers.resetSelection === "function"
        ? dataSourceHandlers.resetSelection
        : () => {};
    const getSelection = typeof dataSourceHandlers.getSelection === "function"
        ? dataSourceHandlers.getSelection
        : () => ({ selected: null, selection: [] });
    const peekCollection = typeof dataSourceHandlers.peekCollection === "function"
        ? dataSourceHandlers.peekCollection
        : () => [];
    const selectionMode = dataSourceConfig.selectionMode || "single";

    const selection = getSelection();
    const collection = peekCollection();

    const selectedAll = React.useMemo(() => {
        if (selectionMode !== "multi") {
            return false;
        }
        const selectedItems = selection.selection || [];
        const totalItems = collection || [];
        return selectedItems.length > 0 && selectedItems.length === totalItems.length;
    }, [selection, collection, selectionMode]);

    const handleSort = (col) => {
        if (col.sortable && !disabled) {
            onSort(col.id);
        }
    };

    const handleHeaderCheckboxClick = (event) => {
        const checked = event.target.checked;
        if (checked) {
            setAllSelection();
        } else {
            resetSelection();
        }
    };

    const renderHeaderContent = (col) => {
        const { multiSelect, displayName, name } = col;

        // Create the header content with checkbox if needed
        const content = (
            <>
                {multiSelect && selectionMode === "multi" ? (
                    <input
                        type="checkbox"
                        aria-label="Select all rows"
                        checked={selectedAll}
                        onChange={handleHeaderCheckboxClick}
                    />
                ) : null}
                {(!multiSelect || !isDesignSystem2) && <span className="forge-table-header-label">{isDesignSystem2 && !multiSelect && !(displayName || name) && col.icon ? <UnifiedIcon name={col.icon} aria-hidden="true"/> : displayName || name}</span>}
                {col.sortable && (!isDesignSystem2 || sortColumnId === col.id) && (
                    <UnifiedIcon
                        className="forge-table-sort-indicator"
                        name={
                            sortColumnId === col.id
                                ? sortDirection === "asc"
                                    ? "chevron-up"
                                    : "chevron-down"
                                : "double-caret-vertical"
                        }

                        style={{ marginLeft: 4 }}
                    />
                )}
            </>
        );

        // If tooltip is provided, wrap the content in a Tooltip component
        if (col.tooltip && !isDesignSystem2) {
            return (
                <Tooltip content={col.tooltip} position={Position.TOP}>
                    <span className="forge-table-header-content">{content}</span>
                </Tooltip>
            );
        }

        return <span className="forge-table-header-content" tabIndex={isDesignSystem2 && multiSelect ? -1 : reorderable(col) && !col.sortable && !disabled ? 0 : undefined}>{content}</span>;
    };

    return (
        <thead>
        {tableTitle && <caption>{tableTitle}</caption>}
        <tr>
            {columns.map((col) => {
                const { id, sortable, minWidth, align } = col;
//                console.log('col =>',col)
                const style = {
                    cursor: sortable && !disabled ? "pointer" : "default",
                    textAlign: align || "left",
                    ...(minWidth && { width: minWidth }),
                    ...(String(col?.sticky || '').toLowerCase() === 'left' ? {left: col.stickyOffset || 0} : {}),
                };
                const hint = [col.multiSelect ? 'Select all rows' : col.displayName || col.name, col.tooltip].filter(Boolean).join(' — ') || undefined;
                const control = sortable ? <button type="button" disabled={disabled} className="forge-table-header-sort" aria-label={`Sort by ${col.displayName || col.name || (isDesignSystem2 && col.tooltip) || col.id}`} onClick={() => handleSort(col)}>{renderHeaderContent(col)}</button> : renderHeaderContent(col);
                return (
                    <th key={id} data-column-id={id} data-forge-cell-kind={col.multiSelect ? 'selection' : col.type} className={`${String(col?.sticky || '').toLowerCase() === 'left' ? 'is-sticky-left' : ''}${col?.stickyEdge ? ' is-sticky-edge' : ''}${dropTarget === id ? ' is-column-drop-target' : ''}`} style={style} title={isDesignSystem2 ? undefined : hint} aria-sort={sortable ? sortColumnId === id ? sortDirection === 'asc' ? 'ascending' : 'descending' : 'none' : undefined}
                        aria-keyshortcuts={reorderable(col) && !disabled ? 'Alt+ArrowLeft Alt+ArrowRight' : undefined}
                        draggable={isDesignSystem2 && onColumnReorder ? reorderable(col) && !disabled : undefined}
                        onDragStart={event => {if (!reorderable(col) || disabled) return; dragging.current = col; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(id));}}
                        onDragOver={event => {if (!dragging.current || !reorderable(col) || !sameRegion(dragging.current, col)) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(id);}}
                        onDrop={event => {if (!dragging.current || !reorderable(col) || !sameRegion(dragging.current, col)) return; event.preventDefault(); if (dragging.current.id !== id) onColumnReorder(dragging.current.id, id); finishDrag();}}
                        onDragEnd={finishDrag}
                        onKeyDown={event => {if (!event.altKey || !['ArrowLeft','ArrowRight'].includes(event.key) || !reorderable(col) || disabled) return; event.preventDefault(); const group = columns.filter(entry => reorderable(entry) && sameRegion(entry, col)); const index = group.findIndex(entry => entry.id === id); const next = group[index + (event.key === 'ArrowLeft' ? -1 : 1)]; if (next) onColumnReorder(id, next.id);}}>
                        {control}
                    </th>
                );
            })}
            {fillerWidth > 0 ? <th className="forge-table-trailing-space" aria-hidden="true" style={{width:fillerWidth}}/> : null}
        </tr>
        </thead>
    );
};

export default TableHeader;
