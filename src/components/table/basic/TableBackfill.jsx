/* ------------------------------------------------------------------
 * TableBackfill - Renders blank rows to fill space if needed
 * ------------------------------------------------------------------ */
import React from "react";
import {Colors, Icon} from "@blueprintjs/core";
import SoftSkeleton from '../../SoftSkeleton.jsx';
import { formatDataSourceError } from "../../../utils/dataSourceError.js";

const TableBackfill = ({context, fixedRowHeight, rowCount, colSpan, collection}) => {
    if (rowCount <= 0) return null;
    const {signals} = context;
    const {control} = signals;
    const {loading, error} = control.value || {};
    const disabled = control.value?.inactive || false;
    const noData = collection?.length === 0;

    const errorMessage = formatDataSourceError(error);
    const rows = [];
    const stateClassName = error ? " is-error" : loading ? " is-loading" : " is-empty";
    for (let i = 0; i < rowCount; i++) {
        if (i === 0 && (noData || loading || error)) {
            rows.push(<tr key={`backfill-${i}`} className={`table-state-row${stateClassName}`}>
                <td colSpan={Math.max(1, colSpan)} className="empty-row table-state-cell">
                    <div className="table-state-message" role={error ? "alert" : "status"}>
                    {loading && !error ? (<SoftSkeleton lines={1} height={10} />) : null}
                    {noData && !disabled && !loading && !error ? (
                        <span style={{color: Colors.BLUE3}}><Icon icon="info-sign"></Icon> No data. </span>) : null}
                    {error ?
                        <span className="forge-table-error-message"><Icon icon="error"></Icon> {errorMessage} </span> : null}
                    </div>
                </td>
            </tr>);
        } else {
            rows.push(<tr key={`backfill-${i}`} className="table-state-spacer-row" aria-hidden="true">
                <td colSpan={Math.max(1, colSpan)}><span className={fixedRowHeight ? "forge-fixed-row-content" : "truncate-content"}>&nbsp;</span></td>
            </tr>);
        }
    }

    return <>{rows}</>;
};

export default TableBackfill;
