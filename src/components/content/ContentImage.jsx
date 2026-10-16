import React, {useEffect, useState} from 'react';
import {safeContentImage} from './contentModel.js';
export default function ContentImage({src, alt = '', className = ''}) {
    const url = safeContentImage(src);
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [url]);
    return url && !failed ? <img className={className} src={url} alt={alt} onError={() => setFailed(true)} loading="lazy"/>
        : <span className={`${className} is-placeholder`} aria-hidden="true"/>;
}
