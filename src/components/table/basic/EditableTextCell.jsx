import NativeControlTarget from '../../../runtime/NativeControlTarget.jsx';
import {validateWidgetControlValue} from '../../../core/ui/controlActions.js';
import React, {useEffect, useState} from 'react';

export default function EditableTextCell({value, label, readOnly = false, disabled = false, onChange, operationContext, operationItem, operationControlId, operationRow, operationState, ...properties}) {
    const text = String(value ?? '');
    const [draft, setDraft] = useState(text);
    useEffect(() => setDraft(text), [text]);
    const change = (event,strict=false) => {
        event.stopPropagation();
        if (readOnly || disabled) return;
        setDraft(event.target.value);
        return (strict && onChange?.operate?onChange.operate:onChange)?.(event);
    };
    return <NativeControlTarget context={operationContext} item={operationItem || {type:'text'}} controlId={operationControlId} row={operationRow} invokeState={operationState} readOnly={readOnly} disabled={disabled} value={draft}
        validate={value=>validateWidgetControlValue(value,{item:{type:'text'},props:properties})} actions={{setValue:({value})=>change({target:{value},stopPropagation(){}},true)}}><input {...properties} className={properties.className || "bp6-input bp6-small"} type="text" value={draft} aria-label={properties['aria-label'] || label}
        readOnly={readOnly} disabled={disabled} onChange={change}
        onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}/></NativeControlTarget>;
}
