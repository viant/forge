import React from 'react';

import TableToolbar from './table/basic/Toolbar.jsx';
import { resolveSelector } from '../utils/selector.js';

export function computeAbortVisibility({ chatCfg = {}, context = null }) {
    const spec = chatCfg?.abortVisible;
    if (!spec || !spec.selector) return false;
    try {
        const dsCtx = spec.dataSourceRef ? context?.Context?.(spec.dataSourceRef) : context;
        const formObj = dsCtx?.signals?.form?.value;
        const value = resolveSelector(formObj, spec.selector);
        const when = spec.when;
        if (when === undefined || when === null) return !!value;
        if (Array.isArray(when)) return when.some((entry) => entry === value);
        return value === when;
    } catch (_) {
        return false;
    }
}

export function renderChatToolbar({ effectiveToolbar, context }) {
    if (!effectiveToolbar) return null;

    if (React.isValidElement(effectiveToolbar)) {
        return effectiveToolbar;
    }

    if (typeof effectiveToolbar === 'function') {
        return effectiveToolbar();
    }

    if (typeof effectiveToolbar === 'object' && Array.isArray(effectiveToolbar.items)) {
        let toolbarContext = context;
        if (effectiveToolbar.dataSourceRef) {
            toolbarContext = context.Context(effectiveToolbar.dataSourceRef);
        }
        return React.createElement(TableToolbar, {
            context: toolbarContext,
            toolbarItems: effectiveToolbar.items,
        });
    }

    return null;
}
