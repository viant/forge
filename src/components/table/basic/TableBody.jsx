// src/components/table/basic/TableBody.jsx

import React from "react";
import TableBackfill from "./TableBackfill.jsx";
import TableRow from "./TableRow.jsx";

/* ------------------------------------------------------------------
 * TableBody - Renders the main <tbody> plus any backfill rows
 * ------------------------------------------------------------------ */
const TableBody = ({
                       context,
                       collection,
                       preparedData,
                       columns,
                       events,
                       columnsHandlers,
                       backfillCount,
                       loading,
                       error,
                       enforceColumnSize,
                       onShowFullContent,
                   }) => {

    if (loading || error) {
        return (
            <tbody>
            <TableBackfill
                context={context}
                rowCount={backfillCount}
                colSpan={columns.length}
                loading={loading}
                error={error}
                collection={collection}
            />
            </tbody>
        );
    }
    const rows = [];
    for (let rowIndex = 0; rowIndex < collection.length; rowIndex++) {
        const rowData = preparedData[rowIndex];
        const row = collection[rowIndex];
        const rowSelection = {rowIndex, row};
        rows.push(
            <TableRow
                context={context}
                key={rowIndex}
                rowData={rowData}
                rowSelection={rowSelection}
                columns={columns}
                columnsHandlers={columnsHandlers}
                onRowClick={events.onRowSelect.execute}
                enforceColumnSize={enforceColumnSize}
                onShowFullContent={onShowFullContent}
            />
        );
    }

    return (
        <tbody>
        {rows}
        <TableBackfill
            context={context}
            rowCount={backfillCount}
            colSpan={columns.length}
            loading={loading}
            collection={collection}
        />
        </tbody>
    );
};

export default TableBody;