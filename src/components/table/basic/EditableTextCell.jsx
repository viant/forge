import NativeControlTarget from '../../../runtime/NativeControlTarget.jsx';
import {validateWidgetControlValue} from '../../../core/ui/controlActions.js';
import React, {useEffect, useId, useState} from 'react';
import {useForgeTheme} from '../../ThemeBoundary.jsx';
import {getWidgetEntry} from '../../../runtime/widgetRegistry.jsx';
import ControlWrapper from '../../../runtime/ControlWrapper.jsx';
import {editableCellError, editableCellKind} from './editableCellValue.js';
import {Tooltip} from '@blueprintjs/core';
import {formatTableNumber} from './tableNumericFormat.js';
import {resolveTableLink} from '../../../utils/tableLink.js';
import {renderTableLink} from './renderTableLink.jsx';
import Button from '../../Button.jsx';

export default function EditableTextCell({value, label, readOnly = false, disabled = false, onChange, operationContext, operationItem, operationControlId, operationRow, operationState, ...properties}) {
    const isDesignSystem2 = useForgeTheme()?.themeId === 'design-system-2';
    const kind = isDesignSystem2 ? editableCellKind(properties) : 'text';
    const text = kind === 'number' ? (value ?? (properties.nullable ? null : '')) : String(value ?? '');
    const generatedId = useId();
    const [draft, setDraft] = useState(text);
    const [editing, setEditing] = useState(false);
    useEffect(() => setDraft(text), [text]);
    const change = (event,strict=false) => {
        event.stopPropagation();
        if (readOnly || disabled) return;
        if (isDesignSystem2 && !strict) setEditing(true);
        setDraft(event.target.value);
        return (strict && onChange?.operate?onChange.operate:onChange)?.(event);
    };
    const keyDown = event => {
            // Let the existing Blueprint modality owner observe native Tab
            // navigation in DS2. Editing keys remain isolated from the table.
            if (!isDesignSystem2 || event.key !== 'Tab') event.stopPropagation();
    };
    let field;
    if (isDesignSystem2) {
        const {type, validationError, ...fieldProperties} = properties;
        const {factory: Field, defaults, framework} = getWidgetEntry(kind === 'number' ? 'number' : 'text');
        const error = editing || properties['data-edit-state'] === 'pending' || validationError ? validationError || editableCellError(draft, properties) : null;
        const link = operationItem?.link ? resolveTableLink({row:operationRow, column:operationItem, value:draft, context:operationContext}) : null;
        const id = operationControlId || generatedId;
        const errorId = `${id}-validation-error`;
        const renderedValue = kind === 'number' && !editing && !error && typeof draft === 'number' && operationItem?.numericFormat
            ? formatTableNumber(draft, operationItem.numericFormat) : draft;
        const update = value => change({target: {value}, stopPropagation() {}});
        // The native field layout stays fixed; its error is an owned floating hint.
        // The surrounding NativeControlTarget remains the sole row-action owner.
        field = <><Tooltip minimal popoverClassName="forge-table-cell-error" intent="danger" position="bottom-left" targetTagName="div"
            isOpen={!!error && editing && !readOnly && !disabled} content={<span aria-hidden="true">{error}</span>}>
            <ControlWrapper item={{id, type: kind, wrapper: 'control-only'}} widgetKey={kind} framework={framework} readOnly={readOnly} disabled={disabled}>
            <Field {...defaults} {...fieldProperties} id={id} {...(kind === 'number' ? {asyncControl: true, onValueChange: update} : {type: type || 'text', onChange: update})}
                value={renderedValue} autoFocus={editing} aria-label={properties['aria-label'] || label} aria-invalid={error ? true : undefined} aria-errormessage={error ? errorId : undefined}
                aria-describedby={[fieldProperties['aria-describedby'], error ? errorId : ''].filter(Boolean).join(' ') || undefined}
                onFocus={event=>{setEditing(true);properties.onFocus?.(event);}} onBlur={event=>{setEditing(false);properties.onBlur?.(event);}}
                readOnly={readOnly} disabled={disabled} onClick={event=>event.stopPropagation()} onKeyDown={keyDown}/>
            </ControlWrapper>
        </Tooltip>{error && <span id={errorId} className="bp6-visually-hidden" role="alert">{error}</span>}</>;
        if (!editing && !error) field = <div className="forge-table-cell-edit" data-forge-value-type={kind === 'number' ? 'number' : undefined} data-edit-state={properties['data-edit-state']} aria-description={properties['aria-description']}>
            {link && !disabled ? renderTableLink({link,context:operationContext,text:String(draft ?? ''),showTitle:false}) : <span data-forge-part="cell-value">{renderedValue ?? ''}</span>}
            {!readOnly && !disabled && <Button variant="ghost" size="compact" icon="lucide:pencil" hideLabel aria-label={`Edit ${properties['aria-label'] || label}`} onClick={event=>{event.stopPropagation();setEditing(true);}}/>}
        </div>;
    } else {
        field = <input {...properties} className={properties.className || "bp6-input bp6-small"} type="text" value={draft} aria-label={properties['aria-label'] || label}
            readOnly={readOnly} disabled={disabled} onChange={change} onClick={event=>event.stopPropagation()} onKeyDown={keyDown}/>;
    }
    return <NativeControlTarget context={operationContext} item={operationItem || {type:'text'}} controlId={operationControlId} row={operationRow} invokeState={operationState} readOnly={readOnly} disabled={disabled} value={draft}
        validate={value=>isDesignSystem2 ? editableCellError(value,properties) : validateWidgetControlValue(value,{item:{type:'text'},props:properties})}
        actions={{setValue:({value})=>change({target:{value},stopPropagation(){}},true)}}>{field}</NativeControlTarget>;
}
