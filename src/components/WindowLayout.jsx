// src/components/WindowLayout.jsx
import React from 'react';
import LayoutRenderer from './LayoutRenderer';

const WindowLayout = ({
                          title,
                          context,
                          onClose,
                          isInTab = false,
                      }) => {
    const {view} = context;
    if (!view) {
        return <div>No view defined.</div>;
    }
    const {content} = view;
    if (!content) {
        return <div>No content defined in view.</div>;
    }

    const style = {flex: 1, display: 'flex', flexDirection: 'column', padding: '4px', minHeight: '80vh', minWidth: '60vw'};
    return (
        <div

            className="window-layout"
            style={style}
        >
            <LayoutRenderer
                context={context}
                container={content}
            />
        </div>
    );
};

export default WindowLayout;
