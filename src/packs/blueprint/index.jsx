/* -------------------------------------------------------------------------
 * Blueprint Pack – Phase 2
 * -------------------------------------------------------------------------
 * Registers a minimal text input widget with the new widget runtime.  This
 * proves the end-to-end flow while other controls stay on the legacy
 * ControlRenderer.
 * ---------------------------------------------------------------------- */

import React from 'react';
import {createPortal} from 'react-dom';
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
import { Select, MultiSelect } from '@blueprintjs/select';
import { DateInput3 } from '@blueprintjs/datetime2';
import { NumericInput } from '@blueprintjs/core';

import PrettyJson from '../../components/PrettyJson.jsx';
import SchemaExplorer from '../../widgets/SchemaExplorer.jsx';

import { registerWidget } from '../../runtime/widgetRegistry.jsx';
import { registerEventAdapter } from '../../runtime/binding.js';
import { registerClassifier } from '../../runtime/widgetClassifier.js';
import { buildDateProps } from './dateUtils.js';
import { registerWrapper } from '../../runtime/wrapperRegistry.js';
import TreeMultiSelect from '../../components/TreeMultiSelect.jsx';
import MarkdownView from '../../components/MarkdownView.jsx';
import MarkdownEditor from '../../components/MarkdownEditor.jsx';
import { formatDisplayValue, mapDisplayValue, resolveEmptyDisplayText } from '../../utils/formatValue.js';
import { resolveLinkTarget } from '../../utils/linkTarget.js';
import { permittedOptions } from './permittedOptions.js';
import ChipList from '../../components/ChipList.jsx';
import {formatPercentFraction2Input, parsePercentFraction2Input} from './percentFractionInput.js';
import {resolveSelector} from '../../utils/selector.js';
import {normalizeLifetimeStart, resolveDateRangePreset} from './dateRangePreset.js';

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

function BooleanPill({value = false, onChange, readOnly, disabled, item, ariaLabel, 'aria-label': ariaLabelProp, ...rest}) {
    const checked = !!value;
    return (
        <button id={rest.id} title={rest.title} type="button" role="switch" aria-checked={checked} aria-label={ariaLabel || ariaLabelProp || item?.label || item?.name || 'Boolean value'}
            className={`forge-boolean-pill${checked ? ' is-on' : ''}`}
            disabled={readOnly || disabled} onClick={() => onChange?.(!checked)}>
            <span className="forge-boolean-pill__track"><span className="forge-boolean-pill__thumb"/></span>
            <span>{checked ? 'Yes' : 'No'}</span>
        </button>
    );
}

const formatDateRangeDay = (value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(parsed);
};

