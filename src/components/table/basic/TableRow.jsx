import React from "react";
import TableCell from "./TableCell.jsx";

/* ------------------------------------------------------------------
 * TableRow - Renders a single row from preparedData[rowIndex]
 * ------------------------------------------------------------------ */

const TableRow = ({
                      context,
                      rowData,
                      rowSelection,
                      columns,
                      columnsHandlers,
                      onRowClick,
                      enforceColumnSize,
                      onShowFullContent,
                  }) => {

    const handleRowClick = (event) => {
        return onRowClick({ event, ...rowSelection });
    };

    const { handlers } = context;
    const { isSelected } = handlers.dataSource;

    const selected = isSelected({ ...rowSelection });

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
                cellSelection={cellSelection}
                isSelected={selected}
                columnHandlers={columnsHandlers[col.id]}
                onRowClick={onRowClick}
                enforceColumnSize={enforceColumnSize}
                onShowFullContent={onShowFullContent}
            />
        );
    }

    return (
        <tr
            onClick={handleRowClick}
            className={selected ? "selected-row" : "row"}
        >
            {cells}
        </tr>
    );
};

export default TableRow;
