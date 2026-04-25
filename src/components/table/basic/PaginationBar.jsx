// src/components/table/basic/PaginationBar.jsx

import React, {useState} from "react";
import {Button} from "@blueprintjs/core";
import {useSignalEffect} from "@preact/signals-react";

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
        const isInactive = handlers.dataSource.isInactive();
        setInactive(isInactive);

        let newTotalPages = Number.isFinite(info?.pageCount) && info.pageCount > 0 ? info.pageCount : null;
        let totalCount = Number.isFinite(info?.totalCount) && info.totalCount >= 0 ? info.totalCount : null;
        if (isInactive) {
            newTotalPages = null;
            totalCount = null;
        }

        if (totalPages !== newTotalPages) {
            setTotalPages(newTotalPages);
            if (newTotalPages != null && currentPage > newTotalPages) {
                setCurrentPage(newTotalPages);
            }
        }
        setRecordCount(totalCount);

        if (info?.page && info.page !== currentPage) {
            setCurrentPage(info.page);
        } else if (currentPage < 1) {
            setCurrentPage(1);
        }
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
