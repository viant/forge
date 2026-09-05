import React from "react";
import TableCell from "./TableCell.jsx";
import {isRowSelectionDisabled} from '../rowSelection.js';

/* ------------------------------------------------------------------
 * TableRow - Renders a single row from preparedData[rowIndex]
 * ------------------------------------------------------------------ */

const TableRow = ({
                      context,
                      rowData,
                      rowStyle,
                      rowClassName,
                      rowSelection,
                      columns,
                      columnsHandlers,
                      onRowClick,
                      enforceColumnSize,
                      onShowFullContent,
                  }) => {

    const selectionColumn = columns.find((column) => column?.multiSelect === true);
    const rowSelectionDisabled = isRowSelectionDisabled(selectionColumn?.selectionDisabledWhen, rowSelection.row, context);

    const handleRowClick = (event) => {
        if (rowSelectionDisabled) return false;
        return onRowClick({ event, ...rowSelection });
    };

    const dataSource = context?.handlers?.dataSource || {};
    const isSelected = typeof dataSource.isSelected === "function"
        ? dataSource.isSelected
        : () => false;

    const selected = !!isSelected({ ...rowSelection });

    const cells = [];
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        const col = columns[colIndex];
        const cell = rowData[colIndex];
        const cellSelection = { ...rowSelection, colIndex, col };
        cells.push(
            <TableCell
                context={context}
                key={cell.id}
                cell={cell}
                rowStyle={rowStyle}
                rowClassName={rowClassName}
                cellSelection={cellSelection}
                isSelected={selected}
                columnHandlers={columnsHandlers[col.id]}
                onRowClick={onRowClick}
                enforceColumnSize={enforceColumnSize}
                onShowFullContent={onShowFullContent}
                rowSelectionDisabled={rowSelectionDisabled}
            />
        );
    }

    return (
        <tr
            onClick={handleRowClick}
            className={[selected ? "selected-row" : "row", rowClassName].filter(Boolean).join(" ")}
            style={rowStyle}
            aria-disabled={rowSelectionDisabled || undefined}
        >
            {cells}
        </tr>
    );
};

export default TableRow;
