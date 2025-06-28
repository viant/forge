// SchemaBasedForm.jsx – renders a form based on either an explicit list of
// fields or a minimal JSON-schema (object with properties).

import React, { useMemo, useState } from 'react';
import WidgetRenderer from '../runtime/WidgetRenderer.jsx';
import { jsonSchemaToFields } from '../utils/schema.js';

/*
Props:
  id?: string
  fields?: FormField[]          // explicit definition (preferred from backend)
  schema?: JSONSchema           // legacy: raw schema
  requestedSchema?: JSONSchema  // new alias for `schema` – mirrors chat backend
  onSubmit?: (payload)=>void
  layout?, style?               // ignored in this first cut

A **FormField** mirrors backend struct:
{
  name, label, type, required, enum, default,
  widget, group, order
}
*/

const SchemaBasedForm = (props) => {
    const {
        id,
        dataBinding,
        fields,
        schema,
        requestedSchema,
        onSubmit,
        context,
        dataSourceRef,
        style,
        on,
    } = props;

    const derivedFields = useMemo(() => {
        if (fields && fields.length) return fields;

        const rawSchema = schema || requestedSchema;
        return jsonSchemaToFields(rawSchema);
    }, [fields, schema, requestedSchema]);

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

        onSubmit?.(values);
    };

    // Determine rendering context & adapter
    let renderContext = context
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

    if (scope === 'local') {
        stateArg = [values, setValues];
    }

    // ---------------------------------------------------------------
    // Dirty flag – submit enabled only when something changed
    // ---------------------------------------------------------------
    const isLinkOnlyForm =
        derivedFields.length === 1 &&
        derivedFields[0]?.format === 'uri' &&
        typeof derivedFields[0]?.default === 'string' &&
        /^https?:\/\//i.test(derivedFields[0].default);

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
            <button
                type="submit"
                className="bp4-button bp4-intent-primary"
                style={{ gridColumn: 'span 2', justifySelf: 'start' }}
                disabled={!isDirty}
            >
                {isLinkOnlyForm ? 'Accept' : 'Submit'}
            </button>
        </form>
    );
};

export default SchemaBasedForm;
