import {useControlDOMIdentity} from './controlDOMIdentity.jsx';
// Minimal ControlWrapper used by WidgetRenderer (Phase 1 – placeholder)
import React, { useEffect, useRef, useId } from 'react';
import { getWrapper } from './wrapperRegistry.js';
import {registerControlActions, invalidateControlActionState, isLiveControlVisible, widgetControlActions, validateWidgetControlValue} from '../core/ui/controlActions.js';
import {evaluatePlainVisibleWhen} from '../components/visibleWhen.js';
import {runDynamicEvaluators} from './binding.js';
import {evaluateOperationGuard} from './operationGuards.js';
import {resolveSelector} from '../utils/selector.js';
import { registerControlTarget, unregisterControlTarget, focusControl } from '../core/ui/registry.js';

const findFocusable = (root) => {
    if (!root) return null;
    const selector = [
        'input:not([disabled])',
        'textarea:not([disabled])',
        'select:not([disabled])',
        'button:not([disabled])',
        'a[href]',
        '[tabindex]:not([tabindex="-1"])',
    ].join(', ');
    const node = root.querySelector(selector);
    if (!node) return null;
    if (node.offsetParent === null && node.getClientRects?.().length === 0) return null;
    return node;
};

export default function ControlWrapper({ item, container, context, framework = 'core', widgetKey, disabled = false, readOnly = false, children }) {
    const generatedId = useId();
    const accessibility = useControlDOMIdentity({windowId:context?.identity?.windowId,formId:container?.id || context?.identity?.dataSourceRef,controlId:children?.props?.id || item?.id || generatedId});
    const controlId=accessibility.controlId;
    const helperId=item?.validationError?accessibility.errorId:accessibility.helperId;
    const remapReferences=value=>typeof value==='string'?value.split(/\s+/).map(id=>id===item?.id?controlId:id===`${item?.id}-label`?accessibility.labelId:id===`${item?.id}-help`||id===`${item?.id}-error`?(hasHelper?helperId:id):id).join(' '):value;
    const helperText = item?.validationError || item?.helperText || item?.description;
    const controlOnly = item?.wrapper === 'control-only';
    const bypassHelper = item?.wrapper === 'none' || (framework === 'blueprint' && item?.isStandalone);
    const hasHelper = bypassHelper ? !!item?.validationError : !!helperText;
    const child = React.isValidElement(children) ? React.cloneElement(children, {
        id: controlId,
        ...(widgetKey==='radio'?{name:`${controlId}-options`}:{}),
        ...(children.props['aria-labelledby']?{'aria-labelledby':remapReferences(children.props['aria-labelledby'])}:{}),
        ...(item?.validationError?{'aria-errormessage':accessibility.errorId}:{}),
        'aria-describedby': [...new Set([remapReferences(children.props['aria-describedby']), hasHelper ? helperId : null].filter(Boolean).flatMap(value=>value.split(/\s+/)))].join(' ') || undefined,
        ...(controlOnly && (item?.required || item?.properties?.required)
            ? {'aria-required': children.props['aria-required'] ?? true}
            : {}),
        ...(controlOnly && (item?.validationError || item?.requiredState === 'invalid' || item?.requiredState === 'missing')
            ? {'aria-invalid': children.props['aria-invalid'] ?? true}
            : {}),
        ...(controlOnly && item?.id && item?.label && accessibility.labelOwned
            ? {'aria-labelledby': remapReferences(children.props['aria-labelledby']) ?? accessibility.labelId}
            : {}),
        ...(controlOnly
            ? {'data-forge-field-track-control': children.props['data-forge-field-track-control'] ?? 'true'}
            : {}),
    }) : children;

    const wrapperRef = useRef(null);
    const regKeyRef = useRef(null);
    const operationRef = useRef(null);
    operationRef.current = {item, context, widgetKey, disabled, readOnly, props: child?.props || {}};
    useEffect(() => {
        if (!context?.identity?.windowId || !item?.id || item?.wrapper === 'none' || item?.mutationCommand || item?.lookup || widgetKey==='dateRangePreset') return;
        return registerControlActions({windowId: context.identity.windowId, dataSourceRef: context.identity.dataSourceRef || null,
            controlId: item.id, scope: item.scope || 'form', bindingPath: item.bindingPath || item.id, dataField: item.dataField}, () => {
            const current = operationRef.current, {item, context, props} = current;
            const operationItem={...item,widget:current.widgetKey || item.widget};
            const node = wrapperRef.current?.querySelector?.('input,textarea,select,button,[role=button]');
            const currentForm=context?.handlers?.dataSource?.getFormData?.() || context?.signals?.form?.peek?.() || {};
            const value = resolveSelector(currentForm,item.dataField || item.bindingPath || item.id) ?? props.value;
            const declared=(name,candidate=value)=>evaluateOperationGuard(name,item,context,candidate);
            const dynamic = name => declared(name) ?? runDynamicEvaluators(name, {item, context, value});
            const condition = name => item[name] && evaluatePlainVisibleWhen(item[name], context);
            return {visible: isLiveControlVisible(wrapperRef.current) && dynamic('onVisible') !== false
                    && (!item.visibleWhen || condition('visibleWhen')) && !condition('hiddenWhen'),
                disabled: current.disabled || props.disabled === true || node?.disabled === true || node?.matches?.(':disabled') === true || dynamic('onDisabled') === true || condition('disabledWhen'),
                readOnly: current.readOnly || props.readOnly === true || node?.readOnly === true || dynamic('onReadonly') === true || condition('readOnlyWhen'),
                sensitive: item.sensitive === true || item.properties?.sensitive === true || /password|token|secret|credential/i.test(`${item.type || ''} ${item.widget || ''} ${props.type || ''} ${props.inputType || ''}`),
                actions: {...widgetControlActions({item:operationItem, props}),...(findFocusable(wrapperRef.current)?{focus:()=>focusControl({windowId:context.identity.windowId,dataSourceRef:context.identity.dataSourceRef,controlId:item.id}) && wrapperRef.current?.contains?.(document.activeElement)===true}:{})},
                validate: value => validateWidgetControlValue(value, {item:operationItem, props}) || declared('onValidate',value) || runDynamicEvaluators('onValidate', {item, context, value}),
            };
        }, () => {
            const current=operationRef.current,{item,props}=current;const operationItem={...item,widget:current.widgetKey || item.widget};
            const node=wrapperRef.current?.querySelector?.('input,textarea,select,button,[role=button]');
            return {visible:isLiveControlVisible(wrapperRef.current),disabled:current.disabled||props.disabled===true||node?.disabled===true||node?.matches?.(':disabled')===true,
                readOnly:current.readOnly||props.readOnly===true||node?.readOnly===true,
                sensitive:item.sensitive===true||item.properties?.sensitive===true||/password/i.test(`${item.type || ''} ${item.widget || ''} ${props.type || ''} ${props.inputType || ''}`),
                value:props.value,options:props.options,actions:{...widgetControlActions({item:operationItem,props}),...(findFocusable(wrapperRef.current)?{focus:()=>focusControl({windowId:current.context.identity.windowId,dataSourceRef:current.context.identity.dataSourceRef,controlId:item.id}) && wrapperRef.current?.contains?.(document.activeElement)===true}:{})},
                constraints:{...(current.widgetKey==='file'?{requiresTrustedFileInput:true,requiresUserInteraction:true}:{}),...Object.fromEntries(['required','min','max','minLength','maxLength','pattern','minItems','maxItems'].filter(key=>props[key]!==undefined||item[key]!==undefined).map(key=>[key,props[key]??item[key]]))}};
        });
    }, [context?.identity?.windowId, context?.identity?.dataSourceRef, item?.id, item?.wrapper, widgetKey]);

    useEffect(() => {if(context?.identity?.windowId)invalidateControlActionState(context.identity.windowId);}, [context?.identity?.windowId, disabled, readOnly, child?.props?.disabled, child?.props?.readOnly]);

    const custom = getWrapper(framework);

    // ----- fallback simple wrapper ---------------------------------
    const columns = container?.layout?.columns || 1;
    const span = Math.min(item?.columnSpan || 1, columns);

    const style = {
        ...(span > 1 ? {gridColumn: `span ${span}`} : {}),
        ...(item?.style || {}),
    };

    const inline = (item.labelPosition || container?.layout?.labelPosition) === 'left';
    const unavailable = disabled === true || readOnly === true;
    const unavailableTooltip = unavailable ? (item?.tooltip || item?.title || '') : '';
    const accessibilityProps = unavailableTooltip ? {
        title: unavailableTooltip,
        tabIndex: 0,
        'aria-label': `${item?.label || item?.id || 'Control'}. ${unavailableTooltip}`,
    } : {};

    const isLabelWidget =
        (item?.type && String(item.type).toLowerCase() === 'label') ||
        (item?.widget && String(item.widget).toLowerCase() === 'label');

    useEffect(() => {
        const windowId = context?.identity?.windowId;
        const dataSourceRef = context?.identity?.dataSourceRef;
        const controlId = item?.id;
        if (!windowId || !controlId || item?.wrapper === 'none') return;

        const wrapper = wrapperRef.current;
        const meta = {
            windowId,
            dataSourceRef,
            controlId,
            label: item?.label || null,
            type: item?.type || item?.widget || null,
            scope: item?.scope || null,
        };

        const key = registerControlTarget(meta, {
            wrapper,
            resolver: ({ wrapper }) => findFocusable(wrapper) || wrapper,
        });
        regKeyRef.current = key;

        return () => {
            if (regKeyRef.current) {
                unregisterControlTarget(regKeyRef.current);
                regKeyRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [context?.identity?.windowId, context?.identity?.dataSourceRef, item?.id, item?.wrapper]);

    // Keep hooks unconditional when metadata changes wrapper mode.
    if (item?.wrapper === 'none') {
        if (!item?.validationError) return child;
        return <div className="forge-control-validation-shell" data-forge-control-id={item?.id || undefined}>
            {child}
            <div className="forge-control-validation-message" id={helperId}
                data-forge-part="validation-message" role="alert">{item.validationError}</div>
        </div>;
    }

    if (controlOnly) {
        return (
            <div
                className={["forge-control-track-content", readOnly ? "is-readonly" : "", disabled ? "is-disabled" : ""].filter(Boolean).join(" ")}
                ref={wrapperRef}
                data-forge-control-id={item?.id || undefined}
                {...accessibilityProps}
            >
                {child}
                {hasHelper && <div id={helperId} data-forge-part={item?.validationError ? 'validation-message' : 'helper-text'}
                    role={item?.validationError ? 'alert' : undefined}>{helperText}</div>}
            </div>
        );
    }

    if (custom) {
        return (
            <div
                style={style}
                className={["forge-control-wrapper", readOnly ? "is-readonly" : "", disabled ? "is-disabled" : "", item?.className].filter(Boolean).join(" ")}
                ref={wrapperRef}
                data-forge-control-id={item?.id || undefined}
                {...accessibilityProps}
            >
                {custom(item, container, child, context, {controlId, labelId:accessibility.labelId, helperId, disabled, readOnly})}
            </div>
        );
    }

    return (
        <div
            style={style}
            className={["forge-control-wrapper", readOnly ? "is-readonly" : "", disabled ? "is-disabled" : "", item?.className].filter(Boolean).join(" ")}
            ref={wrapperRef}
            data-forge-control-id={item?.id || undefined}
            {...accessibilityProps}
        >
            {item?.label && !item.hideLabel && !isLabelWidget && (
                <label
                    data-forge-part="label"
                    id={accessibility.labelId}
                    htmlFor={controlId}
                    style={{ display: inline ? 'inline-block' : 'block', marginRight: inline ? 8 : 0 }}
                    title={item.tooltip || undefined}
                >
                    {item.label}
                </label>
            )}
            {child}
            {hasHelper && <div id={helperId} data-forge-part={item?.validationError ? 'validation-message' : 'helper-text'}
                role={item?.validationError ? 'alert' : undefined}>{helperText}</div>}
        </div>
    );
}
