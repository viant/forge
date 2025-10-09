// DataSourceFetcher.jsx – invisible helper that fetches DataSource collection
// and (optionally) selects the first record once data arrives.

import { useEffect } from "react";
import { useSignalEffect } from "@preact/signals-react";
import { getLogger } from "../utils/logger.js";

/**
 * Props:
 *  - context: Forge DataSource context.
 *  - filter:  optional filter object passed to fetchCollection.
 *  - selectFirst: boolean – when true, automatically selects rowIndex 0
 *                 after the first successful fetch (only if nothing is selected).
 */
export default function DataSourceFetcher({
    context,
    selectFirst = false,
    fetchData = true,
}) {
    const log = getLogger('ds');
    // 1. trigger collection fetch when component mounts (optional)
    useEffect(() => {
        if (fetchData) {
            try { log.debug('[fetcher] fetch on mount', { ds: context?.identity?.dataSourceRef }); } catch(_) {}
            const collection = context?.handlers?.dataSource?.fetchCollection?.();
        } else {
            try { log.debug('[fetcher] fetch disabled', { ds: context?.identity?.dataSourceRef }); } catch(_) {}
        }
    }, [context,  fetchData]);

    // 2. once collection has items, optionally set selection to first row
    useSignalEffect(() => {
        if (!selectFirst) return;
        if (!context?.signals?.collection) return;

        const items = context.signals.collection.value || [];
        if (items.length === 0) return;

        const selSignal = context.signals.selection;
        const currentRow = selSignal?.peek()?.rowIndex ?? -1;
        if (currentRow >= 0) return; // already selected

        try { log.debug('[fetcher] auto-select first row', { ds: context?.identity?.dataSourceRef }); } catch(_) {}
        context.handlers?.dataSource?.setSelection?.({ args: { rowIndex: 0 } });
    });

    return null; // renders nothing
}
