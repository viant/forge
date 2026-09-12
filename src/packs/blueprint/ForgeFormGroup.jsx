import React from 'react';
import {Classes} from '@blueprintjs/core';

// Forge owns these public label/message targets while retaining Blueprint's
// form-group structure and classes. Blueprint FormGroup has no label props API.
export default function ForgeFormGroup({children, className, label, labelInfo, labelFor, inline,
    helperText, helperId, intent, style}) {
    return <div className={[Classes.FORM_GROUP, inline ? Classes.INLINE : '', Classes.intentClass(intent), className].filter(Boolean).join(' ')} style={style}>
        {label && <label className={Classes.LABEL} htmlFor={labelFor} data-forge-part="label">
            {label} <span className={Classes.TEXT_MUTED}>{labelInfo}</span>
        </label>}
        <div className={Classes.FORM_CONTENT}>
            {children}
            {helperText && <div className={Classes.FORM_HELPER_TEXT} id={helperId}
                data-forge-part={intent === 'danger' ? 'validation-message' : 'helper-text'}
                role={intent === 'danger' ? 'alert' : undefined}>{helperText}</div>}
        </div>
    </div>;
}
