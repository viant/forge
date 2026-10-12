import React, {useEffect, useState} from 'react';

export default function EditableTextCell({value, label, readOnly = false, disabled = false, onChange, ...properties}) {
    const text = String(value ?? '');
    const [draft, setDraft] = useState(text);
    useEffect(() => setDraft(text), [text]);
    const change = (event) => {
        event.stopPropagation();
        if (readOnly || disabled) return;
        setDraft(event.target.value);
        onChange?.(event);
    };
    return <input {...properties} className={properties.className || "bp6-input bp6-small"} type="text" value={draft} aria-label={properties['aria-label'] || label}
        readOnly={readOnly} disabled={disabled} onChange={change}
        onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}/>;
}
