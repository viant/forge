// Avatar.jsx – tiny circular avatar used in chat threads.

import React from 'react';

export default function Avatar({ role = 'assistant', size = 24 }) {
    const styles = {
        width: size,
        height: size,
        borderRadius: '50%',
        flex: 'none',
        marginRight: 6,
        marginTop: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        color: 'var(--forge-text, #263244)',
        fontWeight: 600,
        background:
            role === 'user'
                ? 'var(--forge-selected-background)'
                : role === 'assistant'
                    ? 'var(--forge-surface-subtle)'
                    : 'var(--forge-status-warning-background)',
    };

    const letter = role === 'assistant' ? 'A' : role === 'tool' ? 'T' : 'U';

    return <div style={styles}>{letter}</div>;
}
