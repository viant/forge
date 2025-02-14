/* ------------------------------------------------------------------
 * TableBackfill - Renders blank rows to fill space if needed
 * ------------------------------------------------------------------ */
import React from "react";
import {Spinner,  Colors, Icon} from "@blueprintjs/core";

const TableBackfill = ({ rowCount, colSpan, loading, error, collection }) => {
    if (rowCount <= 0) return null;


    const errorMessage = error?.toString()
    const rows = [];
    for (let i = 0; i < rowCount; i++) {
        if (i === 0) {
            // First row includes the cell with rowspan and the first column without span
            rows.push(
                <tr key={`backfill-${i}`}>
                    <td></td>
                    <td rowSpan={rowCount} colSpan={colSpan - 1} className="empty-row">
                        <span className="table-pending">
                            {loading ? <Spinner></Spinner>: " "}
                            {!loading && error ? <span style={{color:Colors.RED3}}><Icon icon="error" ></Icon> {errorMessage} </span>:null}
                            {!loading && !error && collection?.length === 0 ? <span style={{color: Colors.BLUE3}}><Icon icon="info-sign"></Icon> No data. </span>:null}
                        </span>
                    </td>
                </tr>
            );
        } else {
            // Remaining rows only include the first column
            rows.push(
                <tr key={`backfill-${i}`}>
                    <td><span className="truncate-content">&nbsp;</span></td>
                </tr>
            );
        }
    }

    return <>{rows}</>;
};

export default TableBackfill;
