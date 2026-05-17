// src/components/WindowLayout.jsx
import React from 'react';
import LayoutRenderer from './LayoutRenderer';

export function resolveWindowLayoutContext(context) {
    if (context?.signals) {
        return context;
    }
    const defaultRef = String(context?.identity?.dataSourceRef || '').trim();
    if (!defaultRef || typeof context?.Context !== 'function') {
        return context;
    }
    return context.Context(defaultRef);
}

const WindowLayout = ({
                          title,
                          context,
                          onClose,
                          isInTab = false,
                          fillParent = true,
                      }) => {
    const renderContext = resolveWindowLayoutContext(context);
    const {view} = renderContext;
    if (!view) {
        return <div>No view defined.</div>;
    }
    const {content} = view;
    if (!content) {
        return <div>No content defined in view.</div>;
    }

    const style = {
        flex: fillParent ? 1 : '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        padding: '0',
        height: fillParent ? '100%' : 'auto',
        width: '100%',
        minHeight: fillParent ? 0 : 'max-content',
        minWidth: 0,
        overflow: fillParent ? 'hidden' : 'visible',
    };
    return (
        <div

            className="window-layout"
            style={style}
        >
            <LayoutRenderer
                context={renderContext}
                container={content}
            />
        </div>
    );
};

export default WindowLayout;
