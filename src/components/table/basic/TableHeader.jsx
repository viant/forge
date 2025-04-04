import React from "react";
import { Checkbox, Icon, Tooltip, Position } from "@blueprintjs/core";

const TableHeader = ({ context, columns, tableTitle, sortConfig }) => {
//    console.log('columns=>',columns)

    const { onSort, sortColumnId, sortDirection } = sortConfig;
    const { handlers, dataSource } = context;
    const {
        setAllSelection,
        resetSelection,
        getSelection,
        peekCollection,
    } = handlers.dataSource;
    const selectionMode = dataSource.selectionMode || "single";

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
                    <Checkbox
                        inline={true}
                        checked={selectedAll}
                        onChange={handleHeaderCheckboxClick}
                    />
                ) : null}
                {displayName || name}
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
                    <span>{content}</span>
                </Tooltip>
            );
        }

        return content;
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
                };
                return (
                    <th key={id} style={style} onClick={() => handleSort(col)}>
                        {renderHeaderContent(col)}
                    </th>
                );
            })}
        </tr>
        </thead>
    );
};

export default TableHeader;
