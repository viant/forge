// Minimal ControlWrapper used by WidgetRenderer (Phase 1 – placeholder)
import React from 'react';
import { getWrapper } from './wrapperRegistry.js';

export default function ControlWrapper({ item, container, framework = 'core', children }) {
    // Allow per-item override to skip wrapper
    if (item?.wrapper === 'none') {
        return children;
    }

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

    return (
        <div style={style} className="forge-control-wrapper">
            {item?.label && !item.hideLabel && (
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
