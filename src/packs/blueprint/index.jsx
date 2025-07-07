/* -------------------------------------------------------------------------
 * Blueprint Pack – Phase 2
 * -------------------------------------------------------------------------
 * Registers a minimal text input widget with the new widget runtime.  This
 * proves the end-to-end flow while other controls stay on the legacy
 * ControlRenderer.
 * ---------------------------------------------------------------------- */

import React from 'react';
import {
    InputGroup,
    Checkbox,
    Switch,
    Button,
    MenuItem,
    TextArea,
    RadioGroup,
    Radio,
    ProgressBar,
    Label,
    Tooltip,
    FormGroup,
    AnchorButton,
} from '@blueprintjs/core';
import TextLookup from './TextLookup.jsx';
import { Select } from '@blueprintjs/select';
import { DateInput3 } from '@blueprintjs/datetime2';
import { NumericInput } from '@blueprintjs/core';
import { addStyles, EditableMathField } from 'react-mathquill';

import PrettyJson from '../../components/PrettyJson.jsx';
import SchemaExplorer from '../../widgets/SchemaExplorer.jsx';

import { registerWidget } from '../../runtime/widgetRegistry.jsx';
import { registerEventAdapter } from '../../runtime/binding.js';
import { registerClassifier } from '../../runtime/widgetClassifier.js';
import { buildDateProps } from './dateUtils.js';
import { registerWrapper } from '../../runtime/wrapperRegistry.js';
import TreeMultiSelect from '../../components/TreeMultiSelect.jsx';

/* ------------------------ Widget implementation ----------------------- */

function TextInput({ value = '', onChange, readOnly, ...rest }) {
    return (
        <InputGroup
            {...rest}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            readOnly={readOnly}
        />
    );
}

/* ------------------------------ Pack ---------------------------------- */

