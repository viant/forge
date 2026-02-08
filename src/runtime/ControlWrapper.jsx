// Minimal ControlWrapper used by WidgetRenderer (Phase 1 – placeholder)
import React, { useEffect, useRef } from 'react';
import { getWrapper } from './wrapperRegistry.js';
import { registerControlTarget, unregisterControlTarget } from '../core/ui/registry.js';

const findFocusable = (root) => {
    if (!root) return null;
    const selector = [
        'input:not([disabled])',
        'textarea:not([disabled])',
        'select:not([disabled])',
        'button:not([disabled])',
        'a[href]',
        '[tabindex]:not([tabindex="-1"])',
    ].join(', ');
    const node = root.querySelector(selector);
    if (!node) return null;
    if (node.offsetParent === null && node.getClientRects?.().length === 0) return null;
    return node;
};

export default function ControlWrapper({ item, container, context, framework = 'core', children }) {
    // Allow per-item override to skip wrapper
    if (item?.wrapper === 'none') {
        return children;
    }

    const wrapperRef = useRef(null);
    const regKeyRef = useRef(null);

    const custom = getWrapper(framework);
    if (custom) {
        return custom(item, container, children);
    }

    // ----- fallback simple wrapper ---------------------------------
    const columns = container?.layout?.columns || 1;
    const span = Math.min(item?.columnSpan || 1, columns);

    const style = {
        gridColumn: `span ${span}`,
        ...(item?.style || {}),
    };

    const inline = (item.labelPosition || container?.layout?.labelPosition) === 'left';

    const isLabelWidget =
        (item?.type && String(item.type).toLowerCase() === 'label') ||
        (item?.widget && String(item.widget).toLowerCase() === 'label');

    useEffect(() => {
        const windowId = context?.identity?.windowId;
        const dataSourceRef = context?.identity?.dataSourceRef;
        const controlId = item?.id;
        if (!windowId || !controlId) return;

        const wrapper = wrapperRef.current;
        const meta = {
            windowId,
            dataSourceRef,
            controlId,
            label: item?.label || null,
            type: item?.type || item?.widget || null,
            scope: item?.scope || null,
        };

        const key = registerControlTarget(meta, {
            wrapper,
            resolver: ({ wrapper }) => findFocusable(wrapper) || wrapper,
        });
        regKeyRef.current = key;

        return () => {
            if (regKeyRef.current) {
                unregisterControlTarget(regKeyRef.current);
                regKeyRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [context?.identity?.windowId, context?.identity?.dataSourceRef, item?.id]);

    return (
        <div style={style} className="forge-control-wrapper" ref={wrapperRef} data-forge-control-id={item?.id || undefined}>
            {item?.label && !item.hideLabel && !isLabelWidget && (
                <label
                    style={{ display: inline ? 'inline-block' : 'block', marginRight: inline ? 8 : 0 }}
                    title={item.tooltip || undefined}
                >
                    {item.label}
                </label>
            )}
            {children}
        </div>
    );
}
