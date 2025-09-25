// SchemaBasedForm.jsx – renders a form based on either an explicit list of
// fields or a minimal JSON-schema (object with properties).

import React, { useMemo, useState } from 'react';
import { useSignalEffect } from '@preact/signals-react';
import { resolveSelector } from '../utils/selector.js';
import WidgetRenderer from '../runtime/WidgetRenderer.jsx';
import { jsonSchemaToFields } from '../utils/schema.js';

/*
Props:
  id?: string
  fields?: FormField[]          // explicit definition (preferred from backend)
  schema?: JSONSchema  // new alias for `schema` – mirrors chat backend
  onSubmit?: (payload, setFormState)=>void
  layout?, style?               // ignored in this first cut

A **FormField** mirrors backend struct:
{
  name, label, type, required, enum, default,
  widget, group, order
}
*/

const SchemaBasedForm = (props) => {
    const {
        fields,
        schema: schemaProp,
        onSubmit,
        context,
        dataSourceRef,
        dataBinding = 'schema', // optional path inside record for dynamic schema
        style,
        showSubmit = true, // allow hiding the submit button
    } = props;
    // Determine rendering context & adapter (must be before hooks that use it)
    let renderContext = context;
    let stateArg = null;
    let scope = 'local';

    if (context && dataSourceRef) {
        try {
            renderContext = context.Context(dataSourceRef);
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
        return obj;
    }, [derivedFields]);

    const [values, setValues] = useState(initialValues);
    const [errors, setErrors] = useState({});

    const handleChangeDirect = (name, val) => {
        setValues((prev) => ({ ...prev, [name]: val }));
    };

    const basicValidate = () => {
        const err = {};
        derivedFields.forEach((f) => {
            const v = values[f.name];
            if (f.required && (v === undefined || v === '' || v === null)) {
                err[f.name] = 'Required';
            }
            if (f.enum && v && !f.enum.includes(v)) {
                err[f.name] = 'Invalid value';
            }
        });
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
                    renderContext?.handlers?.dataSource?.setFormData?.(patch);
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
