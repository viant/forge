// src/components/table/basic/PaginationBar.jsx

import React, {useState} from "react";
import {Button} from "@blueprintjs/core";
import {useSignalEffect} from "@preact/signals-react";
import { resolvePaginationState } from "./PaginationState.js";

const buttonProperties = {
    'pagination.first': {label: "First Page", icon: "double-chevron-left"},
    'pagination.previous': {label: "Previous Page", icon: "chevron-left"},
    'pagination.next': {label: "Next Page", icon: "chevron-right"},
    'pagination.last': {label: "Last Page", icon: "double-chevron-right"},
};

const PaginationBar = ({
                           context,
                       }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(null);
    const [recordCount, setRecordCount] = useState(null);
    const [inactive, setInactive] = useState(false);
    const handlers = context.handlers;

    useSignalEffect(() => {
        const info = handlers.dataSource.getCollectionInfo();
        const inputPage = handlers.dataSource.getPage?.();
        const isInactive = handlers.dataSource.isInactive();
        const nextState = resolvePaginationState({
            info,
            inputPage,
            fallbackPage: currentPage,
            inactive: isInactive,
        });
        setInactive(isInactive);
        setTotalPages(nextState.totalPages);
        setRecordCount(nextState.recordCount);
        setCurrentPage(nextState.currentPage);
    });

    const onFirstPage = () => {
        setCurrentPage(1);
        handlers.dataSource.setPage(1);
    };

    const onNextPage = () => {
        setCurrentPage((prevPage) => {
            const newPage = prevPage + 1;
            handlers.dataSource.setPage(newPage);
            return newPage;
        });
    };

    const onPreviousPage = () => {
        setCurrentPage((prevPage) => {
            const newPage = prevPage - 1;
            handlers.dataSource.setPage(newPage);
            return newPage;
        });
    };

    const onLastPage = () => {
        if (totalPages == null) {
            return;
        }
        setCurrentPage(totalPages);
        handlers.dataSource.setPage(totalPages);
    };

    const renderActionButton = (actionKey, onClick, disabled = false) => {
        const properties = buttonProperties[actionKey] || {};
        return (
            <Button
                {...properties}
                onClick={onClick}
                disabled={disabled}
                minimal={true}
                small={true}
                aria-label={properties.label}
                title={properties.label}
            />
        );
    };

    const canGoPrevious = !inactive && currentPage > 1;
    const canGoNext = !inactive && (totalPages == null || currentPage < totalPages);
    const canGoLast = !inactive && totalPages != null && currentPage < totalPages;
    const pageLabel = totalPages != null ? `Page ${currentPage} of ${totalPages}` : `Page ${currentPage}`;
    const countLabel = recordCount != null ? ` (${recordCount})` : '';

    return (
        <div className="pagination-bar">
            <div>
                {renderActionButton("pagination.first", onFirstPage, !canGoPrevious)}
                {renderActionButton("pagination.previous", onPreviousPage, !canGoPrevious)}


                    <span>
                        {pageLabel}{countLabel}
                    </span>



                {renderActionButton("pagination.next", onNextPage, !canGoNext)}
                {renderActionButton("pagination.last", onLastPage, !canGoLast)}
            </div>
        </div>
    );
};

export default PaginationBar;
