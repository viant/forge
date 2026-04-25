import PaginationBar from "./PaginationBar.jsx";
import React from "react";


const TableFooter = ({
                         columnsLength,
                         context,
                         events,
                         pagingEnabled
                     }) => {
    if (!pagingEnabled) return null;
    return (
        <tfoot>
        <tr>
            <td colSpan={columnsLength} align="center">
                <PaginationBar
                    context={context}
                    events={events}
                />
            </td>
        </tr>
        </tfoot>
    );
};

export default TableFooter;
