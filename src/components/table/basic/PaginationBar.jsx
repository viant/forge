// src/components/table/basic/PaginationBar.jsx

import React, { useState } from "react";
import { Button } from "@blueprintjs/core";
import { useSignalEffect } from "@preact/signals-react";

const buttonProperties = {
    'pagination.first': { label: "First Page", icon: "double-chevron-left" },
    'pagination.previous': { label: "Previous Page", icon: "chevron-left" },
    'pagination.next': { label: "Next Page", icon: "chevron-right" },
    'pagination.last': { label: "Last Page", icon: "double-chevron-right" },
};

const PaginationBar = ({
                           context,
                           loading,
                           pagination,
                       }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const handlers = context.handlers;

    useSignalEffect(() => {
        const info = handlers.dataSource.getCollectionInfo();
        const newTotalPages = info?.pageCount || 1;
        if (totalPages !== newTotalPages) {
            setTotalPages(newTotalPages);
            // Optional: Reset current page if total pages change
            if (currentPage > newTotalPages) {
                setCurrentPage(newTotalPages);
            }
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
            />
        );
    };

    return (
        <div className="pagination-bar">
            <div>
                {renderActionButton("pagination.first", onFirstPage, loading || currentPage === 1)}
                {renderActionButton("pagination.previous", onPreviousPage, loading || currentPage === 1)}
                <span>
                    Page {currentPage} of {totalPages}&nbsp;
                </span>
                {renderActionButton("pagination.next", onNextPage, loading || currentPage >= totalPages)}
                {renderActionButton("pagination.last", onLastPage, loading || currentPage >= totalPages)}
            </div>
        </div>
    );
};

export default PaginationBar;
