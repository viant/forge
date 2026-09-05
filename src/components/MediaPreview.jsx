import React, {useEffect, useState} from 'react';
import {normalizeMediaPreview} from './mediaPreview.js';

export default function MediaPreview({value, style = {}, className = ''}) {
    const preview = normalizeMediaPreview(value);
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [preview.kind, preview.url]);

    const frameStyle = {
        minHeight: 160,
        width: '100%',
        border: '1px solid #d8e1ea',
        borderRadius: 8,
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        ...style,
    };
    if (failed || preview.kind === 'unsupported') {
        return <div className={className} style={frameStyle} role="status">
            <span>{failed ? 'Preview failed to load.' : preview.message}</span>
            {preview.url ? <a href={preview.url} target="_blank" rel="noopener noreferrer" style={{marginLeft: 8}}>Open source</a> : null}
        </div>;
    }
    if (preview.kind === 'audio') {
        return <div className={className} style={frameStyle}><audio controls src={preview.url} onError={() => setFailed(true)}>Audio preview unavailable.</audio></div>;
    }
    if (preview.kind === 'video') {
        return <div className={className} style={frameStyle}><video controls src={preview.url} onError={() => setFailed(true)} style={{maxWidth: '100%', maxHeight: 360}}>Video preview unavailable.</video></div>;
    }
    return <div className={className} style={frameStyle}><img src={preview.url} alt={preview.alt} onError={() => setFailed(true)} style={{maxWidth: '100%', maxHeight: 360, objectFit: 'contain'}} /></div>;
}
