import SchemaFormChoices from './SchemaFormChoices.jsx';
import {validateSchemaFormFields} from './schemaFormValidation.js';
// SchemaBasedForm.jsx – renders a form based on either an explicit list of
// fields or a minimal JSON-schema (object with properties).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSignalEffect } from '@preact/signals-react';
import { resolveSelector } from '../utils/selector.js';
import WidgetRenderer from '../runtime/WidgetRenderer.jsx';
import ControlWrapper from '../runtime/ControlWrapper.jsx';
import { jsonSchemaToFields } from '../utils/schema.js';
import GridLayoutRenderer from '../components/GridLayoutRenderer.jsx';
import LookupSelectionInput from '../components/lookup/LookupSelectionInput.jsx';
import {
    LookupUnavailableError,
    mapLookupSelection,
    mergeLookupPatch,
    requestLookupSelection,
    writeLookupFormValues,
} from '../utils/lookup.js';
import {resolveSchemaFormFieldTracksLayout, schemaFormAttributes} from './schemaFormLayout.js';
import './SchemaBasedForm.css';

/*
Props:
  id?: string
  fields?: FormField[]          // explicit definition (preferred from backend)
  schema?: JSONSchema  // new alias for `schema` – mirrors chat backend
  onSubmit?: (payload, setFormState)=>void
  layout?, style?               // opt-in field-track layout or legacy grid style

A **FormField** mirrors backend struct:
{
  name, label, type, required, enum, default,
  widget, group, order
}
*/

