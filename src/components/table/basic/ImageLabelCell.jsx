import React, {useState} from 'react';

// Neutral table value: {src, label}. A string value is an image URL.
// Labels remain usable when a provider omits an image or its URL fails.
export default function ImageLabelCell({value, emptyText = '—'}) {
    const src = typeof value === 'string' ? value : value?.src;
    const label = typeof value === 'object' && value ? String(value.label ?? '') : '';
    const [failedSource, setFailedSource] = useState(null);
    const usableSource = typeof src === 'string' && src.trim() && failedSource !== src;
    return <span className="forge-table-image-label">
        {usableSource ? <img src={src} alt={label ? '' : 'Image'} loading="lazy" onError={() => setFailedSource(src)}/> : null}
        {label ? <span className="forge-table-image-label__text">{label}</span> : !usableSource ? <span>{emptyText}</span> : null}
    </span>;
}
