import PaginationBar from "./PaginationBar.jsx";
import React from "react";


const TableFooter = ({
                         columnsLength,
                         pagination,
                         context,
                         loading,
                         events,
                         pagingEnabled
                     }) => {
    if (!pagination) return null;
    return (
        <tfoot>
        <tr>
            <td colSpan={columnsLength} align="center">
                {pagingEnabled ?
                <PaginationBar
                    context={context}
                    loading={loading}
                    pagination={pagination}
                    events={events}
                />:<hr/>}
            </td>
        </tr>
        </tfoot>
    );
};

export default TableFooter;