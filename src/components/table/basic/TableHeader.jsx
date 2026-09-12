import React from "react";
import { Icon, Tooltip, Position } from "@blueprintjs/core";

const TableHeader = ({ context,
                       fillerWidth = 0, columns, tableTitle, sortConfig }) => {
    const { onSort, sortColumnId, sortDirection } = sortConfig;
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
        if (col.sortable) {
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
                <span className="forge-table-header-label">{displayName || name}</span>
                {col.sortable && (
                    <Icon
                        icon={
                            sortColumnId === col.id
                                ? sortDirection === "asc"
                                    ? "chevron-up"
                                    : "chevron-down"
                                : "double-caret-vertical"
                        }
                        intent="primary"
                        style={{ marginLeft: 4 }}
                    />
                )}
            </>
        );

        // If tooltip is provided, wrap the content in a Tooltip component
        if (col.tooltip) {
            return (
                <Tooltip content={col.tooltip} position={Position.TOP}>
                    <span className="forge-table-header-content">{content}</span>
                </Tooltip>
            );
        }

        return <span className="forge-table-header-content">{content}</span>;
    };

    return (
        <thead>
        {tableTitle && <caption>{tableTitle}</caption>}
        <tr>
            {columns.map((col) => {
                const { id, sortable, minWidth, align } = col;
//                console.log('col =>',col)
                const style = {
                    cursor: sortable ? "pointer" : "default",
                    textAlign: align || "left",
                    ...(minWidth && { width: minWidth }),
                    ...(String(col?.sticky || '').toLowerCase() === 'left' ? {left: col.stickyOffset || 0} : {}),
                };
                return (
                    <th key={id} className={`${String(col?.sticky || '').toLowerCase() === 'left' ? 'is-sticky-left' : ''}${col?.stickyEdge ? ' is-sticky-edge' : ''}`} style={style} title={[col.multiSelect ? 'Select all rows' : col.displayName || col.name, col.tooltip].filter(Boolean).join(' — ') || undefined} aria-sort={sortable ? sortColumnId === id ? sortDirection === 'asc' ? 'ascending' : 'descending' : 'none' : undefined}>
                        {sortable ? <button type="button" className="forge-table-header-sort" aria-label={`Sort by ${col.displayName || col.name || col.id}`} onClick={() => handleSort(col)}>{renderHeaderContent(col)}</button> : renderHeaderContent(col)}
                    </th>
                );
            })}
            {fillerWidth > 0 ? <th className="forge-table-trailing-space" aria-hidden="true" style={{width:fillerWidth}}/> : null}
        </tr>
        </thead>
    );
};

export default TableHeader;
