import NativeControlTarget from '../../../runtime/NativeControlTarget.jsx';
// src/components/table/basic/PaginationBar.jsx

import React, {useState} from "react";
import {Button, HTMLSelect} from "@blueprintjs/core";
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
                           disabled = false,
                           showBoundaryButtons = true,
                           pagingEnabled = true,
                           pageSize = 0,
                           pageSizeOptions = [],
                           children,
                       }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(null);
    const [recordCount, setRecordCount] = useState(null);
    const [hasMore, setHasMore] = useState(null);
    const [hasMoreExplicit, setHasMoreExplicit] = useState(false);
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
        setHasMoreExplicit(nextState.hasMoreExplicit === true);
        setCurrentPage(nextState.currentPage);
        setInitialLoading(nextState.initialLoading);
    });

    const onFirstPage = () => {
        setCurrentPage(1);
        return handlers.dataSource.setPage(1);
    };

    const onNextPage = () => {
        const newPage = currentPage + 1;
        setCurrentPage(newPage);
        return handlers.dataSource.setPage(newPage);
    };

    const onPreviousPage = () => {
        const newPage = currentPage - 1;
        setCurrentPage(newPage);
        return handlers.dataSource.setPage(newPage);
    };

    const onLastPage = () => {
        if (totalPages == null) {
            return;
        }
        setCurrentPage(totalPages);
        return handlers.dataSource.setPage(totalPages);
    };

    const renderActionButton = (actionKey, onClick, actionDisabled = false) => {
        const properties = buttonProperties[actionKey] || {};
        return (
            <NativeControlTarget context={context} item={{id:actionKey,type:'button',label:properties.label}} disabled={disabled||actionDisabled} actions={{click:onClick}}><Button
                {...properties}
                onClick={onClick}
                disabled={disabled || actionDisabled}
                minimal={true}
                small={true}
                aria-label={properties.label}
                title={actionKey === 'pagination.last' && totalPages == null ? 'Last page unavailable' : properties.label}
            /></NativeControlTarget>
        );
    };

    const busy = context?.signals?.control?.value?.loading === true;
    const canGoPrevious = pagingEnabled && !busy && !inactive && currentPage > 1;
    const canGoNext = pagingEnabled && !busy && canNavigateNext({inactive, initialLoading, currentPage, totalPages, recordCount, hasMore, hasMoreExplicit});
    const canGoLast = pagingEnabled && !busy && !inactive && (!hasMoreExplicit || hasMore === true) && totalPages != null && currentPage < totalPages;
    const statusLabel = paginationStatusLabel({initialLoading, currentPage, totalPages});
    const sizeOptions = Array.from(new Set((Array.isArray(pageSizeOptions) ? pageSizeOptions : [])
        .map(Number).filter(size => Number.isSafeInteger(size) && size > 0)));
    if (sizeOptions.length > 1 && Number.isSafeInteger(pageSize) && pageSize > 0 && !sizeOptions.includes(pageSize)) sizeOptions.unshift(pageSize);


    return (
        <div className="pagination-bar" aria-busy={initialLoading || undefined}>
            <div>
                {showBoundaryButtons ? renderActionButton("pagination.first", onFirstPage, !canGoPrevious) : null}
                {renderActionButton("pagination.previous", onPreviousPage, !canGoPrevious)}


                    <span className="forge-pagination-announcement" role="status" aria-live="polite">{pagingEnabled ? statusLabel : 'All loaded rows'}</span>
                    {children}
                    {pagingEnabled && sizeOptions.length > 1 ? (
                        <label style={{display: 'inline-flex', alignItems: 'center', gap: 6, marginInline: 8}}>
                            Rows per page
                            <NativeControlTarget context={context} item={{id:'pagination.pageSize',type:'select',label:'Rows per page'}} disabled={disabled||busy||inactive} value={pageSize} options={sizeOptions.map(value=>({value,label:String(value)}))} validate={value=>sizeOptions.includes(value)?null:'Page size unavailable'} actions={{setValue:({value})=>handlers.dataSource.setPageSize?.(value)}}><HTMLSelect aria-label="Rows per page" value={pageSize} disabled={disabled || busy || inactive}
                                onChange={event => handlers.dataSource.setPageSize?.(Number(event.target.value))}
                                options={sizeOptions.map(size => ({value: size, label: String(size)}))}/></NativeControlTarget>
                        </label>
                    ) : null}



                {renderActionButton("pagination.next", onNextPage, !canGoNext)}
                {showBoundaryButtons ? renderActionButton("pagination.last", onLastPage, !canGoLast) : null}
            </div>
        </div>
    );
};

export default PaginationBar;
