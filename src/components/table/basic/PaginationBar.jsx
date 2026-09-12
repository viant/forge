// src/components/table/basic/PaginationBar.jsx

import React, {useState} from "react";
import {Button} from "@blueprintjs/core";
import {useSignalEffect} from "@preact/signals-react";
import {canNavigateNext, paginationStatusLabel, resolvePaginationState} from "./PaginationState.js";

const buttonProperties = {
    'pagination.first': {label: "First Page", icon: "double-chevron-left"},
    'pagination.previous': {label: "Previous Page", icon: "chevron-left"},
    'pagination.next': {label: "Next Page", icon: "chevron-right"},
    'pagination.last': {label: "Last Page", icon: "double-chevron-right"},
};

const PaginationBar = ({
                           context,
                           showBoundaryButtons = true,
                           pagingEnabled = true,
                           children,
                       }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(null);
    const [recordCount, setRecordCount] = useState(null);
    const [hasMore, setHasMore] = useState(null);
    const [inactive, setInactive] = useState(false);
    const [initialLoading, setInitialLoading] = useState(false);
    const handlers = context.handlers;

    useSignalEffect(() => {
        const info = handlers.dataSource.getCollectionInfo();
        const inputPage = handlers.dataSource.getPage?.();
        const isInactive = handlers.dataSource.isInactive();
        const control = context?.signals?.control?.value || {};
        const collection = context?.signals?.collection?.value || [];
        const nextState = resolvePaginationState({
            info,
            inputPage,
            fallbackPage: currentPage,
            inactive: isInactive,
            loading: control.loading === true,
            loadedRowCount: Array.isArray(collection) ? collection.length : 0,
        });
        setInactive(isInactive);
        setTotalPages(nextState.totalPages);
        setRecordCount(nextState.recordCount);
        setHasMore(nextState.hasMore);
        setCurrentPage(nextState.currentPage);
        setInitialLoading(nextState.initialLoading);
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
                title={actionKey === 'pagination.last' && totalPages == null ? 'Last page unavailable' : properties.label}
            />
        );
    };

    const busy = context?.signals?.control?.value?.loading === true;
    const canGoPrevious = pagingEnabled && !busy && !inactive && currentPage > 1;
    const canGoNext = pagingEnabled && !busy && canNavigateNext({inactive, initialLoading, currentPage, totalPages, recordCount, hasMore});
    const canGoLast = pagingEnabled && !busy && !inactive && totalPages != null && currentPage < totalPages;
    const statusLabel = paginationStatusLabel({initialLoading, currentPage, totalPages});

    return (
        <div className="pagination-bar" aria-busy={initialLoading || undefined}>
            <div>
                {showBoundaryButtons ? renderActionButton("pagination.first", onFirstPage, !canGoPrevious) : null}
                {renderActionButton("pagination.previous", onPreviousPage, !canGoPrevious)}


                    <span className="forge-pagination-announcement" role="status" aria-live="polite">{pagingEnabled ? statusLabel : 'All loaded rows'}</span>
                    {children}



                {renderActionButton("pagination.next", onNextPage, !canGoNext)}
                {showBoundaryButtons ? renderActionButton("pagination.last", onLastPage, !canGoLast) : null}
            </div>
        </div>
    );
};

export default PaginationBar;
