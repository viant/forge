import {useRegisteredControlActions} from '../../runtime/useRegisteredControlActions.js';
import {isLiveControlVisible,validateWidgetControlValue} from '../../core/ui/controlActions.js';
import {preserveSelectExternalFocus} from './selectCloseFocus.js';
import {inheritFieldTrackSelectTokens} from './selectPortalTokens.js';
import SwitchControl from '../../components/SwitchControl.jsx';
import ForgeFormGroup from './ForgeFormGroup.jsx';
import './theme.css';
/* -------------------------------------------------------------------------
 * Blueprint Pack – Phase 2
 * -------------------------------------------------------------------------
 * Registers a minimal text input widget with the new widget runtime.  This
 * proves the end-to-end flow while other controls stay on the legacy
 * ControlRenderer.
 * ---------------------------------------------------------------------- */

import React from 'react';
import {batch} from '@preact/signals-react';
import {fileToMCPBlob} from './fileBlob.js';
import {createPortal} from 'react-dom';
import {
    InputGroup,
    Checkbox,
    Switch,
    Button,
    Icon,
    MenuItem,
    TextArea,
    RadioGroup,
    Radio,
    ProgressBar,
    Label,
    Tooltip,
    AnchorButton,
    FileInput,
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
import { normalizeDateInputValue, serializeDateInputValue } from './civilDate.js';
import { registerWrapper } from '../../runtime/wrapperRegistry.js';
import TreeMultiSelect from '../../components/TreeMultiSelect.jsx';
import MarkdownView from '../../components/MarkdownView.jsx';
import MarkdownEditor from '../../components/MarkdownEditor.jsx';
import { formatDisplayValue, mapDisplayValue, resolveEmptyDisplayText } from '../../utils/formatValue.js';
import { resolveLinkTarget } from '../../utils/linkTarget.js';
import { permittedOptions } from './permittedOptions.js';
import ChipList from '../../components/ChipList.jsx';
import ContentCarousel from '../../components/content/ContentCarousel.jsx';
import CardRail from '../../components/content/CardRail.jsx';
import CardRailGroup from '../../components/content/CardRailGroup.jsx';
import FilterChips from '../../components/content/FilterChips.jsx';
import {currencyInputIcon} from '../../utils/currency.js';
import MediaPreviewPopover from '../../components/MediaPreviewPopover.jsx';
import MediaPreview from '../../components/MediaPreview.jsx';
import ArrayFields from '../../components/primitives/ArrayFields.jsx';
import {formatPercentFraction2Input, parsePercentFraction2Input} from './percentFractionInput.js';
import {resolveSelector} from '../../utils/selector.js';
import {normalizeLifetimeStart, resolveDateRangePreset, resolveDateRangePresetSyncPatch} from './dateRangePreset.js';
import {commitSelectOption, isSelectOptionDisabled} from './selectOptionModel.js';
import {resolveNumericInputMinorStepSize} from './numericInputSteps.js';

const numericInputValue = (valueAsNumber, valueAsString, nullable) => {
    const text = String(valueAsString ?? '').trim();
    if (!text || text === 'NaN') return nullable ? null : '';
    return Number.isFinite(valueAsNumber) ? valueAsNumber : text;
};

/* ------------------------ Widget implementation ----------------------- */

const mergeClassNames = (...classNames) => classNames.filter(Boolean).join(' ') || undefined;

const isFieldTrackControl = (value) => value === true || value === 'true';

const resolveFieldTrackFill = (fieldTrackControl, fill) => (
    isFieldTrackControl(fieldTrackControl) && fill === undefined ? true : fill
);

const defaultSelectItemPredicate = (query, item, _index, exactMatch = false) => {
    const normalizedQuery = String(query || '').trim().toLocaleLowerCase();
    if (!normalizedQuery) return true;
    const candidates = [item?.label, item?.value, item?.secondary]
        .filter((candidate) => candidate !== undefined && candidate !== null)
        .map((candidate) => String(candidate).toLocaleLowerCase());
    return exactMatch
        ? candidates.some((candidate) => candidate === normalizedQuery)
        : candidates.some((candidate) => candidate.includes(normalizedQuery));
};

function TextInput({ value = '', onChange, readOnly, fill, ...rest }) {
    const resolvedFill = resolveFieldTrackFill(rest['data-forge-field-track-control'], fill);
    return (
        <InputGroup
            {...rest}
            fill={resolvedFill}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            readOnly={readOnly}
        />
    );
}

function BooleanPill({
    value = false,
    onChange,
    readOnly,
    disabled,
    item,
    ariaLabel,
    'aria-label': ariaLabelProp,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-required': ariaRequired,
    'aria-invalid': ariaInvalid,
    'data-forge-widget': forgeWidget,
    'data-forge-control-id': forgeControlId,
    'data-forge-part': forgePart,
    'data-forge-field-track-control': fieldTrackControl,
    id,
    title,
}) {
    const checked = !!value;
    return (
        <button id={id} title={title} type="button" role="switch" aria-checked={checked}
            aria-label={ariaLabel || ariaLabelProp || item?.label || item?.name || 'Boolean value'}
            aria-labelledby={fieldTrackControl ? ariaLabelledBy : undefined}
            aria-describedby={fieldTrackControl ? ariaDescribedBy : undefined}
            aria-required={fieldTrackControl ? ariaRequired : undefined}
            aria-invalid={fieldTrackControl ? ariaInvalid : undefined}
            data-forge-widget={fieldTrackControl ? forgeWidget : undefined}
            data-forge-control-id={fieldTrackControl ? forgeControlId : undefined}
            data-forge-part={fieldTrackControl ? forgePart : undefined}
            data-forge-field-track-control={fieldTrackControl}
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
    const [customDraft, setCustomDraft] = React.useState(() => ({start, end}));
    const invalid = !!customDraft.start && !!customDraft.end && customDraft.start > customDraft.end;
    const includePartialData = windowForm[includePartialDataField] !== false;
    const selected = options.find((option) => String(option.value) === String(value));
    const selectedLabel = selected?.label || item?.label || 'Select period';
    const triggerLabel = start && end
        ? `${selectedLabel}: ${formatDateRangeDay(start)} – ${formatDateRangeDay(end)}`
        : selectedLabel;
    const setAppliedFields = (patch) => {
        if (!context?.signals?.windowForm) return;
        const previous = context.signals.windowForm.peek?.() || context.signals.windowForm.value || {};
        context.signals.windowForm.value = {...previous, ...patch};
    };
    const setAppliedField = (field, nextValue) => setAppliedFields({[field]: nextValue});
    React.useLayoutEffect(() => {
        if (String(value).toLowerCase() === 'custom') return;
        const resolved = resolveDateRangePreset(value, new Date(), resolvedLifetimeStart, resolvedTimeZone);
        if (!resolved) return;
        const current = context?.signals?.windowForm?.peek?.() || context?.signals?.windowForm?.value || {};
        const patch = resolveDateRangePresetSyncPatch(current, resolved, {startField, endField, granularityField});
        if (patch) setAppliedFields(patch);
    }, [value, context, startField, endField, granularityField, resolvedLifetimeStart, resolvedTimeZone]);
    const choosePreset = (option, strict=false) => {
        if (String(option?.value).toLowerCase() === 'custom') return;
        const resolved = resolveDateRangePreset(option?.value, new Date(), resolvedLifetimeStart, resolvedTimeZone);
        const result=batch(() => {
            if (resolved) {
                setAppliedFields({
                    [startField]: resolved.start,
                    [endField]: resolved.end,
                    [granularityField]: resolved.granularity,
                });
            }
            return (strict && onChange?.operate?onChange.operate:onChange)?.(option?.value);
        });
        setOpen(false);return result;
    };
    const applyCustomDraft = (draft,strict=false) => {
        if (!customApplyEnabled || !draft.start || !draft.end || draft.start > draft.end) return false;
        const error=validateWidgetControlValue(draft,{item:{widget:'dateRange'},props:{}});if(error)throw new Error(error);
        const startDate = new Date(`${draft.start}T00:00:00Z`),endDate = new Date(`${draft.end}T00:00:00Z`);
        const durationDays = Math.floor((endDate.getTime()-startDate.getTime())/86400000)+1;
        const result=batch(()=>{
            setAppliedFields({[startField]:draft.start,[endField]:draft.end,[granularityField]:durationDays<=2?'hour':'day'});
            return (strict && onChange?.operate?onChange.operate:onChange)?.('custom');
        });
        setOpen(false);return result;
    };
    const applyCustom = () => applyCustomDraft(customDraft);
    const toggleOpen=()=>{if(!open)setCustomDraft({start,end});setOpen(previous=>!previous);};
    useRegisteredControlActions({windowId:context?.identity?.windowId,dataSourceRef:context?.identity?.dataSourceRef,controlId:item?.id,scope:item?.scope || 'form',dataField:item?.dataField,bindingPath:item?.bindingPath || item?.id,type:'dateRangePreset'},()=>({
        visible:isLiveControlVisible(triggerRef.current),disabled:disabled===true,readOnly:readOnly===true,value,options,
        constraints:{customApplyEnabled,startField,endField,granularityField},
        actions:{click:toggleOpen,focus:()=>{triggerRef.current?.focus?.();return document.activeElement===triggerRef.current;},setValue:({value:next})=>{
            if(next && typeof next==='object' && !Array.isArray(next)) {if(!customApplyEnabled)throw new Error(customDisabledMessage);return applyCustomDraft(next,true);}
            const option=options.find(option=>Object.is(option.value,next)&&option.disabled!==true&&String(option.value).toLowerCase()!=='custom');
            if(!option)throw new Error('preset is unavailable; custom requires explicit start/end');
            return choosePreset(option,true);
        }}
    }),`${disabled}:${readOnly}:${open}`);
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
                onClick={toggleOpen}
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
                                value={customDraft.start}
                                max={customDraft.end || undefined}
                                onChange={(event) => setCustomDraft(previous => ({...previous, start: event.target.value}))}
                            />
                        </label>
                        <label style={{display: 'grid', gap: 4, fontSize: 11, color: '#596579'}}>
                            End
                            <input
                                className="bp6-input"
                                type="date"
                                aria-label="Custom end date"
                                value={customDraft.end}
                                min={customDraft.start || undefined}
                                onChange={(event) => setCustomDraft(previous => ({...previous, end: event.target.value}))}
                            />
                        </label>
                    </div>
                    {invalid ? <div role="alert" style={{color: '#b42318', fontSize: 11, marginTop: 7}}>Start date must be on or before end date.</div> : null}
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10}}>
                        <span style={{display: 'grid', gap: 4, color: '#6c7587', fontSize: 10, lineHeight: 1.3}}>
                            <Checkbox
                                className="forge-blueprint-checkbox-compat"
                                checked={includePartialData}
                                label="Include today's partial data"
                                onChange={(event) => setAppliedField(includePartialDataField, event.target.checked)}
                            />
                            {customApplyEnabled ? null : customDisabledMessage}
                        </span>
                        <Button type="button" intent="primary" disabled={!customApplyEnabled || !customDraft.start || !customDraft.end || invalid} onClick={applyCustom}>
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
        const fileInputRef = React.useRef(null);
        const multiple = item?.multiple === true || item?.properties?.multiple === true;
        const selectedName = Array.isArray(value) ? value.map(file => file?.filename || file?.name).filter(Boolean).join(', ') : value && typeof value === 'object' ? value.name : String(value || '');
        React.useEffect(() => {
            if (!selectedName && fileInputRef.current) {
                fileInputRef.current.value = '';
                fileInputRef.current.forgeFileSelection = (fileInputRef.current.forgeFileSelection || 0) + 1;
            }
        }, [selectedName]);
        return (
            <div className="forge-file-control" style={style}>
                <FileInput
                    fill
                    className="forge-file-control__input"
                    text={selectedName || 'No file selected'}
                    buttonText="Browse"
                    hasSelection={!!selectedName}
                    disabled={disabled || readOnly}
                    inputProps={{
                        ...rest,
                        accept: rest.accept || item?.accept || item?.properties?.accept || '.csv',
                        multiple,
                        ref: fileInputRef,
                    }}
                    onInputChange={onChange}
                />
                {selectedName ? (
                    <Button
                        minimal
                        small
                        icon="cross"
                        aria-label="Clear selected file"
                        title="Clear selected file"
                        disabled={disabled || readOnly}
                        onClick={() => {
                            if (fileInputRef.current) { fileInputRef.current.value = ''; fileInputRef.current.forgeFileSelection = (fileInputRef.current.forgeFileSelection || 0) + 1; }
                            adapter?.set?.(multiple ? [] : null);
                            // Use the same encoded-state/authored-event pipeline
                            // as a file selection so dependent validation refreshes.
                            if (fileInputRef.current) onChange?.({target: fileInputRef.current});
                        }}
                    />
                ) : null}
            </div>
        );
    }, {framework: 'blueprint'});

    registerEventAdapter('file', {
        onChange: ({adapter}) => async (event) => {
            const input = event?.target;
            if (!input) return;
            const generation = (input.forgeFileSelection || 0) + 1;
            input.forgeFileSelection = generation;
            const files = Array.from(input.files || []);
            const encoded = input.multiple ? await Promise.all(files.map(fileToMCPBlob)) : await fileToMCPBlob(files[0]);
            if (input.forgeFileSelection === generation) adapter.set(encoded);
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
        onBlur: () => () => {},
        onChange: ({ adapter }) => (e) => {
            const val = e?.target?.value ?? e;
            adapter.set(val);
        },
    });

    /* -------------------- Numeric / Number -------------------------- */

    /* -------------------- Number / Numeric input ------------------- */
    registerWidget(
        'number',
        ({ value = '', onValueChange, readOnly, nullable = false, min, stepSize, minorStepSize, fill, buttonPosition, className, ...rest }) => {
            const empty = nullable && (value === '' || value === null || value === undefined);
            const resolvedMinorStepSize = resolveNumericInputMinorStepSize(stepSize, minorStepSize);
            const fieldTrackControl = isFieldTrackControl(rest['data-forge-field-track-control']);
            return (
                <NumericInput
                    {...rest}
                    className={fieldTrackControl
                        ? mergeClassNames('forge-field-track-number', className)
                        : className}
                    fill={resolveFieldTrackFill(fieldTrackControl, fill)}
                    buttonPosition={fieldTrackControl && buttonPosition === undefined ? 'none' : buttonPosition}
                    value={empty ? '' : (value ?? '')}
                    min={nullable ? undefined : min}
                    onValueChange={(valueAsNumber, valueAsString) => {
                        onValueChange?.(numericInputValue(valueAsNumber, valueAsString, nullable));
                    }}
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
        ({ value = '', onChange, readOnly, style, className, ...rest }) => (
            <TextArea
                {...rest}
                fill
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                readOnly={readOnly}
                className={['forge-textarea', className].filter(Boolean).join(' ')}
                style={style}
            />
        ),
        { framework: 'blueprint' }
    );

    registerEventAdapter('textarea', {
        onBlur: () => () => {},
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
        ({ value = false, onChange, readOnly, disabled, className, ...rest }) => (
            <Checkbox
                {...rest}
                className={[className, 'forge-blueprint-checkbox-compat'].filter(Boolean).join(' ')}
                checked={!!value}
                onChange={(e) => onChange?.(e.target.checked)}
                disabled={disabled || readOnly}
            />
        ),
        { framework: 'blueprint' }
    );

    registerWidget('toggle', ({ value = false, onChange, readOnly, disabled, type: _type, widget: _widget, ...rest }) => (
        <Switch
            {...rest}
            checked={!!value}
            onChange={(e) => onChange?.(e.target.checked)}
            disabled={disabled || readOnly}
        />
    ), { framework: 'blueprint' });

    // Explicit switch uses a small native button shell so it remains visually
    // stable even when host and embedded Blueprint CSS versions differ.
    registerWidget('switch', SwitchControl, { framework: 'blueprint' });
    registerWidget('booleanPill', (props) => <BooleanPill {...props}/>, { framework: 'blueprint' });
    registerWidget('chipList', (props) => <ChipList {...props}/>, { framework: 'blueprint' });
    registerWidget('contentCarousel', props => <ContentCarousel {...props}/>, {framework: 'blueprint'});
    registerWidget('cardRail', props => <CardRail {...props}/>, {framework: 'blueprint'});
    registerWidget('cardRailGroup', props => <CardRailGroup {...props}/>, {framework: 'blueprint'});
    registerWidget('filterChips', props => <FilterChips {...props}/>, {framework: 'blueprint'});
    for (const key of ['contentCarousel', 'cardRail', 'cardRailGroup']) registerEventAdapter(key, {
        onClick: () => () => {}, onTagClick: () => () => {}, onCountClick: () => () => {}
    });
    registerEventAdapter('filterChips', {onChange: ({adapter}) => values => adapter.set(values)});

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
        function BPSelect({
            value,
            onChange,
            onOptionsRequest,
            optionsFetchStatus,
            onFocus,
            onClick,
            onKeyDown,
            readOnly,
            disabled,
            options = [],
            context,
            fill,
            filterable,
            alignText,
            itemListPredicate,
            itemPredicate,
            itemRenderer,
            noResults,
            inputProps,
            menuProps,
            popoverContentProps,
            popoverProps,
            popoverTargetProps,
            placeholder,
            id,
            'aria-label': ariaLabel,
            'aria-labelledby': ariaLabelledBy,
            'aria-describedby': ariaDescribedBy,
            'aria-required': ariaRequired,
            'aria-invalid': ariaInvalid,
            'data-forge-widget': forgeWidget,
            'data-forge-control-id': forgeControlId,
            'data-forge-part': forgePart,
            'data-forge-field-track-control': fieldTrackControl,
            ...rest
        }) {
            const triggerRef = React.useRef(null);
            const visibleOptions = permittedOptions(options, context);
            const selected = visibleOptions.find((o) => String(o.value) === String(value));
            const isFieldTrack = isFieldTrackControl(fieldTrackControl);
            const resolvedFill = resolveFieldTrackFill(isFieldTrack, fill);
            const resolvedFilterable = filterable === undefined
                ? (isFieldTrack && visibleOptions.length >= 10)
                : filterable;
            const unavailable = readOnly || disabled;
            const selectRest = isFieldTrack ? rest : {
                ...rest,
                ...(ariaLabelledBy !== undefined ? {'aria-labelledby': ariaLabelledBy} : {}),
                ...(ariaDescribedBy !== undefined ? {'aria-describedby': ariaDescribedBy} : {}),
                ...(ariaRequired !== undefined ? {'aria-required': ariaRequired} : {}),
                ...(ariaInvalid !== undefined ? {'aria-invalid': ariaInvalid} : {}),
                ...(forgeWidget !== undefined ? {'data-forge-widget': forgeWidget} : {}),
                ...(forgeControlId !== undefined ? {'data-forge-control-id': forgeControlId} : {}),
                ...(forgePart !== undefined ? {'data-forge-part': forgePart} : {}),
            };
            const defaultPopoverProps = {minimal: true, matchTargetWidth: true, placement: 'bottom-start'};
            const requestOptions = reason => {
                if (!unavailable) onOptionsRequest?.(reason);
            };
            const opening = (...args) => {
                if (isFieldTrack) inheritFieldTrackSelectTokens(args[0], triggerRef.current);
                requestOptions('open');
                popoverProps?.onOpening?.(...args);
            };
            const resolvedPopoverProps = isFieldTrack ? {
                ...defaultPopoverProps,
                ...popoverProps,
                popoverClassName: mergeClassNames(
                    'forge-field-track-select-popover',
                    popoverProps?.popoverClassName,
                ),
                portalClassName: mergeClassNames(
                    'forge-field-track-select-portal',
                    popoverProps?.portalClassName,
                ),
            } : (popoverProps === undefined ? defaultPopoverProps : popoverProps);
            const lazyPopoverProps = isFieldTrack || onOptionsRequest ? {...resolvedPopoverProps, onOpening: opening} : resolvedPopoverProps;
            const focusSafePopoverProps = {...lazyPopoverProps, onClosing: node => {
                preserveSelectExternalFocus(node, triggerRef.current);
                lazyPopoverProps?.onClosing?.(node);
            }};
            const resolvedPopoverTargetProps = isFieldTrack ? {
                ...popoverTargetProps,
                className: mergeClassNames(
                    'forge-field-track-select-target',
                    popoverTargetProps?.className,
                ),
            } : popoverTargetProps;
            const resolvedMenuProps = isFieldTrack ? {
                ...menuProps,
                className: mergeClassNames(
                    'forge-field-track-select-menu',
                    menuProps?.className,
                ),
            } : menuProps;
            const resolvedInputProps = resolvedFilterable ? {
                type: 'search',
                role: 'searchbox',
                ...inputProps,
                className: mergeClassNames(
                    isFieldTrack && 'forge-field-track-select-search',
                    inputProps?.className,
                ),
                'aria-label': inputProps?.['aria-label'] || `Search ${ariaLabel || rest.item?.label || 'options'}`,
            } : inputProps;
            const resolvedItemPredicate = resolvedFilterable
                && itemPredicate === undefined
                && itemListPredicate === undefined
                ? defaultSelectItemPredicate
                : itemPredicate;
            const defaultItemRenderer = (item, {handleClick, modifiers}) => (
                <MenuItem
                    key={item.value}
                    text={item.label}
                    htmlTitle={item.tooltip || undefined}
                    active={modifiers.active}
                    disabled={isSelectOptionDisabled(item)}
                    onClick={isSelectOptionDisabled(item) ? undefined : handleClick}
                />
            );
            const fieldTrackItemRenderer = (item, {handleClick, handleFocus, id: itemId, modifiers, ref}) => (
                <MenuItem
                    key={item.value}
                    ref={ref}
                    id={itemId}
                    className="forge-field-track-select-option"
                    text={item.label}
                    htmlTitle={item.tooltip || undefined}
                    active={modifiers.active}
                    disabled={isSelectOptionDisabled(item)}
                    roleStructure="listoption"
                    selected={String(item.value) === String(value)}
                    onFocus={handleFocus}
                    onClick={isSelectOptionDisabled(item) ? undefined : handleClick}
                />
            );
            const resolvedNoResults = resolvedFilterable && noResults === undefined ? (
                <MenuItem
                    className={isFieldTrack ? "forge-field-track-select-option forge-field-track-select-empty" : undefined}
                    disabled
                    roleStructure={isFieldTrack ? "listoption" : undefined}
                    text="No matching options"
                />
            ) : noResults;
            return (
                <Select
                    {...selectRest}
                    items={visibleOptions}
                    fill={resolvedFill}
                    itemRenderer={isFieldTrack ? fieldTrackItemRenderer : (itemRenderer || defaultItemRenderer)}
                    filterable={resolvedFilterable}
                    itemListPredicate={itemListPredicate}
                    itemPredicate={resolvedItemPredicate}
                    noResults={optionsFetchStatus === 'loading' || optionsFetchStatus === 'error'
                        ? <MenuItem disabled text={optionsFetchStatus === 'loading' ? 'Loading options…' : 'Options could not be loaded. Open again to retry.'}/>
                        : resolvedNoResults}
                    disabled={unavailable}
                    inputProps={resolvedInputProps}
                    menuProps={resolvedMenuProps}
                    popoverContentProps={popoverContentProps}
                    popoverProps={focusSafePopoverProps}
                    popoverTargetProps={resolvedPopoverTargetProps}
                    placeholder={placeholder}
                    onItemSelect={(item) => commitSelectOption(item, onChange)}
                >
                    <Button
                        ref={triggerRef}
                        id={id}
                        aria-label={ariaLabel}
                        aria-labelledby={fieldTrackControl ? ariaLabelledBy : undefined}
                        aria-describedby={fieldTrackControl ? ariaDescribedBy : undefined}
                        aria-required={fieldTrackControl ? ariaRequired : undefined}
                        aria-invalid={fieldTrackControl ? ariaInvalid : undefined}
                        data-forge-widget={forgeWidget}
                        data-forge-control-id={forgeControlId}
                        data-forge-part={forgePart}
                        data-forge-field-track-control={fieldTrackControl}
                        fill={resolvedFill}
                        alignText={alignText ?? (isFieldTrack ? 'start' : undefined)}
                        ellipsizeText={isFieldTrack || undefined}
                        text={selected?.label || (onOptionsRequest && value !== '' && value != null ? String(value) : placeholder || 'Select…')}
                        onFocus={event => { requestOptions('focus'); onFocus?.(event); }}
                        onClick={event => { requestOptions('open'); onClick?.(event); }}
                        onKeyDown={event => {
                            if (['Enter', ' ', 'ArrowDown'].includes(event.key)) requestOptions('open');
                            onKeyDown?.(event);
                        }}
                        rightIcon="caret-down"
                        disabled={unavailable}
                    />
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
            onOptionsRequest,
            optionsFetchStatus,
            onFocus,
            onClick,
            onKeyDown,
            id,
            'aria-label': ariaLabel,
            'aria-labelledby': ariaLabelledBy,
            readOnly,
            disabled,
            options = [],
            appearance,
            placeholder,
            style,
            context,
            ...rest
        }) {
            const unavailable = !!(readOnly || disabled);
            const requestOptions = reason => { if (!unavailable) onOptionsRequest?.(reason); };
            const lazyGroup = onOptionsRequest ? {id, role: 'group', 'aria-label': ariaLabel,
                'aria-labelledby': ariaLabelledBy, tabIndex: unavailable ? -1 : 0,
                onFocusCapture: () => requestOptions('focus'), onClick: () => requestOptions('open')} : {id};
            const selectedValues = normalizeMultiValues(value);
            const selectedSet = new Set(selectedValues);
            const normalizedOptions = permittedOptions(options, context);
            const selectedItems = onOptionsRequest
                ? selectedValues.map(selected => normalizedOptions.find(opt => String(opt?.value ?? '') === selected)
                    || {value: selected, label: selected})
                : normalizedOptions.filter((opt) => selectedSet.has(`${opt?.value ?? ''}`));
            const toggle = (option) => {
                const optionValue = `${option?.value ?? ''}`;
                if (!optionValue) return;
                const next = selectedSet.has(optionValue)
                    ? selectedValues.filter((v) => v !== optionValue)
                    : [...selectedValues, optionValue];
                onItemSelect?.(option);
                onChange?.(next);
            };

            if (String(appearance || '').toLowerCase() === 'checkboxes') {
                const checkboxContainerStyle = {
                    display: 'flex',
                    flexWrap: 'wrap',
                    columnGap: 18,
                    rowGap: 10,
                    alignItems: 'start',
                    ...(style || {}),
                };
                return (
                    <div {...lazyGroup} style={checkboxContainerStyle} className="forge-checkboxes-container">
                        {normalizedOptions.map((opt) => {
                            const optionValue = `${opt?.value ?? ''}`;
                            const optionLabel = opt?.label || optionValue;
                            return (
                                <label
                                    key={optionValue}
                                    style={{display: 'flex', alignItems: 'center', gap: 8, minWidth: 128, cursor: unavailable ? 'default' : 'pointer'}}
                                >
                                    <input
                                        type="checkbox"
                                        aria-label={optionLabel}
                                        checked={selectedSet.has(optionValue)}
                                        disabled={unavailable}
                                        style={{width: 16, height: 16, margin: 0, accentColor: '#2563eb'}}
                                        onChange={() => toggle(opt)}
                                    />
                                    <span>{optionLabel}</span>
                                </label>
                            );
                        })}
                    </div>
                );
            }

            if (String(appearance || '').toLowerCase() === 'pills') {
                const pillContainerStyle = {
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    alignItems: 'center',
                    ...(style || {}),
                };
                return (
                    <div {...lazyGroup} style={pillContainerStyle} className="forge-pills-container">
                        {normalizedOptions.map((opt) => {
                            const optionValue = `${opt?.value ?? ''}`;
                            const selected = selectedSet.has(optionValue);
                            const optionLabel = opt?.label || optionValue;
                            return (
                                <Button
                                    key={optionValue}
                                    aria-label={optionLabel}
                                    aria-pressed={selected}
                                    data-selected={selected ? 'true' : 'false'}
                                    small
                                    disabled={unavailable}
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
                                    <span className="forge-pill-label">{optionLabel}</span>
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
                    disabled={unavailable}
                    fill
                    resetOnSelect
                    noResults={optionsFetchStatus === 'loading' || optionsFetchStatus === 'error'
                        ? <MenuItem disabled text={optionsFetchStatus === 'loading' ? 'Loading options…' : 'Options could not be loaded. Open again to retry.'}/>
                        : rest.noResults}
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
                        disabled: unavailable,
                        style: style || undefined,
                        inputProps: {
                            id, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy,
                            onFocus: event => { requestOptions('focus'); onFocus?.(event); },
                            onClick: event => { requestOptions('open'); onClick?.(event); },
                            onKeyDown: event => {
                                if (['Enter', ' ', 'ArrowDown'].includes(event.key)) requestOptions('open');
                                onKeyDown?.(event);
                            },
                            placeholder: selectedItems.length ? '' : (placeholder || 'Select...'),
                        },
                    }}
                    onItemSelect={toggle}
                    onRemove={remove}
                    popoverProps={{ minimal: true, matchTargetWidth: true, placement: 'bottom-start', onOpening: () => requestOptions('open') }}
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
        ({ value = '', onValueChange, readOnly, currency = 'USD', nullable = false, min, stepSize, minorStepSize, majorStepSize, fill, buttonPosition, className, ...rest }) => {
            const empty = nullable && (value === '' || value === null || value === undefined);
            const resolvedMinorStepSize = resolveNumericInputMinorStepSize(stepSize, minorStepSize);
            const fieldTrackControl = isFieldTrackControl(rest['data-forge-field-track-control']);
            return (
                <NumericInput
                    {...rest}
                    className={fieldTrackControl
                        ? mergeClassNames('forge-field-track-number', className)
                        : className}
                    fill={resolveFieldTrackFill(fieldTrackControl, fill)}
                    buttonPosition={fieldTrackControl && buttonPosition === undefined ? 'none' : buttonPosition}
                    value={empty ? '' : (value ?? '')}
                    min={nullable ? undefined : min}
                    onValueChange={(valueAsNumber, valueAsString) => {
                        onValueChange?.(numericInputValue(valueAsNumber, valueAsString, nullable));
                    }}
                    readOnly={readOnly}
                    leftIcon={currencyInputIcon(currency)}
                    title={rest.title || String(currency).toUpperCase()}
                    aria-label={`${rest['aria-label'] || 'Amount'} (${String(currency).toUpperCase()})`}
                    stepSize={stepSize}
                    minorStepSize={resolvedMinorStepSize}
                    majorStepSize={majorStepSize}
                />
            );
        },
        { framework: 'blueprint' }
    );

    registerEventAdapter('currency', {
        onValueChange: ({ adapter }) => (v) => adapter.set(v),
    });

    registerWidget('arrayFields', props => <ArrayFields {...props}/>, {framework: 'blueprint'});
    registerEventAdapter('arrayFields', {onChange: ({adapter}) => value => adapter.set(value)});

    registerWidget('mediaPreviewPopover', (props) => <MediaPreviewPopover {...props} />, {framework: 'blueprint'});
    registerWidget('mediaPreview', (props) => <MediaPreview {...props} />, {framework: 'blueprint'});

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
            ({ value, onChange, readOnly, dateFnsFormat, valueMode, ...rest }) => (
                <DateInput3
                    {...buildDateProps({ type: kind, dateFnsFormat, valueMode }, { readOnly, properties: rest })}
                    timezone={valueMode === 'civil' ? 'UTC' : rest.timezone}
                    value={normalizeDateInputValue(value, valueMode)}
                    onChange={(sel) => onChange?.(serializeDateInputValue(sel, valueMode))}
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
        ({
            value,
            onChange,
            readOnly,
            disabled,
            item,
            id,
            'aria-label': ariaLabel,
            'aria-labelledby': ariaLabelledBy,
            'aria-describedby': ariaDescribedBy,
            'aria-required': ariaRequired,
            'aria-invalid': ariaInvalid,
            'data-forge-widget': forgeWidget,
            'data-forge-control-id': forgeControlId,
            'data-forge-part': forgePart,
            'data-forge-field-track-control': fieldTrackControl,
        }) => {
            const range = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
            const start = String(range.start || '');
            const end = String(range.end || '');
            const invalid = !!start && !!end && start > end;
            const exposedInvalid = invalid || (fieldTrackControl ? ariaInvalid : false) || undefined;
            const inputStyle = {
                minWidth: 0,
                width: '100%',
                borderRadius: 8,
            };
            return (
                <div
                    id={fieldTrackControl && id ? `${id}-group` : undefined}
                    role="group"
                    aria-label={fieldTrackControl
                        ? (ariaLabelledBy ? undefined : (ariaLabel || item?.label || item?.name || 'Date range'))
                        : (item?.label || item?.name || 'Date range')}
                    aria-labelledby={fieldTrackControl ? ariaLabelledBy : undefined}
                    aria-describedby={fieldTrackControl ? ariaDescribedBy : undefined}
                    aria-required={fieldTrackControl ? ariaRequired : undefined}
                    aria-invalid={exposedInvalid}
                    aria-disabled={fieldTrackControl ? ((readOnly || disabled) || undefined) : undefined}
                    data-forge-widget={fieldTrackControl ? forgeWidget : undefined}
                    data-forge-control-id={fieldTrackControl ? forgeControlId : undefined}
                    data-forge-part={fieldTrackControl ? forgePart : undefined}
                    data-forge-field-track-control={fieldTrackControl}
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
                        id={fieldTrackControl ? id : undefined}
                        className="bp6-input"
                        type="date"
                        aria-label="Start date"
                        aria-describedby={fieldTrackControl ? ariaDescribedBy : undefined}
                        aria-required={fieldTrackControl ? ariaRequired : undefined}
                        aria-invalid={fieldTrackControl ? exposedInvalid : undefined}
                        value={start}
                        max={end || undefined}
                        readOnly={readOnly}
                        disabled={disabled}
                        style={inputStyle}
                        onChange={(event) => onChange?.({ ...range, start: event.target.value })}
                    />
                    <span aria-hidden="true" style={{ color: '#64748b', fontWeight: 600 }}>to</span>
                    <input
                        id={fieldTrackControl && id ? `${id}-end` : undefined}
                        className="bp6-input"
                        type="date"
                        aria-label="End date"
                        aria-describedby={fieldTrackControl ? ariaDescribedBy : undefined}
                        aria-required={fieldTrackControl ? ariaRequired : undefined}
                        aria-invalid={fieldTrackControl ? exposedInvalid : undefined}
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
    registerWidget('radio', ({ value, onChange, readOnly, disabled, options = [], appearance, ...rest }) => {
        if (String(appearance || '').toLowerCase() === 'segmented') {
            return (
                <div
                    role="group"
                    id={rest.id}
                    aria-label={rest['aria-label']}
                    aria-labelledby={rest['aria-labelledby']}
                    aria-describedby={rest['aria-describedby']}
                    aria-errormessage={rest['aria-errormessage']}
                    className="forge-segmented-control"
                >
                    {options.map((opt) => {
                        const isActive = String(value) === String(opt.value);
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                disabled={disabled || readOnly}
                                aria-pressed={isActive}
                                className="forge-segmented-control__option"
                                onClick={() => !disabled && !readOnly && onChange?.(opt.value)}
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
                disabled={disabled || readOnly}
                selectedValue={`${value}`}
                onChange={(e) => onChange?.(e)}
            >
                {options.map((opt) => (
                    <Radio
                        key={opt.value}
                        className="forge-blueprint-radio-compat"
                        label={opt.label}
                        value={opt.value}
                    />
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
    registerWidget('button', ({ onClick, readOnly, disabled, intent, children, className, style, title, item, icon, hideLabel, ...rest }) => {
        const unavailable = readOnly === true || disabled === true;
        const variant = String(intent || '').trim().toLowerCase();
        const intentClass = ['primary','success','warning','danger'].includes(variant) ? `forge-button--${variant}` : '';
        const buttonClass = ['forge-button', hideLabel ? 'forge-button--icon-only' : '', intentClass, className].filter(Boolean).join(' ');
        return (
            <button
                type="button"
                className={buttonClass}
                disabled={unavailable}
                title={title}
                onClick={onClick}
                style={style}
                {...rest}
            >
                {icon ? <Icon icon={icon} size={14}/> : null}
                {hideLabel ? null : (children || item?.label || title)}
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
registerWrapper('blueprint', (item, container, children, context, accessibility = {}) => {
        const inline = (item.labelPosition || container?.layout?.labelPosition) === 'left';
        const required = !!(item?.required || item?.properties?.required);
        const requiredEditable = required && !(accessibility.readOnly ?? item?.readOnly) && !(accessibility.disabled ?? item?.disabled);
        // Stand-alone controls like button can disable FormGroup
        if (item.isStandalone) return <>{children}{item.validationError && <div
            id={accessibility.helperId} data-forge-part="validation-message" role="alert">{item.validationError}</div>}</>;

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
            <ForgeFormGroup
                className={[
                    requiredEditable ? 'forge-required-input' : '',
                    item?.requiredState ? `forge-required-${item.requiredState}` : '',
                ].filter(Boolean).join(' ') || undefined}
                label={labelContent}
                labelInfo={required ? <span aria-hidden="true">*</span> : undefined}
                inline={inline}
                labelFor={accessibility.controlId || item.id}
                labelId={accessibility.labelId}
                helperId={accessibility.helperId}
                helperText={item.validationError || item.helperText || item.description}
                intent={item.validationError ? 'danger' : 'none'}
                style={{ marginBottom: 0 }}
            >
                {children}
            </ForgeFormGroup>
        );
});
