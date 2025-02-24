/* ------------------------------------------------------------------
 * TableBackfill - Renders blank rows to fill space if needed
 * ------------------------------------------------------------------ */
import React from "react";
import {Spinner, Colors, Icon} from "@blueprintjs/core";

const TableBackfill = ({context, rowCount, colSpan, collection}) => {
    if (rowCount <= 0) return null;
    const {signals} = context;
    const {control} = signals;
    const {loading, error} = control.value || {};
    const disabled = control.value?.inactive || false;
    const noData = collection?.length === 0;

    const errorMessage = error?.toString()
    const rows = [];
    for (let i = 0; i < rowCount; i++) {
        if (i === 0) {
            // First row includes the cell with rowspan and the first column without span
            rows.push(<tr key={`backfill-${i}`}>
                <td></td>
                <td rowSpan={rowCount - 1} colSpan={colSpan - 1} className="empty-row">
                    {loading && !error ? (<span className="table-pending"><Spinner></Spinner></span>) : null}
                    {noData && !disabled && !loading ? (
                        <span style={{color: Colors.BLUE3}}><Icon icon="info-sign"></Icon> No data. </span>) : null}
                    {error ?
                        <span style={{color: Colors.RED3}}><Icon icon="error"></Icon> {errorMessage} </span> : null}
                </td>
            </tr>);
        } else {
            // Remaining rows only include the first column
            rows.push(<tr key={`backfill-${i}`}>
                <td><span className="truncate-content">&nbsp;</span></td>
            </tr>);
        }
    }

    return <>{rows}</>;
};

export default TableBackfill;
