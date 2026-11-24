import UnifiedIcon from '../../Icon.jsx';
/* ------------------------------------------------------------------
 * TableBackfill - Renders blank rows to fill space if needed
 * ------------------------------------------------------------------ */
import React from "react";
import {Colors} from '@blueprintjs/core';
import SoftSkeleton from '../../SoftSkeleton.jsx';
import {useForgeTheme} from '../../ThemeBoundary.jsx';
import { formatDataSourceError } from "../../../utils/dataSourceError.js";

const TableBackfill = ({context, fixedRowHeight, rowCount, colSpan, collection, skeletonColumns}) => {
    const isDesignSystem2=useForgeTheme()?.themeId==='design-system-2';
    if (rowCount <= 0) return null;
    const {signals} = context;
    const {control} = signals;
    const {loading, error} = control.value || {};
    const disabled = control.value?.inactive || false;
    const noData = collection?.length === 0;

    const errorMessage = formatDataSourceError(error);
    const rows = [];
    if (loading && !error && skeletonColumns?.length) {
        return <>{Array.from({length: Math.max(1, rowCount)}, (_, rowIndex) =>
            <tr key={`skeleton-${rowIndex}`} className="table-skeleton-row" aria-hidden="true">
                {skeletonColumns.map((column, index) => <td key={column.id || index}>
                    <SoftSkeleton lines={1} height={10} style={{width: column.multiSelect || !column.name ? 18 : `${60 + ((rowIndex + index) % 4) * 10}%`, maxWidth: '100%'}}/>
                </td>)}
                {colSpan > skeletonColumns.length ? <td/> : null}
            </tr>)}</>;
    }
    const stateClassName = error ? " is-error" : loading ? " is-loading" : " is-empty";
    for (let i = 0; i < rowCount; i++) {
        if (i === 0 && (noData || loading || error)) {
            rows.push(<tr key={`backfill-${i}`} className={`table-state-row${stateClassName}`}>
                <td colSpan={Math.max(1, colSpan)} className="empty-row table-state-cell">
                    <div className="table-state-message" role={error ? "alert" : "status"}>
                    {loading && !error ? (<SoftSkeleton lines={1} height={10} />) : null}
                    {noData && !disabled && !loading && !error ? (
                        <span style={{color: Colors.BLUE3}}><UnifiedIcon name="info-sign"></UnifiedIcon> No data. </span>) : null}
                    {error ?
                        <span className="forge-table-error-message"><UnifiedIcon name={isDesignSystem2?'lucide:info':'error'}></UnifiedIcon> {errorMessage} </span> : null}
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
