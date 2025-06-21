// SchemaBasedForm.jsx – renders a form based on either an explicit list of
// fields or a minimal JSON-schema (object with properties).

import React, { useMemo, useState } from 'react';
import { getWidget } from '../registry/widgets.js';
import { jsonSchemaToFields } from '../utils/schema.js';

/*
Props:
  id?: string
  dataBinding: string           // window.state.* path – opaque for now
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

    const handleChange = (name, val) => {
        setValues({ ...values, [name]: val });
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

    return (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', ...(style || {}) }}>
            {derivedFields.map((field) => {
                const Widget = getWidget(field);
                return (
                    <div key={field.name} style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ marginBottom: 4 }}>
                            {field.label} {field.required && '*'}
                        </label>
                        <Widget
                            value={values[field.name]}
                            onChange={(val) => handleChange(field.name, val)}
                            field={field}
                        />
                        {errors[field.name] && (
                            <span style={{ color: 'red', fontSize: 12 }}>{errors[field.name]}</span>
                        )}
                    </div>
                );
            })}
            <button type="submit" className="bp4-button bp4-intent-primary" style={{ alignSelf: 'flex-start' }}>
                Submit
            </button>
        </form>
    );
};

export default SchemaBasedForm;
