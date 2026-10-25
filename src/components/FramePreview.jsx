import React, {useState} from 'react';

// Generic URL-backed preview. The caller provides sources; no application routes
// or record identity rules are inferred here.
export default function FramePreview({preview, className, onClose}) {
    const [url, setURL] = useState(preview.url);
    const sources = preview.sources.some(source => source.url === preview.url)
        ? preview.sources : [{label:'Default',url:preview.url},...preview.sources];
    return <div className={['forge-frame-preview',className].filter(Boolean).join(' ')}>
        <div className="forge-frame-preview__body"><iframe title={preview.title} src={url} width={preview.width} height={preview.height}
            className="forge-frame-preview__frame"/></div>
        <div className="forge-frame-preview__toolbar">
            {onClose ? <button type="button" className="forge-frame-preview__button" onClick={onClose}>Cancel</button> : null}
            {sources.length > 1 ? <select className="forge-frame-preview__source" aria-label="Preview source" value={url}
                onChange={event=>setURL(event.target.value)}>
                {sources.map((source,index)=><option key={index} value={source.url}>{source.label}</option>)}
            </select> : null}
            <a className="forge-frame-preview__button forge-frame-preview__button--primary" href={url} target="_blank" rel="noopener noreferrer">Open</a>
        </div>
    </div>;
}
