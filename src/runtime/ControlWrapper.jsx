// Minimal ControlWrapper used by WidgetRenderer (Phase 1 – placeholder)
import React, { useEffect, useRef, useId } from 'react';
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

export default function ControlWrapper({ item, container, context, framework = 'core', disabled = false, readOnly = false, children }) {
    const generatedId = useId();
    const controlId = children?.props?.id || item?.id || generatedId;
    const helperId = `${generatedId}-help`;
    const helperText = item?.validationError || item?.helperText || item?.description;
    const bypassHelper = item?.wrapper === 'none' || (framework === 'blueprint' && item?.isStandalone);
    const hasHelper = bypassHelper ? !!item?.validationError : !!helperText;
    const child = React.isValidElement(children) ? React.cloneElement(children, {
        id: controlId,
        'aria-describedby': [children.props['aria-describedby'], hasHelper ? helperId : null].filter(Boolean).join(' ') || undefined,
    }) : children;

    const wrapperRef = useRef(null);
    const regKeyRef = useRef(null);

    const custom = getWrapper(framework);

    // ----- fallback simple wrapper ---------------------------------
    const columns = container?.layout?.columns || 1;
    const span = Math.min(item?.columnSpan || 1, columns);

    const style = {
        gridColumn: `span ${span}`,
        ...(item?.style || {}),
    };

    const inline = (item.labelPosition || container?.layout?.labelPosition) === 'left';
    const unavailable = disabled === true || readOnly === true;
    const unavailableTooltip = unavailable ? (item?.tooltip || item?.title || '') : '';
    const accessibilityProps = unavailableTooltip ? {
        title: unavailableTooltip,
        tabIndex: 0,
        'aria-label': `${item?.label || item?.id || 'Control'}. ${unavailableTooltip}`,
    } : {};

    const isLabelWidget =
        (item?.type && String(item.type).toLowerCase() === 'label') ||
        (item?.widget && String(item.widget).toLowerCase() === 'label');

    useEffect(() => {
        const windowId = context?.identity?.windowId;
        const dataSourceRef = context?.identity?.dataSourceRef;
        const controlId = item?.id;
        if (!windowId || !controlId || item?.wrapper === 'none') return;

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
    }, [context?.identity?.windowId, context?.identity?.dataSourceRef, item?.id, item?.wrapper]);

    // Keep hooks unconditional when metadata changes wrapper mode.
    if (item?.wrapper === 'none') {
        if (!item?.validationError) return child;
        return <div className="forge-control-validation-shell" data-forge-control-id={item?.id || undefined}>
            {child}
            <div className="forge-control-validation-message" id={helperId}
                data-forge-part="validation-message" role="alert">{item.validationError}</div>
        </div>;
    }

    if (custom) {
        return (
            <div
                style={style}
                className={["forge-control-wrapper", readOnly ? "is-readonly" : "", disabled ? "is-disabled" : "", item?.className].filter(Boolean).join(" ")}
                ref={wrapperRef}
                data-forge-control-id={item?.id || undefined}
                {...accessibilityProps}
            >
                {custom(item, container, child, context, {controlId, helperId, disabled, readOnly})}
            </div>
        );
    }

    return (
        <div
            style={style}
            className={["forge-control-wrapper", readOnly ? "is-readonly" : "", disabled ? "is-disabled" : "", item?.className].filter(Boolean).join(" ")}
            ref={wrapperRef}
            data-forge-control-id={item?.id || undefined}
            {...accessibilityProps}
        >
            {item?.label && !item.hideLabel && !isLabelWidget && (
                <label
                    data-forge-part="label"
                    htmlFor={controlId}
                    style={{ display: inline ? 'inline-block' : 'block', marginRight: inline ? 8 : 0 }}
                    title={item.tooltip || undefined}
                >
                    {item.label}
                </label>
            )}
            {child}
            {hasHelper && <div id={helperId} data-forge-part={item?.validationError ? 'validation-message' : 'helper-text'}
                role={item?.validationError ? 'alert' : undefined}>{helperText}</div>}
        </div>
    );
}