export function registerPack() {
    // Widget key mirrors legacy "text" type – decide variant at runtime
    registerWidget('text', (props) => {
        if (props?.item?.lookup) {
            return <TextLookup {...props} />;
        }
        return <TextInput {...props} />;
    }, { framework: 'blueprint' });

    /* -------------------- Password input --------------------------- */
    registerWidget('password', (props) => <TextInput {...props} type="password" />, { framework: 'blueprint' });

    registerEventAdapter('password', {
        onChange: ({ adapter }) => (e) => {
            const val = e?.target?.value ?? e;
            adapter.set(val);
        },
    });

    /* -------------------- Object / JSON viewer -------------------- */
    registerWidget(
        'object',
        ({ readOnly, onChange, ...rest }) => (
            <PrettyJson readOnly={readOnly} onChange={onChange} {...rest} />
        ),
        { framework: 'blueprint' }
    );

    registerEventAdapter('object', {
        onChange: ({ adapter }) => (v) => adapter.set(v),
    });

    // Basic onChange → adapter.set mapping
    registerEventAdapter('text', {
        onChange: ({ adapter }) => (e) => {
            const val = e?.target?.value ?? e;
            adapter.set(val);
        },
    });

    /* -------------------- Numeric / Number -------------------------- */

    /* -------------------- Number / Numeric input ------------------- */
    registerWidget(
        'number',
        ({ value = '', onValueChange, readOnly, ...rest }) => (
            <NumericInput
                {...rest}
                value={value ?? ''}
                onValueChange={(v) => onValueChange?.(v)}
                readOnly={readOnly}
            />
        ),
        { framework: 'blueprint' }
    );

    registerEventAdapter('number', {
        onValueChange: ({ adapter }) => (v) => adapter.set(v),
    });

    /* -------------------- TextArea ---------------------------------- */
    registerWidget(
        'textarea',
        ({ value = '', onChange, readOnly, ...rest }) => (
            <TextArea
                {...rest}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                readOnly={readOnly}
            />
        ),
        { framework: 'blueprint' }
    );

    registerEventAdapter('textarea', {
        onChange: ({ adapter }) => (e) => {
            const val = e?.target?.value ?? e;
            adapter.set(val);
        },
    });

    /* -------------------- JSON-Schema viewer ----------------------- */
    // Usage: set `widget: schema` for a form field whose value is a JSON-Schema
    // object.  The control renders SchemaExplorer in read-only mode.
    registerWidget(
        'schema',
        ({ value }) => (
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
                <SchemaExplorer value={value} />
            </div>
        ),
        { framework: 'blueprint' }
    );

    /* -------------------- Checkbox / Toggle ------------------------- */
    registerWidget(
        'checkbox',
        ({ value = false, onChange, readOnly, ...rest }) => (
            <Checkbox
                {...rest}
                checked={!!value}
                onChange={(e) => onChange?.(e.target.checked)}
                disabled={readOnly}
            />
        ),
        { framework: 'blueprint' }
    );

    registerWidget('toggle', ({ value = false, onChange, readOnly, ...rest }) => (
        <Switch
            {...rest}
            checked={!!value}
            onChange={(e) => onChange?.(e.target.checked)}
            disabled={readOnly}
        />
    ), { framework: 'blueprint' });

    registerEventAdapter('checkbox', {
        onChange: ({ adapter }) => (e) => adapter.set(e.target.checked),
    });
    registerEventAdapter('toggle', {
        onChange: ({ adapter }) => (e) => adapter.set(e.target.checked),
    });

    /* -------------------- Select / Dropdown ------------------------- */
    registerWidget(
        'select',
        function BPSelect({ value, onChange, readOnly, options = [], ...rest }) {
            const selected = options.find((o) => o.value === value);
            return (
                <Select
                    items={options}
                    itemRenderer={(item, { handleClick, modifiers }) => (
                        <MenuItem key={item.value} text={item.label} active={modifiers.active} onClick={handleClick} />
                    )}
                    filterable={false}
                    disabled={readOnly}
                    {...rest}
                    onItemSelect={(item) => onChange?.(item.value)}
                >
                    <Button text={selected?.label || rest.placeholder || 'Select…'} rightIcon="caret-down" disabled={readOnly} />
                </Select>
            );
        },
        { framework: 'blueprint' },
    );

    registerEventAdapter('select', {
        onItemSelect: ({ adapter }) => (val) => adapter.set(val.value ?? val),
    });

    /* -------------------- Read-only Link ---------------------------- */
    registerWidget(
        'link',
        ({ value = '', readOnly, ...rest }) => {
            if (!value) return null;
            return (
                <AnchorButton
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    text={value}
                    minimal
                    {...rest}
                />
            );
        },
        { framework: 'blueprint' }
    );

    // Link is read-only – no event adapter needed

    /* -------------------- Currency ---------------------------------- */
    registerWidget(
        'currency',
        ({ value = '', onChange, readOnly, ...rest }) => (
            <NumericInput
                {...rest}
                value={value ?? ''}
                onValueChange={(v) => onChange?.(v)}
                readOnly={readOnly}
                leftIcon="dollar"
                majorStepSize={10}
                minorStepSize={0.1}
            />
        ),
        { framework: 'blueprint' }
    );

    registerEventAdapter('currency', {
        onValueChange: ({ adapter }) => (v) => adapter.set(v),
    });

    /* -------------------- Date / DateTime --------------------------- */
    const registerDateKind = (kind) => {
        registerWidget(
            kind,
            ({ value, onChange, readOnly, dateFnsFormat, ...rest }) => (
                <DateInput3
                    {...buildDateProps({ type: kind, dateFnsFormat }, { readOnly, properties: rest })}
                    value={value}
                    onChange={(sel) => onChange?.(sel)}
                />
            ),
            { framework: 'blueprint' }
        );

        registerEventAdapter(kind, {
            onChange: ({ adapter }) => (d) => adapter.set(d),
        });
    };

    registerDateKind('date');
    registerDateKind('datetime');

    /* -------------------- Radio group ------------------------------- */
    registerWidget('radio', ({ value, onChange, readOnly, options = [], ...rest }) => (
        <RadioGroup
            {...rest}
            disabled={readOnly}
            selectedValue={`${value}`}
            onChange={(e) => onChange?.(e.target.value)}
        >
            {options.map((opt) => (
                <Radio key={opt.value} label={opt.label} value={opt.value} />
            ))}
        </RadioGroup>
    ), { framework: 'blueprint' });

    registerEventAdapter('radio', {
        onChange: ({ adapter }) => (e) => adapter.set(e.target.value),
    });

    /* -------------------- TreeMultiSelect --------------------------- */
    registerWidget(
        'treeMultiSelect',
        (props) => {
            const { value = [], onChange, readOnly, options = [], ...rest } = props
            const {properties={}} = props
            return (<TreeMultiSelect
                {...rest}
                options={options}
                value={value}
                onChange={onChange}
                readOnly={readOnly}
                separator={properties.separator||'_'}
            />)}
        ,
        { framework: 'blueprint' }
    );

    registerEventAdapter('treeMultiSelect', {
        onChange: ({ adapter }) => (vals) => adapter.set(vals),
    });

    /* -------------------- Classifier mapping ----------------------- */
    // Ensure descriptors that specify `type: "treeMultiSelect"` resolve
    // to this widget key when no explicit `widget` field is present.
    registerClassifier(
        (item) => {
            if (item?.type === 'treeMultiSelect') return 'treeMultiSelect';
        },
        { priority: 90 }
    );

    /* -------------------- Progress bar ------------------------------ */
    registerWidget('progressBar', ({ value = 0, ...rest }) => (
        <ProgressBar {...rest} value={value} />
    ), { framework: 'blueprint' });

    /* -------------------- Button ------------------------------------ */
    registerWidget('button', ({ onClick, readOnly, intent, children, ...rest }) => (
        <Button {...rest} intent={intent} disabled={readOnly} onClick={onClick}>
            {children}
        </Button>
    ), { framework: 'blueprint' });

    /* -------------------- Label ------------------------------------- */
    registerWidget('label', ({ value, ...rest }) => <Label {...rest}>{value}</Label>, { framework: 'blueprint' });

    /* -------------------- Math (MathQuill) -------------------------- */
    // Ensure MathQuill CSS injected once
    addStyles();

    registerWidget(
        'math',
        ({ value = '', onChange, readOnly, ...rest }) => (
            <EditableMathField
                {...rest}
                latex={value}
                onChange={(mathField) => onChange?.(mathField.latex())}
                readOnly={readOnly}
            />
        ),
        { framework: 'blueprint' }
    );

    registerEventAdapter('math', {
        onChange: ({ adapter }) => (latex) => adapter.set(latex),
    });

    /* -------------------- KeyValuePairs ------------------------------ */
    const KeyValuePairsComponent = ({ data = {}, onChange, readOnly }) => {
        const entries = Object.entries(data);
        const handleAdd = () => {
            onChange?.({ ...data, '': '' });
        };
        const handleChange = (k, v) => {
            const next = { ...data, [k]: v };
            onChange?.(next);
        };
        return (
            <div className="flex flex-col gap-1">
                {entries.map(([k, v], idx) => (
                    <div key={idx} className="flex gap-1">
                        <InputGroup
                            value={k}
                            readOnly={readOnly}
                            onChange={(e) => handleChange(e.target.value, v)}
                        />
                        <InputGroup
                            value={v}
                            readOnly={readOnly}
                            onChange={(e) => handleChange(k, e.target.value)}
                        />
                    </div>
                ))}
                {!readOnly && (
                    <Button icon="add" minimal onClick={handleAdd} />
                )}
            </div>
        );
    };

    registerWidget('keyValuePairs', KeyValuePairsComponent, { framework: 'blueprint' });

    registerEventAdapter('keyValuePairs', {
        onChange: ({ adapter }) => (v) => adapter.set(v),
    });
}

// Auto-register when the feature flag is active
// Always register blueprint pack (feature flag removed in Phase 5)
registerPack();

// Register Blueprint wrapper globally
registerWrapper('blueprint', (item, container, children) => {
        const inline = (item.labelPosition || container?.layout?.labelPosition) === 'left';
        // Stand-alone controls like button can disable FormGroup
        if (item.isStandalone) return children;

        const labelContent = item.hideLabel ? undefined : (
            item.tooltip ? (
                <Tooltip content={item.tooltip} hoverOpenDelay={250}>
                    <span>{item.label}</span>
                </Tooltip>
            ) : (
                item.label
            )
        );

        return (
            <FormGroup
                label={labelContent}
                inline={inline}
                labelFor={item.id}
                helperText={item.validationError}
                intent={item.validationError ? 'danger' : 'none'}
                style={{ gridColumn: `span ${Math.min(item.columnSpan || 1, container?.layout?.columns || 1)}` }}
            >
                {children}
            </FormGroup>
        );
});
