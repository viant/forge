import React, {useState, useEffect} from "react";
import Basic from "./table/Basic.jsx";


const TablePanel = ({
                        container,
                        context,
                        children,
                        tableType = "html",
                    }) => {

    const [formattingRules, setFormattingRules] = useState([]);

    const {table, actions = {}} = container;
    const {columns, pagination = {}, settingsConfig = {}} = table;
    const [configuredColumns, setConfiguredColumns] = useState(
        columns.map((col) => ({
            ...col,
            visible: col.visible !== false,
            displayName: col.displayName || col.name,
        }))
    );
    const visibleColumns = configuredColumns.filter((col) => col.visible);




    // Function to get row style based on formatting rules
    const getRowStyle = (item) => {
        for (const rule of formattingRules) {
            if (evaluation(item, rule.criteria, configuredColumns)) {
                return {backgroundColor: rule.color};
            }
        }
        return {};
    };




    //

    //
    // Function to get row style based on formatting rules
    // const getRowStyle = (item) => {
    //     for (const rule of formattingRules) {
    //         if (evaluateCriteria(item, rule.criteria, configuredColumns)) {
    //             return {backgroundColor: rule.color};
    //         }
    //     }
    //     return {};
    // };

    const {sizing = {}} = container
    const stlye = {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column"
    }
    if (sizing.width) {
        stlye['width'] = sizing.width.size + sizing.width.unit
    }
    if (sizing.height) {
        stlye['height'] = sizing.height.size + sizing.height.unit
    }


    return (
        <div className="table-panel" style={stlye}>
            <div style={{flexGrow: 1, overflow: "auto"}}>
                <Basic
                    context={context}
                    container={container}
                    columns={visibleColumns}
                    pagination={pagination}
                >
                {children}
                </Basic>
            </div>


        </div>
    );
};

export default TablePanel;
