import React, {useEffect, useState} from 'react';
import {normalizeMediaPreview} from './mediaPreview.js';
import './mediaPreview.css';

export default function MediaPreview({value, style, className = ''}) {
    const preview = normalizeMediaPreview(value);
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [preview.kind, preview.url, preview.identity]);

    if (preview.kind === 'imagecard') {
        const content=<>{preview.url && !failed ? <img src={preview.url} alt={preview.alt} onError={()=>setFailed(true)} className="forge-media-preview__card-image"/> : null}<div className="forge-media-preview__card-caption">{preview.caption}</div></>;
        return <div className={['forge-media-preview-card',className].filter(Boolean).join(' ')}><div className="forge-media-preview__card-title">{preview.title}</div><div className="forge-media-preview__card-description">{preview.description}</div>{preview.href?<a href={preview.href} target="_blank" rel="noopener noreferrer" className="forge-media-preview__card-link">{content}</a>:<div>{content}</div>}</div>;
    }
    const frameClass = ['forge-media-preview', className].filter(Boolean).join(' ');
    if (failed || preview.kind === 'unsupported') {
        return <div className={frameClass} style={style} role="status">
            <span>{failed ? 'Preview failed to load.' : preview.message}</span>
            {preview.url ? <a href={preview.url} target="_blank" rel="noopener noreferrer" className="forge-media-preview__source">Open source</a> : null}
        </div>;
    }
    if (preview.kind === 'audio') {
        return <div className={frameClass} style={style}><audio controls src={preview.url} onError={() => setFailed(true)}>Audio preview unavailable.</audio></div>;
    }
    if (preview.kind === 'video') {
        return <div className={frameClass} style={style}><video controls src={preview.url} onError={() => setFailed(true)} className="forge-media-preview__media">Video preview unavailable.</video></div>;
    }
    return <div className={frameClass} style={style}><img src={preview.url} alt={preview.alt} onError={() => setFailed(true)} className="forge-media-preview__media forge-media-preview__image" /></div>;
}