export function DateRangePresetInput({
    value = '',
    onChange,
    options = [],
    readOnly,
    disabled,
    context,
    item,
    startField = 'customDateStart',
    endField = 'customDateEnd',
    granularityField = 'granularity',
    includePartialDataField = 'includePartialData',
    lifetimeStart = '2026-01-01',
    lifetimeStartSelector = '',
    timeZone = 'UTC',
    timeZoneSelector = '',
    customApplyEnabled = false,
    customDisabledMessage = 'Custom dates are saved as a draft and do not refresh data yet.',
}) {
    const [open, setOpen] = React.useState(false);
    const triggerRef = React.useRef(null);
    const [popupPosition, setPopupPosition] = React.useState({top: 0, left: 0});
    const windowForm = context?.signals?.windowForm?.value || {};
    const metrics = context?.signals?.metrics?.value || context?.signals?.metrics?.peek?.() || {};
    const resolvedTimeZone = timeZoneSelector
        ? resolveSelector(metrics, timeZoneSelector) || timeZone
        : timeZone;
    const resolvedLifetimeStart = normalizeLifetimeStart(
        lifetimeStartSelector ? resolveSelector(metrics, lifetimeStartSelector) : lifetimeStart,
        lifetimeStart,
    );
    const start = String(windowForm[startField] || '');
    const end = String(windowForm[endField] || '');
    const invalid = !!start && !!end && start > end;
    const includePartialData = windowForm[includePartialDataField] !== false;
    const selected = options.find((option) => String(option.value) === String(value));
    const selectedLabel = selected?.label || item?.label || 'Select period';
    const triggerLabel = start && end
        ? `${selectedLabel}: ${formatDateRangeDay(start)} – ${formatDateRangeDay(end)}`
        : selectedLabel;
    const setDraftFields = (patch) => {
        if (!context?.signals?.windowForm) return;
        const previous = context.signals.windowForm.peek?.() || context.signals.windowForm.value || {};
        context.signals.windowForm.value = {...previous, ...patch};
    };
    const setDraftField = (field, nextValue) => setDraftFields({[field]: nextValue});
    React.useLayoutEffect(() => {
        if (String(value).toLowerCase() === 'custom') return;
        const resolved = resolveDateRangePreset(value, new Date(), resolvedLifetimeStart, resolvedTimeZone);
        if (!resolved) return;
        const current = context?.signals?.windowForm?.peek?.() || context?.signals?.windowForm?.value || {};
        if (current[startField] === resolved.start && current[endField] === resolved.end && current[granularityField] === resolved.granularity) return;
        setDraftFields({
            [startField]: resolved.start,
            [endField]: resolved.end,
            [granularityField]: resolved.granularity,
        });
    }, [value, context, startField, endField, granularityField, resolvedLifetimeStart, resolvedTimeZone]);
    const choosePreset = (option) => {
        if (String(option?.value).toLowerCase() === 'custom') return;
        const resolved = resolveDateRangePreset(option?.value, new Date(), resolvedLifetimeStart, resolvedTimeZone);
        if (resolved) {
            setDraftFields({
                [startField]: resolved.start,
                [endField]: resolved.end,
                [granularityField]: resolved.granularity,
            });
        }
        onChange?.(option?.value);
        setOpen(false);
    };
    const applyCustom = () => {
        if (!customApplyEnabled || !start || !end || invalid) return;
        const startDate = new Date(`${start}T00:00:00Z`);
        const endDate = new Date(`${end}T00:00:00Z`);
        const durationDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
        setDraftField(granularityField, durationDays <= 2 ? 'hour' : 'day');
        onChange?.('custom');
        setOpen(false);
    };
    const updatePopupPosition = React.useCallback(() => {
        const rect = triggerRef.current?.getBoundingClientRect?.();
        if (!rect || typeof window === 'undefined') return;
        const width = Math.min(360, Math.max(280, window.innerWidth - 32));
        setPopupPosition({
            top: Math.min(rect.bottom + 6, Math.max(16, window.innerHeight - 430)),
            left: Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16)),
        });
    }, []);
    React.useLayoutEffect(() => {
        if (!open || typeof window === 'undefined') return undefined;
        updatePopupPosition();
        window.addEventListener('resize', updatePopupPosition);
        window.addEventListener('scroll', updatePopupPosition, true);
        return () => {
            window.removeEventListener('resize', updatePopupPosition);
            window.removeEventListener('scroll', updatePopupPosition, true);
        };
    }, [open, updatePopupPosition]);

    return (
        <div className="forge-date-range-preset" style={{position: 'relative', minWidth: 0, width: '100%'}}>
            <Button
                ref={triggerRef}
                type="button"
                rightIcon={open ? 'chevron-up' : 'chevron-down'}
                aria-haspopup="dialog"
                aria-expanded={open}
                disabled={readOnly || disabled}
                onClick={() => setOpen((current) => !current)}
                style={{width: '100%', justifyContent: 'space-between'}}
            >
                {triggerLabel}
            </Button>
            {open && typeof document !== 'undefined' ? createPortal((
                <div
                    role="dialog"
                    aria-label={`${item?.label || 'Date range'} options`}
                    style={{
                        position: 'fixed',
                        top: popupPosition.top,
                        left: popupPosition.left,
                        zIndex: 3000,
                        width: 360,
                        maxWidth: 'min(360px, calc(100vw - 32px))',
                        border: '1px solid #d7dbe5',
                        borderRadius: 10,
                        background: '#ffffff',
                        boxShadow: '0 12px 30px rgba(31, 41, 55, 0.16)',
                        padding: 12,
                    }}
                >
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6}}>
                        {options.filter((option) => String(option.value).toLowerCase() !== 'custom').map((option) => (
                            <Button
                                key={option.value}
                                type="button"
                                minimal={String(option.value) !== String(value)}
                                intent={String(option.value) === String(value) ? 'primary' : 'none'}
                                alignText="left"
                                onClick={() => choosePreset(option)}
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>
                    <div style={{margin: '12px -12px', borderTop: '1px solid #e4e7ee'}} />
                    <div style={{fontSize: 12, fontWeight: 700, color: '#394257', marginBottom: 8}}>Custom dates</div>
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8}}>
                        <label style={{display: 'grid', gap: 4, fontSize: 11, color: '#596579'}}>
                            Start
                            <input
                                className="bp6-input"
                                type="date"
                                aria-label="Custom start date"
                                value={start}
                                max={end || undefined}
                                onChange={(event) => setDraftField(startField, event.target.value)}
                            />
                        </label>
                        <label style={{display: 'grid', gap: 4, fontSize: 11, color: '#596579'}}>
                            End
                            <input
                                className="bp6-input"
                                type="date"
                                aria-label="Custom end date"
                                value={end}
                                min={start || undefined}
                                onChange={(event) => setDraftField(endField, event.target.value)}
                            />
                        </label>
                    </div>
                    {invalid ? <div role="alert" style={{color: '#b42318', fontSize: 11, marginTop: 7}}>Start date must be on or before end date.</div> : null}
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10}}>
                        <span style={{display: 'grid', gap: 4, color: '#6c7587', fontSize: 10, lineHeight: 1.3}}>
                            <Checkbox
                                checked={includePartialData}
                                label="Include today's partial data"
                                onChange={(event) => setDraftField(includePartialDataField, event.target.checked)}
                            />
                            {customApplyEnabled ? null : customDisabledMessage}
                        </span>
                        <Button type="button" intent="primary" disabled={!customApplyEnabled || !start || !end || invalid} onClick={applyCustom}>
                            Apply dates
                        </Button>
                    </div>
                </div>
            ), document.body) : null}
        </div>
    );
}

