// PrettyJson.jsx – viewer/editor for JS objects/values.

import React from 'react';
import { Pre, TextArea } from '@blueprintjs/core';

export default function PrettyJson({
    value,
    onChange,
    readOnly, // undefined means decide based on presence of onChange
    maxHeight = 240,
    style = {},
    ...rest
}) {
    if (value === undefined || value === null) value = {};

    if (readOnly === undefined) {
        readOnly = typeof onChange !== 'function';
    }

    const initialText = () => {
        if (typeof value === 'string') return value;
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    };

    const [text, setText] = React.useState(initialText);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        // Sync external value changes into textarea if they differ.
        const newText = initialText();
        if (newText !== text) setText(newText);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    if (readOnly || !onChange) {
        return (
            <Pre
                {...rest}
                style={{
                    maxHeight,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    ...style,
                }}
            >
                {text}
            </Pre>
        );
    }

    const commitIfValid = (txt) => {
        try {
            const parsed = txt.trim() === '' ? {} : JSON.parse(txt);
            onChange(parsed);
        } catch {}
    };

    const handleChange = (e) => {
        const txt = e.target.value;
        setText(txt);
        if (error) setError(null);
        commitIfValid(txt);
    };

    const handleBlur = () => {
        try {
            const parsed = text.trim() === '' ? {} : JSON.parse(text);
            setError(null);
            onChange(parsed);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
            <TextArea
                {...rest}
                fill
                value={text}
                onChange={handleChange}
                onBlur={handleBlur}
                intent={error ? 'danger' : 'none'}
                style={{ fontFamily: 'monospace', ...style, maxHeight }}
            />
            {error && (
                <span className="bp4-text-small bp4-text-danger">Invalid JSON</span>
            )}
        </div>
    );
}
