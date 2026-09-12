// src/components/table/basic/TableBody.jsx

import React from "react";
import TableBackfill from "./TableBackfill.jsx";
import TableRow from "./TableRow.jsx";

/* ------------------------------------------------------------------
 * TableBody - Renders the main <tbody> plus any backfill rows
 * ------------------------------------------------------------------ */
const TableBody = ({
                       context,
                       fillerWidth = 0,
                       fixedRowHeight,
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
    const rowsCollection = Array.isArray(collection) ? collection : [];

    if (error || (loading && rowsCollection.length === 0)) {
        return (
            <tbody>
            <TableBackfill
                fixedRowHeight={fixedRowHeight}
                context={context}
                rowCount={backfillCount}
                colSpan={columns.length + (fillerWidth > 0 ? 1 : 0)}
                loading={loading}
                error={error}
                collection={collection}
            />
            </tbody>
        );
    }
    const rows = [];
    for (let rowIndex = 0; rowIndex < rowsCollection.length; rowIndex++) {
        const preparedRow = preparedData[rowIndex];
        const rowData = Array.isArray(preparedRow) ? preparedRow : preparedRow?.cells || [];
        const row = rowsCollection[rowIndex];
        const rowSelection = {rowIndex, row};
        rows.push(
            <TableRow
                fillerWidth={fillerWidth}
                fixedRowHeight={fixedRowHeight}
                context={context}
                key={rowIndex}
                rowData={rowData}
                rowStyle={preparedRow?.style}
                rowClassName={preparedRow?.className}
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
                fixedRowHeight={fixedRowHeight}
            context={context}
            rowCount={backfillCount}
            colSpan={columns.length + (fillerWidth > 0 ? 1 : 0)}
            loading={loading}
            collection={collection}
        />
        </tbody>
    );
};

export default TableBody;
