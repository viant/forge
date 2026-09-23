import React, {useEffect, useRef} from 'react';
import {registerControlTarget, unregisterControlTarget} from '../core/ui/registry.js';

// Reuse the rendered control's value contract for agent interaction. Callers
// retain responsibility for validation and the same guards used for clicks.
export default function SemanticControlTarget({context, item, onValueChange, children, ...props}) {
    const latest = useRef(onValueChange);
    latest.current = onValueChange;
    const element = useRef(null);
    const windowId = context?.identity?.windowId;
    const dataSourceRef = context?.identity?.dataSourceRef;
    useEffect(() => {
        const key = registerControlTarget({windowId, dataSourceRef, controlId: item.id,
            label: item.label, type: item.type, scope: item.scope}, {
            wrapper: element.current,
            resolver: ({wrapper}) => wrapper?.querySelector('button, input, select') || wrapper,
            setValue: (value) => latest.current(value),
        });
        return () => unregisterControlTarget(key);
    }, [windowId, dataSourceRef, item.id, item.label, item.type, item.scope]);
    return <span {...props} ref={element}>{children}</span>;
}