const normalizeMultiValues = (value) => {
    if (Array.isArray(value)) return value.map((v) => `${v}`);
    if (typeof value === 'string') {
        return value.split(',').map((v) => v.trim()).filter(Boolean);
    }
    if (value && typeof value === 'object') {
        return Object.entries(value)
            .filter(([, selected]) => !!selected)
            .map(([key]) => `${key}`);
    }
    return [];
};

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

    /* -------------------- Local file selector -------------------- */
    registerWidget('file', ({onChange, readOnly, disabled, value, item, style, context, adapter, options, ...rest}) => {
        const selectedName = value && typeof value === 'object' ? value.name : String(value || '');
        return (
            <div style={{display: 'grid', gap: 6, width: '100%', ...(style || {})}}>
                <input
                    {...rest}
                    type="file"
                    accept={rest.accept || item?.accept || item?.properties?.accept || '.csv'}
                    disabled={disabled || readOnly}
                    onChange={onChange}
                    className={`bp6-input${rest.className ? ` ${rest.className}` : ''}`}
                />
                {selectedName ? <span style={{color: '#526579', fontSize: 12}}>Selected locally: {selectedName}</span> : null}
            </div>
        );
    }, {framework: 'blueprint'});

    registerEventAdapter('file', {
        onChange: ({adapter}) => (event) => {
            const file = event?.target?.files?.[0];
            adapter.set(file ? {name: file.name, size: file.size, type: file.type} : null);
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
        ({ value = '', onValueChange, readOnly, stepSize, minorStepSize, ...rest }) => {
            const resolvedMinorStepSize = minorStepSize ?? (
                Number.isFinite(stepSize) ? Math.min(0.1, stepSize) : undefined
            );
            return (
                <NumericInput
                    {...rest}
                    value={value ?? ''}
                    onValueChange={(v) => onValueChange?.(v)}
                    readOnly={readOnly}
                    stepSize={stepSize}
                    minorStepSize={resolvedMinorStepSize}
                />
            );
        },
        { framework: 'blueprint' }
    );

    registerEventAdapter('number', {
        onValueChange: ({ adapter }) => (v) => adapter.set(v),
    });

    /* -------------------- TextArea ---------------------------------- */
    registerWidget(
        'textarea',
        ({ value = '', onChange, readOnly, style, ...rest }) => (
            <TextArea
                {...rest}
                fill
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                readOnly={readOnly}
                style={{ minHeight: 96, resize: 'vertical', ...(style || {}) }}
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

    // Alias: provide explicit 'switch' control using the same implementation
    registerWidget('switch', ({ value = false, onChange, readOnly, ...rest }) => (
        <Switch
            {...rest}
            checked={!!value}
            onChange={(e) => onChange?.(e.target.checked)}
            disabled={readOnly}
        />
    ), { framework: 'blueprint' });
    registerWidget('booleanPill', (props) => <BooleanPill {...props}/>, { framework: 'blueprint' });
    registerWidget('chipList', (props) => <ChipList {...props}/>, { framework: 'blueprint' });

    const checkboxChangeHandler = ({ adapter }) => (arg) => {
        if (arg && arg.target) {
            adapter.set(arg.target.checked);
        } else {
            adapter.set(!!arg);
        }
    };

    registerEventAdapter('checkbox', {
        onChange: checkboxChangeHandler,
    });
    registerEventAdapter('toggle', {
        onChange: checkboxChangeHandler,
    });
    registerEventAdapter('switch', {
        onChange: checkboxChangeHandler,
    });
    registerEventAdapter('booleanPill', {
        onChange: ({ adapter }) => (value) => adapter.set(!!value),
    });
    registerEventAdapter('chipList', {
        onChange: ({ adapter }) => (values) => adapter.set(Array.isArray(values) ? values : []),
    });

    /* -------------------- Select / Dropdown ------------------------- */
    registerWidget(
        'select',
        function BPSelect({ value, onChange, readOnly, options = [], context, fill = false, id, 'aria-label': ariaLabel, ...rest }) {
            const visibleOptions = permittedOptions(options, context);
            const selected = visibleOptions.find((o) => o.value === value);
            return (
                <Select
                    items={visibleOptions}
                    fill={fill}
                    itemRenderer={(item, { handleClick, modifiers }) => (
                        <MenuItem key={item.value} text={item.label} active={modifiers.active} onClick={handleClick} />
                    )}
                    filterable={false}
                    disabled={readOnly}
                    popoverProps={{ minimal: true, matchTargetWidth: true, placement: 'bottom-start' }}
                    {...rest}
                    onItemSelect={(item) => onChange?.(item.value)}
                >
                    <Button id={id} aria-label={ariaLabel} fill={fill} text={selected?.label || rest.placeholder || 'Select…'} rightIcon="caret-down" disabled={readOnly} />
                </Select>
            );
        },
        { framework: 'blueprint' },
    );

    registerEventAdapter('select', {
        onChange: ({ adapter }) => (val) => adapter.set(val?.value ?? val),
        onItemSelect: ({ adapter }) => (val) => adapter.set(val?.value ?? val),
    });

    /* -------------------- Multi-select ------------------------------ */
    registerWidget(
        'multiSelect',
        function BPMultiSelect({
            value = [],
            onChange,
            onItemSelect,
            readOnly,
            options = [],
            appearance,
            placeholder,
            style,
            context,
            ...rest
        }) {
            const selectedValues = normalizeMultiValues(value);
            const selectedSet = new Set(selectedValues);
            const normalizedOptions = permittedOptions(options, context);
            const selectedItems = normalizedOptions.filter((opt) => selectedSet.has(`${opt?.value ?? ''}`));
            const toggle = (option) => {
                const optionValue = `${option?.value ?? ''}`;
                if (!optionValue) return;
                const next = selectedSet.has(optionValue)
                    ? selectedValues.filter((v) => v !== optionValue)
                    : [...selectedValues, optionValue];
                onItemSelect?.(option);
                onChange?.(next);
            };

            if (String(appearance || '').toLowerCase() === 'pills') {
                const pillContainerStyle = {
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    alignItems: 'center',
                    ...(style || {}),
                };
                return (
                    <div style={pillContainerStyle} className="forge-pills-container">
                        {normalizedOptions.map((opt) => {
                            const optionValue = `${opt?.value ?? ''}`;
                            const selected = selectedSet.has(optionValue);
                            return (
                                <Button
                                    key={optionValue}
                                    small
                                    disabled={readOnly}
                                    outlined={false}
                                    minimal={!selected}
                                    intent="none"
                                    style={{
                                        borderRadius: 999,
                                        minWidth: 34,
                                        height: 30,
                                        padding: '0 10px',
                                        background: selected ? '#e2e8f0' : 'transparent',
                                        boxShadow: selected ? 'inset 0 0 0 1px #cbd5e1' : 'none',
                                    }}
                                    onClick={() => toggle(opt)}
                                >
                                    {opt?.label || optionValue}
                                </Button>
                            );
                        })}
                    </div>
                );
            }

            const remove = (tag, index) => {
                const tagValue = `${tag?.value ?? tag ?? ''}`;
                const next = Number.isInteger(index)
                    ? selectedValues.filter((_, i) => i !== index)
                    : selectedValues.filter((v) => v !== tagValue);
                onChange?.(next);
            };

            return (
                <MultiSelect
                    {...rest}
                    items={normalizedOptions}
                    selectedItems={selectedItems}
                    disabled={readOnly}
                    fill
                    resetOnSelect
                    itemRenderer={(item, { handleClick, modifiers }) => (
                        <MenuItem
                            key={`${item?.value ?? ''}`}
                            text={item?.label || item?.value}
                            active={modifiers.active}
                            icon={selectedSet.has(`${item?.value ?? ''}`) ? 'tick' : 'blank'}
                            onClick={handleClick}
                            shouldDismissPopover={false}
                        />
                    )}
                    tagRenderer={(item) => item?.label || `${item?.value ?? ''}`}
                    tagInputProps={{
                        disabled: readOnly,
                        style: style || undefined,
                        inputProps: {
                            placeholder: selectedItems.length ? '' : (placeholder || 'Select...'),
                        },
                    }}
                    onItemSelect={toggle}
                    onRemove={remove}
                    popoverProps={{ minimal: true, matchTargetWidth: true, placement: 'bottom-start' }}
                />
            );
        },
        { framework: 'blueprint' },
    );

    registerEventAdapter('multiSelect', {
        onChange: ({ adapter }) => (vals) => adapter.set(normalizeMultiValues(vals)),
        onItemSelect: ({ adapter }) => (selected) => {
            const optionValue = `${selected?.value ?? selected ?? ''}`;
            if (!optionValue) return;
            const current = normalizeMultiValues(adapter.get());
            const hasValue = current.includes(optionValue);
            adapter.set(hasValue ? current.filter((v) => v !== optionValue) : [...current, optionValue]);
        },
    });

    /* -------------------- Read-only Link ---------------------------- */
    registerWidget(
        'link',
        ({ value = '', readOnly, context, link, text, appearance, className, style, title, ...rest }) => {
            const resolved = resolveLinkTarget({
                linkConfig: link,
                value,
                context,
            });
            const isInline = String(appearance || '').trim().toLowerCase() === 'inline';
            const inlineStyle = {
                color: '#2f6de1',
                cursor: readOnly ? 'default' : 'pointer',
                fontWeight: 500,
                textDecoration: 'none',
                ...(style || {}),
            };
            if (resolved?.kind === 'window') {
                const buttonText = resolved.text || text || resolved.windowTitle || resolved.windowKey;
                const baseWindowButtonStyle = {
                    ...inlineStyle,
                    background: 'rgba(47, 109, 225, 0.08)',
                    border: '1px solid rgba(47, 109, 225, 0.18)',
                    borderRadius: 999,
                    padding: '2px 10px',
                    lineHeight: 1.5,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                };
                const windowButtonStyle = isInline
                    ? baseWindowButtonStyle
                    : {
                        ...baseWindowButtonStyle,
                        background: '#f5f8fd',
                        border: '1px solid #d0daea',
                        color: '#2d5a9e',
                        minHeight: 30,
                        fontSize: 12,
                    };
                return (
                    <button
                        type="button"
                        className={className}
                        style={{ ...windowButtonStyle, ...(style || {}) }}
                        title={title || resolved.title || buttonText}
                        onClick={(event) => {
                            event.preventDefault();
                            context?.handlers?.window?.openTarget?.({ target: resolved, context });
                        }}
                        {...rest}
                    >
                        {buttonText}
                    </button>
                );
            }
            const href = resolved?.href || value;
            if (!href) return null;
            if (isInline) {
                return (
                    <a
                        href={href}
                        target={resolved?.target || "_blank"}
                        rel={resolved?.rel || "noopener noreferrer"}
                        className={className}
                        style={inlineStyle}
                        title={title || resolved?.title || resolved?.text || text || href}
                    >
                        {resolved?.text || text || href}
                    </a>
                );
            }
            return (
                <AnchorButton
                    href={href}
                    target={resolved?.target || "_blank"}
                    rel={resolved?.rel || "noopener noreferrer"}
                    text={resolved?.text || text || href}
                    minimal
                    className={className}
                    style={style}
                    title={title || resolved?.title || resolved?.text || text || href}
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

    /* -------------------- Fractional percent input ----------------- */
    registerWidget(
        'percentFraction2Input',
        ({ value = '', onValueChange, readOnly, ...rest }) => {
            const numericValue = formatPercentFraction2Input(value);
            return (
                <NumericInput
                    {...rest}
                    value={numericValue}
                    onValueChange={(valueAsNumber, valueAsString) => {
                        onValueChange?.(parsePercentFraction2Input(valueAsNumber, valueAsString));
                    }}
                    readOnly={readOnly}
                    min={0}
                    max={100}
                    stepSize={0.01}
                    minorStepSize={0.01}
                    rightElement={<span className="forge-percent-suffix" aria-hidden="true">%</span>}
                />
            );
        },
        { framework: 'blueprint' }
    );

    registerEventAdapter('percentFraction2Input', {
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

    /* -------------------- Date range ------------------------------- */
    registerWidget(
        'dateRange',
        ({ value, onChange, readOnly, disabled, item }) => {
            const range = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
            const start = String(range.start || '');
            const end = String(range.end || '');
            const invalid = !!start && !!end && start > end;
            const inputStyle = {
                minWidth: 0,
                width: '100%',
                borderRadius: 8,
            };
            return (
                <div
                    role="group"
                    aria-label={item?.label || item?.name || 'Date range'}
                    aria-invalid={invalid || undefined}
                    className={`forge-date-range-input${invalid ? ' is-invalid' : ''}`}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: 10,
                        border: `1px solid ${invalid ? '#c23030' : '#cbd5e1'}`,
                        borderRadius: 10,
                        background: readOnly || disabled ? '#f4f6f8' : '#ffffff',
                    }}
                    title={invalid ? 'Start date must be on or before end date.' : undefined}
                >
                    <input
                        className="bp6-input"
                        type="date"
                        aria-label="Start date"
                        value={start}
                        max={end || undefined}
                        readOnly={readOnly}
                        disabled={disabled}
                        style={inputStyle}
                        onChange={(event) => onChange?.({ ...range, start: event.target.value })}
                    />
                    <span aria-hidden="true" style={{ color: '#64748b', fontWeight: 600 }}>to</span>
                    <input
                        className="bp6-input"
                        type="date"
                        aria-label="End date"
                        value={end}
                        min={start || undefined}
                        readOnly={readOnly}
                        disabled={disabled}
                        style={inputStyle}
                        onChange={(event) => onChange?.({ ...range, end: event.target.value })}
                    />
                </div>
            );
        },
        { framework: 'blueprint' }
    );

    registerEventAdapter('dateRange', {
        onChange: ({ adapter }) => (range) => adapter.set(range),
    });

    registerWidget('dateRangePreset', DateRangePresetInput, { framework: 'blueprint' });
    registerEventAdapter('dateRangePreset', {
        onChange: ({ adapter }) => (period) => adapter.set(period),
    });

    /* -------------------- Radio group ------------------------------- */
    registerWidget('radio', ({ value, onChange, readOnly, options = [], appearance, ...rest }) => {
        if (String(appearance || '').toLowerCase() === 'segmented') {
            return (
                <div
                    role="group"
                    className="forge-segmented-control"
                    style={{
                        display: 'inline-flex',
                        borderRadius: 10,
                        overflow: 'hidden',
                        border: '1px solid #d0d9ea',
                        background: '#eef2f8',
                        padding: 3,
                        gap: 2,
                    }}
                >
                    {options.map((opt) => {
                        const isActive = String(value) === String(opt.value);
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                disabled={readOnly}
                                aria-pressed={isActive}
                                style={{
                                    borderRadius: 7,
                                    fontWeight: isActive ? 700 : 500,
                                    fontSize: 13,
                                    padding: '4px 16px',
                                    background: isActive ? '#ffffff' : 'transparent',
                                    color: isActive ? '#1e3f8a' : '#607089',
                                    boxShadow: isActive ? '0 1px 5px rgba(30,63,138,0.14), 0 0 0 1px rgba(200,216,240,0.6)' : 'none',
                                    border: 'none',
                                    transition: 'all 0.15s ease',
                                    cursor: readOnly ? 'not-allowed' : 'pointer',
                                    whiteSpace: 'nowrap',
                                    minHeight: 30,
                                    fontFamily: 'inherit',
                                }}
                                onClick={() => !readOnly && onChange?.(opt.value)}
                            >
                                {opt.label || opt.value}
                            </button>
                        );
                    })}
                </div>
            );
        }
        return (
            <RadioGroup
                {...rest}
                disabled={readOnly}
                selectedValue={`${value}`}
                onChange={(e) => onChange?.(e)}
            >
                {options.map((opt) => (
                    <Radio key={opt.value} label={opt.label} value={opt.value} />
                ))}
            </RadioGroup>
        );
    }, { framework: 'blueprint' });

    registerEventAdapter('radio', {
        onChange: ({ adapter }) => (e) => adapter.set(e?.target?.value ?? e),
    });

    /* -------------------- TreeMultiSelect --------------------------- */
    registerWidget(
        'treeMultiSelect',
        (props) => {
            const { value = [], onChange, readOnly, options = [], separator, ...rest } = props
            const { properties = {} } = props
            const sep = (separator !== undefined && separator !== null) ? separator : (properties.separator || '_');
            return (<TreeMultiSelect
                {...rest}
                options={options}
                value={value}
                onChange={onChange}
                readOnly={readOnly}
                separator={sep}
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
    registerWidget('button', ({ onClick, readOnly, intent, children, className, style, title, item, ...rest }) => {
        const intentColors = {
            primary: { background: '#2f6de1', border: '#2f6de1', color: '#fff' },
            success: { background: '#0f9960', border: '#0f9960', color: '#fff' },
            warning: { background: '#d9822b', border: '#d9822b', color: '#fff' },
            danger: { background: '#db3737', border: '#db3737', color: '#fff' },
        };
        const palette = intentColors[String(intent || '').trim().toLowerCase()] || null;
        return (
            <button
                type="button"
                className={className}
                disabled={readOnly}
                title={title}
                onClick={onClick}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    minHeight: 30,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: `1px solid ${palette?.border || '#d0daea'}`,
                    background: palette?.background || '#f5f8fd',
                    color: palette?.color || '#2d5a9e',
                    cursor: readOnly ? 'default' : 'pointer',
                    font: 'inherit',
                    fontWeight: 600,
                    lineHeight: 1.2,
                    ...(style || {}),
                }}
                {...rest}
            >
                {children || item?.label || title}
            </button>
        );
    }, { framework: 'blueprint' });

    registerEventAdapter('button', {
        onClick: () => () => {},
    });

    /* -------------------- Label ------------------------------------- */
    registerWidget('label', ({ value, format, locale, timeZone, item, ...rest }) => {
        const hasBoundValue = value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '');
        const shouldRenderEmptyState = !!item?.dataField && !hasBoundValue;
        const inferredIdFormat = format === undefined && (
            /\bID\b/i.test(String(item?.label || ''))
            || /Id(Display)?$/i.test(String(item?.id || ''))
        )
            ? 'raw'
            : format;
        if (shouldRenderEmptyState) {
            return (
                <Label {...rest}>
                    <span style={{ color: '#8a9ba8', fontStyle: 'italic' }}>{resolveEmptyDisplayText(item)}</span>
                </Label>
            );
        }
        const mappedValue = mapDisplayValue(value, item?.valueMap);
        return (
            <Label {...rest}>{formatDisplayValue(mappedValue, inferredIdFormat, locale, {timeZone})}</Label>
        );
    }, { framework: 'blueprint' });

    /* -------------------- Formula input ----------------------------- */
    // Keep the legacy `math` metadata key without loading MathQuill or
    // requiring browser globals during server-side rendering and tests.
    registerWidget('math', TextInput, { framework: 'blueprint' });

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

    /* -------------------- Markdown (viewer) ------------------------ */
    registerWidget(
        'markdown',
        ({ value = '', ...rest }) => (
            <MarkdownView value={value ?? ''} {...rest} />
        ),
        { framework: 'blueprint' }
    );

    /* -------------------- Document (Markdown editor - EasyMDE) ---- */
    registerWidget(
        'document',
        ({ value = '', onChange, readOnly, disabled, options = {}, ...rest }) => (
            <MarkdownEditor
                value={value ?? ''}
                onChange={onChange}
                readOnly={readOnly}
                disabled={disabled}
                options={options}
                {...rest}
            />
        ),
        { framework: 'blueprint' }
    );

    registerEventAdapter('document', {
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
                labelInfo={(item?.required || item?.properties?.required) ? <span aria-hidden="true">*</span> : undefined}
                inline={inline}
                labelFor={item.id}
                helperText={item.validationError || item.helperText || item.description}
                intent={item.validationError ? 'danger' : 'none'}
                style={{ marginBottom: 0 }}
            >
                {children}
            </FormGroup>
        );
});
