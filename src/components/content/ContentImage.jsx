import React, {useEffect, useState} from 'react';
import {safeContentImage} from './contentModel.js';
export default function ContentImage({src, fallbackSrc, alt = '', className = '', style}) {
    const primary = safeContentImage(src), fallback = safeContentImage(fallbackSrc);
    const [failed, setFailed] = useState([]);
    useEffect(() => setFailed([]), [primary, fallback]);
    const url = [primary, fallback].find(candidate => candidate && !failed.includes(candidate));
    return url ? <img className={className} style={style} src={url} alt={alt} onError={() => setFailed(previous => [...previous, url])} loading="lazy"/>
        : <span className={`${className} is-placeholder`} aria-hidden="true"/>;
}