const SchemaBasedForm = (props) => {
    const {
        id: formId,
        fields,
        schema: schemaProp,
        data,
        onSubmit,
        context,
        dataSourceRef,
        dataBinding = 'schema', // optional path inside record for dynamic schema
        layout,
        style,
        showSubmit = true, // allow hiding the submit button
    } = props;
    // Determine rendering context & adapter (must be before hooks that use it)
    let renderContext = context;
    let stateArg = null;
    let scope = 'local';

    if (context && dataSourceRef) {
        try {
            const currentRef = String(context?.identity?.dataSourceRef || '').trim();
            renderContext = currentRef === String(dataSourceRef).trim()
                ? context
                : context.Context(dataSourceRef);
            scope = 'form';
        } catch (e) {
            console.error('SchemaBasedForm: unable to resolve dataSourceRef', dataSourceRef, e);
        }
    }

    const [tick, forceRender] = useState(0);

    // Re-render whenever the underlying form data changes (selected record)
    useSignalEffect(() => {
        try {
            renderContext?.signals?.form?.value; // establish dependency
            forceRender((c) => c + 1);
        } catch {}
    });

    // Resolve dynamic schema when not provided explicitly
    const effectiveSchema = useMemo(() => {
        if (schemaProp) return schemaProp;

        // Attempt to pull from current record in DataSource via dataBinding path
        try {
            const record = renderContext?.handlers?.dataSource?.getFormData?.() || {};
            const dyn = resolveSelector(record, dataBinding);
            if (dyn && typeof dyn === 'object') return dyn;
        } catch (e) {
            console.error('SchemaBasedForm: unable to resolve dynamic schema', e);
        }
        return null;
    }, [schemaProp, renderContext, tick]);

    const derivedFields = useMemo(() => {
        if (fields && fields.length) return fields;
        return jsonSchemaToFields(effectiveSchema);
    }, [fields, effectiveSchema]);
    // state object keyed by field.name
    const initialValues = useMemo(() => {
        const obj = {};
        derivedFields.forEach((f) => {
            if (f.default !== undefined) obj[f.name] = f.default;
        });
        if (scope === 'local' && data && typeof data === 'object' && !Array.isArray(data)) {
            Object.entries(data).forEach(([key, value]) => {
                if (value !== undefined) {
                    obj[key] = value;
                }
            });
        }
        return obj;
    }, [data, derivedFields, scope]);

    const [values, setValues] = useState(initialValues);
    const [errors, setErrors] = useState({});
    const [lookupStates, setLookupStates] = useState({});
    const lookupRequests = useRef(new Map());

    useEffect(() => () => {
        lookupRequests.current.forEach((controller) => controller.abort());
        lookupRequests.current.clear();
    }, []);

    useEffect(() => {
        if (scope !== 'local') return;
        setValues(initialValues);
    }, [scope, initialValues]);

    const handleChangeDirect = (name, val) => {
        setValues((prev) => ({ ...prev, [name]: val }));
    };

    const openLookupField = async (field) => {
        const fieldKey = String(field?.id || field?.name || '').trim();
        if (!fieldKey || !field?.lookup) return;

        lookupRequests.current.get(fieldKey)?.abort();
        const controller = new AbortController();
        lookupRequests.current.set(fieldKey, controller);
        setLookupStates((previous) => ({...previous, [fieldKey]: {busy: true, error: ''}}));

        try {
            const current = scope === 'form'
                ? (renderContext?.handlers?.dataSource?.getFormData?.() || {})
                : values;
            const record = await requestLookupSelection({
                item: field,
                context: renderContext,
                value: current?.[field.name],
                signal: controller.signal,
            });
            if (!record || controller.signal.aborted) return;
            const patch = mapLookupSelection({item: field, record});
            if (Object.keys(patch).length === 0) {
                throw new Error('The selected option did not contain a usable value.');
            }
            if (scope === 'form') {
                const latest = renderContext?.handlers?.dataSource?.getFormData?.() || current;
                const next = mergeLookupPatch(latest, patch);
                if (!writeLookupFormValues({context: renderContext, values: next})) {
                    throw new Error('The selected option could not be applied to this form.');
                }
            } else {
                setValues((previous) => mergeLookupPatch(previous, patch));
            }
        } catch (error) {
            if (controller.signal.aborted || error?.name === 'AbortError') return;
            const message = error instanceof LookupUnavailableError
                ? 'Option selection is unavailable in this workspace.'
                : (error?.message || 'Options could not be opened. Try again.');
            setLookupStates((previous) => ({...previous, [fieldKey]: {busy: false, error: message}}));
            return;
        } finally {
            if (lookupRequests.current.get(fieldKey) === controller) {
                lookupRequests.current.delete(fieldKey);
                if (!controller.signal.aborted) {
                    setLookupStates((previous) => ({
                        ...previous,
                        [fieldKey]: {...previous[fieldKey], busy: false},
                    }));
                }
            }
        }
    };

    const basicValidate = () => {
        const err = validateSchemaFormFields(derivedFields, values);
        setErrors(err);
        return Object.keys(err).length === 0;
    };

    const submit = (e) => {
        e?.preventDefault();
        if (!basicValidate()) return;

        // Provide helper setter to update form programmatically upon response.
        const setFormState = (patch) => {
            if (!patch || typeof patch !== 'object') return;
            if (scope === 'form') {
                try {
                    const current = renderContext?.handlers?.dataSource?.getFormData?.() || {};
                    writeLookupFormValues({
                        context: renderContext,
                        values: mergeLookupPatch(current, patch),
                    });
                } catch (e) {
                    console.error('SchemaBasedForm: setFormData failed', e);
                }
            } else {
                setValues((prev) => ({ ...prev, ...patch }));
            }
        };

        onSubmit?.(values, setFormState);
    };

    if (scope === 'local') {
        stateArg = [values, setValues];
    }

    // ---------------------------------------------------------------
    // Dirty flag – submit enabled only when something changed
    // ---------------------------------------------------------------
    const onlyField = derivedFields.length === 1 ? derivedFields[0] : null;

    const looksLikeUrl =
        onlyField &&
        typeof onlyField.default === 'string' &&
        /^https?:\/\//i.test(onlyField.default);

    const isLinkOnlyForm =
        !!onlyField &&
        looksLikeUrl &&
        (onlyField.format === 'uri' || (!onlyField.format && onlyField.type === 'string'));

    // ensure widget renders as 'link'
    if (isLinkOnlyForm) {
        onlyField.widget = 'link';
        onlyField.readOnly = true;
    }


    let isDirty = false;
    if (isLinkOnlyForm) {
        isDirty = true; // always enable submit when only link present
    } else if (scope === 'form') {
        try {
            isDirty = !!renderContext?.signals?.formStatus?.peek()?.dirty;
        } catch {}
    } else {
        // Local form: shallow compare via JSON string (cheap for small forms)
        isDirty = JSON.stringify(values) !== JSON.stringify(initialValues);
    }

    const fieldTracksLayout = resolveSchemaFormFieldTracksLayout(layout);
    if (fieldTracksLayout) {
        const formValues = scope === 'form'
            ? (renderContext?.handlers?.dataSource?.getFormData?.() || {})
            : values;
        const formContainer = {layout: fieldTracksLayout};
        const fieldTrackItems = derivedFields.map((field) => {
            const fieldId = field.id || field.name;
            const columnSpan = field.columnSpan || (
                field.type === 'textarea' || field.widget === 'textarea'
                    ? fieldTracksLayout.columns
                    : 1
            );
            return {
                ...field,
                id: fieldId,
                dataField: field.dataField || field.name || fieldId,
                scope,
                columnSpan,
                validationError: errors[field.name] || field.validationError,
            };
        });

        return (
            <form id={formId} onSubmit={submit} {...schemaFormAttributes(fieldTracksLayout)}>
                <GridLayoutRenderer
                    context={context || renderContext}
                    container={formContainer}
                    items={fieldTrackItems}
                    state={stateArg}
                    baseDataSourceRef={dataSourceRef}
                    style={style}
                    controlWrapperMode="control-only"
                    renderControl={({item, sourceItem, context: fieldContext, container: fieldContainer}) => {
                        if (sourceItem.widget === 'checkboxGroup') return <SchemaFormChoices field={sourceItem} value={formValues?.[sourceItem.name]} onChange={(value) => {
                            if (scope === 'form') writeLookupFormValues({context: renderContext, values: {...formValues, [sourceItem.name]: value}});
                            else handleChangeDirect(sourceItem.name, value);
                        }} disabled={props.disabled} error={errors[sourceItem.name]} />;
                        if (sourceItem.widget !== 'lookup' || !sourceItem.lookup) return undefined;
                        const rawValue = formValues?.[sourceItem.name];
                        const displayTemplate = String(sourceItem.lookup.display || '').trim();
                        const display = displayTemplate.replace(/\$\{([^}]+)\}/g, (_, selector) => String(formValues?.[String(selector).trim()] ?? '')).trim();
                        const unavailable = sourceItem.readOnly === true || sourceItem.disabled === true;
                        const lookupState = lookupStates[sourceItem.id || sourceItem.name] || {};
                        return (
                            <ControlWrapper
                                item={item}
                                container={fieldContainer}
                                context={fieldContext}
                                framework="core"
                                disabled={sourceItem.disabled === true}
                                readOnly={sourceItem.readOnly === true}
                            >
                                <LookupSelectionInput
                                    aria-label={sourceItem.ariaLabel || sourceItem.label || sourceItem.name}
                                    data-forge-widget="lookup"
                                    data-forge-control-id={sourceItem.id}
                                    data-forge-part="input"
                                    selections={[]}
                                    inputValue={rawValue == null || rawValue === '' ? '' : (display || String(rawValue))}
                                    placeholder={`Select ${String(sourceItem.label || sourceItem.name).toLowerCase()}`}
                                    browseLabel={`Choose ${sourceItem.label || sourceItem.name}`}
                                    allowManualEntry={false}
                                    disabled={unavailable}
                                    busy={lookupState.busy === true}
                                    error={lookupState.error || ''}
                                    onBrowse={() => openLookupField(sourceItem)}
                                />
                            </ControlWrapper>
                        );
                    }}
                />
                {Object.keys(errors).length > 0 && (
                    <div data-forge-part="validation-summary" role="alert">
                        Please fix highlighted fields.
                    </div>
                )}
                {showSubmit && (
                    <div data-forge-part="form-actions">
                        <button
                            type="submit"
                            className="bp4-button bp4-intent-primary"
                            disabled={!isDirty}
                        >
                            {isLinkOnlyForm ? 'Accept' : 'Submit'}
                        </button>
                    </div>
                )}
            </form>
        );
    }

    return (
        <form
            onSubmit={submit}
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
                ...(style || {}),
            }}
        >
            {derivedFields.map((field) => {
                const colSpan = field.columnSpan || (field.type === 'textarea' ? 2 : 1);
                if (field.widget === 'checkboxGroup') {
                    const formValues = scope === 'form' ? (renderContext?.handlers?.dataSource?.getFormData?.() || {}) : values;
                    return <div key={field.name} style={{gridColumn: '1 / -1'}}>
                        <SchemaFormChoices field={field} value={formValues[field.name]} onChange={(value) => {
                            if (scope === 'form') writeLookupFormValues({context: renderContext, values: {...formValues, [field.name]: value}});
                            else handleChangeDirect(field.name, value);
                        }} disabled={props.disabled} error={errors[field.name]} />
                    </div>;
                }
                if (field.widget === 'lookup' && field.lookup) {
                    const formValues = scope === 'form'
                        ? (renderContext?.handlers?.dataSource?.getFormData?.() || {})
                        : values;
                    const rawValue = formValues?.[field.name];
                    const displayTemplate = String(field.lookup.display || '').trim();
                    const display = displayTemplate.replace(/\$\{([^}]+)\}/g, (_, selector) => String(formValues?.[String(selector).trim()] ?? '')).trim();
                    const lookupState = lookupStates[field.id || field.name] || {};
                    return (
                        <label key={field.name} style={{gridColumn: `span ${colSpan}`, display: 'grid', gap: 6}}>
                            <span>{field.label}</span>
                            <LookupSelectionInput
                                selections={rawValue == null || rawValue === '' ? [] : [{value: rawValue, label: display || String(rawValue)}]}
                                inputValue=""
                                placeholder={`Select ${String(field.label || field.name).toLowerCase()}`}
                                browseLabel={`Choose ${field.label || field.name}`}
                                allowManualEntry={false}
                                disabled={field.readOnly === true || field.disabled === true}
                                busy={lookupState.busy === true}
                                error={lookupState.error || ''}
                                onBrowse={() => openLookupField(field)}
                            />
                        </label>
                    );
                }
                return (
                    <WidgetRenderer
                        key={field.name}
                        item={{ ...field, scope, columnSpan: colSpan }}
                        container={{ layout: { columns: 2 } }}
                        state={stateArg}
                        context={renderContext}
                    />
                );
            })}
            {/* simple validation message */}
            {Object.keys(errors).length > 0 && (
                <div style={{ color: 'red', fontSize: 12 }}>
                    Please fix highlighted fields.
                </div>
            )}
            {showSubmit && (
                <button
                    type="submit"
                    className="bp4-button bp4-intent-primary"
                    style={{ gridColumn: 'span 2', justifySelf: 'start' }}
                    disabled={!isDirty}
                >
                    {isLinkOnlyForm ? 'Accept' : 'Submit'}
                </button>
            )}
        </form>
    );
};

export default SchemaBasedForm;
