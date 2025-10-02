import React, {useEffect, useRef, useState} from "react";
import {Button, Icon, Checkbox} from "@blueprintjs/core";
import ProgressBar from "../../control/ProgressBar.jsx";
import {useCellEvents} from "../../../hooks/event.js";

const defaultCellProperties = (item) => {
    const properties = {};
    switch (item.type) {
        case "checkbox":
            properties["disabled"] = true;
            properties["inlined"] = "true";
            break;
        case "radio":
            properties["disabled"] = true;
            break;
        case "button":
            properties["icon"] = item.icon;
            properties["title"] = item.tooltip;
            properties["minimal"] = true;
            properties["small"] = true;
            break;
        default:
            break;
    }
    return properties;
};

const TableCell = ({
                       context,
                       cell,
                       cellSelection,
                       columnHandlers,
                       onRowClick,
                       enforceColumnSize = true,
                       onShowFullContent,
                   }) => {
    let {displayedText, value, align} = cell;
    const {handlers} = context;
    const {isSelected} = handlers.dataSource;
    const {col, row} = cellSelection;
    const {cellProperties = {}} = col;
    const cellEvents = useCellEvents({context, cellSelection, columnHandlers, onRowClick});
    const {events, stateEvents} = cellEvents;
    // Filter out any custom expression props (e.g., disabledExpr) so they don't leak to DOM
    const filteredProps = Object.fromEntries(
        Object.entries(cellProperties || {}).filter(([k]) => !/Expr$/.test(k))
    );
    const cellProps = {...defaultCellProperties(col), ...filteredProps, ...events};
    const {type} = col;
    let tdClass = "row";
    if (isSelected({...cellSelection})) {
        tdClass += " selected-cell";
    }

    // Get 'enforceColumnSize' from 'col' or default to true
    const enforceCellSize = col.enforceColumnSize !== undefined ? col.enforceColumnSize : enforceColumnSize;

    if (stateEvents.onValue) {
        value = stateEvents.onValue();
    }

    // Initialize refs and state for text truncation detection
    const textRef = useRef(null);
    const [showMoreButton, setShowMoreButton] = useState(false);

    useEffect(() => {
        if (textRef.current && enforceCellSize) {
            const isOverflowing = textRef.current.scrollWidth > textRef.current.clientWidth;
            setShowMoreButton(isOverflowing);
        } else {
            setShowMoreButton(false);
        }
    }, [displayedText, enforceCellSize]);

    const handleMoreClick = (event) => {
        event.stopPropagation();
        if (onShowFullContent) {
            onShowFullContent(displayedText);
        }
    };

    let cellContent = null;
    switch (type) {
        case "icon":
            cellContent = <Icon
                icon={value}
                size={10}
                small={true}
                onClick={handleMoreClick}
                style={{marginLeft: 4}}
            />
            break;
        case "button":
            cellContent = <Button {...cellProps} />;
            break;
        case "progress":
            cellContent = (
                <ProgressBar value={value} text={displayedText} {...cellProps} row={row}/>
            );
            break;
        case "checkbox":
            cellContent = <Checkbox checked={!!value} {...cellProps} />;
            break;
        default:
            if (enforceCellSize) {
                cellContent = (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "100%",
                        }}
                    >
                        <span ref={textRef} className="cell-content" style={{ width: "100%"}}>
                            {displayedText}
                        </span>
                        {showMoreButton && (
                            <Icon
                                icon="maximize"
                                size={10}
                                small={true}
                                onClick={handleMoreClick}
                                style={{marginLeft: 4}}
                            />
                        )}
                    </div>
                );
            } else {
                cellContent = displayedText;
            }
            break;
    }

    const tdStyle = {
        textAlign: align,
        ...(cell.maxWidth && {maxWidth: cell.maxWidth, minWidth: cell.minWidth}),
    };

    return (
        <td style={tdStyle} className={tdClass}>
            {cellContent}
        </td>
    );
};

export default TableCell;
