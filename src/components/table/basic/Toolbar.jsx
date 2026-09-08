
import React from 'react';
import {Button, Checkbox, Menu, MenuItem, Popover, Switch} from '@blueprintjs/core';
import { useSignals } from '@preact/signals-react/runtime';
import QuickFilterInputs from './QuickFilterInputs.jsx';
import QuickFilterToggle from './QuickFilterToggle.jsx';
import PaginationBar from './PaginationBar.jsx';
import "./Toolbar.css";
import { useToolbarControlEvents } from '../../../hooks/event.js';
import { DateRangePresetInput } from '../../../packs/blueprint/index.jsx';
import {dispatchToolbarSelectChange, toolbarSelectLabel} from './toolbarSelect.js';
import {resolveSelector, setSelector} from '../../../utils/selector.js';
import {evaluatePlainVisibleWhen} from '../../visibleWhen.js';
import {toolbarBooleanField, toolbarBooleanValue, updateToolbarBoolean} from './toolbarBoolean.js';
import {downloadTableExport, tableExportColumns, tableExportFormats, tableExportRows} from './tableExport.js';

function sanitizeTestID(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function toolbarItemTestID(item) {
    const explicit =
        item?.testID ??
        item?.testId ??
        item?.dataTestID ??
        item?.dataTestId;
    if (explicit) return String(explicit);
    const itemID = sanitizeTestID(item?.id);
    return itemID ? `toolbar-btn-${itemID}` : undefined;
}

export function toolbarItemIcon(icon) {
    const normalized = String(icon || '').trim().toLowerCase();
    if (normalized === 'pdf' || normalized === 'document-pdf') {
        return <span className="forge-toolbar-pdf-icon" aria-hidden="true">PDF</span>;
    }
    if (normalized === 'sparkles') {
        return <span className="forge-sparkles-icon" aria-hidden="true">✦</span>;
    }
    return icon;
}

export function toolbarItemLabel(item = {}) {
    return item.hideLabel === true ? null : (item.label || "");
}

export function toolbarDisabledWrapperProps(item = {}, disabled = false) {
    if (!disabled) return {};
    const label = item.ariaLabel || item.tooltip || item.label || item.id;
    return {title: item.tooltip || item.label || item.id, 'aria-label': label, tabIndex: 0};
}

export function toolbarStatusValue(item = {}, form = {}, dirty = false) {
    if (dirty && item.dirtyValue !== undefined) return String(item.dirtyValue ?? '');
    const field = item.dataField || item.field || item.bind || item.id;
    const value = field && form?.[field] !== undefined ? form[field] : item.value;
    return value == null ? '' : String(value);
}

export function toolbarStatusShouldRender(item = {}, value = '') {
    return item?.properties?.hideWhenEmpty !== true || String(value || '').trim() !== '';
}

export function toolbarStatusAppearance(item = {}, form = {}) {
    const properties = item?.properties || {};
    const field = properties.appearanceField || item.appearanceField;
    const appearanceMap = properties.appearanceMap || item.appearanceMap || {};
    const state = field ? resolveSelector(form, field) : undefined;
    const candidate = appearanceMap?.[state] || item.appearance || item.intent || 'muted';
    const normalized = String(candidate || 'muted').trim().toLowerCase();
    return ['success', 'danger', 'error', 'warning', 'muted'].includes(normalized) ? normalized : 'muted';
}

export function clearToolbarStatusValue(signal, field, expectedValue) {
    if (!signal || !field) return false;
    const current = signal.peek?.() || signal.value || {};
    if (String(resolveSelector(current, field) ?? '') !== String(expectedValue ?? '')) return false;
    signal.value = setSelector(current, field, '');
    return true;
}

export function toolbarItemShouldRender(item = {}, context, dynamicVisible = true) {
    if (dynamicVisible === false) return false;
    const ctx = item.dataSourceRef ? context?.Context?.(item.dataSourceRef) || context : context;
    if (item.visibleWhen && !evaluatePlainVisibleWhen(item.visibleWhen, ctx)) return false;
    if (item.hiddenWhen && evaluatePlainVisibleWhen(item.hiddenWhen, ctx)) return false;
    return true;
}

export function toolbarHasSelection(selectionState = {}) {
    const selectedRows = Array.isArray(selectionState?.selection) ? selectionState.selection : [];
    return selectedRows.length > 0 || !!selectionState?.selected;
}

export function collectionCountValue(info = {}, rows = [], item = {}) {
    const loadedRows = Array.isArray(rows) ? rows.length : 0;
    const candidate = Number(info?.totalCount ?? info?.recordCount ?? info?.cnt);
    const count = Number.isSafeInteger(candidate) && candidate >= 0 && !(candidate === 0 && loadedRows > 0) ? candidate : loadedRows;
    const properties = item?.properties || {};
    const label = count === 1 ? properties.singularLabel || 'item' : properties.pluralLabel || 'items';
    return `${count.toLocaleString('en-US')} ${label}`;
}

function CollectionCountStatus({item, context, align}) {
    useSignals();
    const ctx = item.dataSourceRef ? context?.Context?.(item.dataSourceRef) || context : context;
    const rows = ctx?.signals?.collection?.value || [];
    const info = ctx?.handlers?.dataSource?.getCollectionInfo?.() || {};
    const value = collectionCountValue(info, rows, item);
    const spanStyle = align === 'right' ? {marginLeft: 10} : {marginRight: 10};
    return <span className="forge-toolbar-status is-muted" style={{...spanStyle, ...(item.style || {})}} role="status" aria-live="polite">{value}</span>;
}

function ToolbarStatus({item, context, align}) {
    useSignals();
    const ctx = item.dataSourceRef ? context?.Context?.(item.dataSourceRef) || context : context;
    const form = item.scope === 'windowForm'
        ? (ctx?.handlers?.dataSource?.peekWindowFormData?.() || ctx?.signals?.windowForm?.value || {})
        : (ctx?.handlers?.dataSource?.peekFormData?.() || ctx?.signals?.form?.value || {});
    const isDirty = ctx?.signals?.formStatus?.value?.dirty === true;
    const value = toolbarStatusValue(item, form, isDirty);
    const appearance = toolbarStatusAppearance(item, form);
    const field = item.dataField || item.field || item.bind || item.id;
    const dismissAfterMs = Math.max(0, Number(item?.properties?.dismissAfterMs || 0) || 0);
    React.useEffect(() => {
        if (!dismissAfterMs || !String(value || '').trim()) return undefined;
        const signal = item.scope === 'windowForm' ? ctx?.signals?.windowForm : ctx?.signals?.form;
        const timer = setTimeout(() => clearToolbarStatusValue(signal, field, value), dismissAfterMs);
        return () => clearTimeout(timer);
    }, [ctx, dismissAfterMs, field, item.scope, value]);
    if (!toolbarStatusShouldRender(item, value)) return null;
    const spanStyle = align === 'right' ? {marginLeft: 10} : {marginRight: 10};
    return (
        <span
            className={`forge-toolbar-status is-${appearance}${item.className ? ` ${item.className}` : ''}`}
            style={{...spanStyle, ...(item.style || {})}}
            role="status"
            aria-live={item?.properties?.['aria-live'] || item?.ariaLive || 'polite'}
        >
            {item.label ? <strong>{item.label}:</strong> : null}
            {value}
        </span>
    );
}

export function TableExportControl({item, align, disabled = false, rows = [], columns = []}) {
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const busyRef = React.useRef(false);
    const mountedRef = React.useRef(true);
    const timerRef = React.useRef(null);
    React.useEffect(() => () => {
        mountedRef.current = false;
        if (timerRef.current != null) clearTimeout(timerRef.current);
        timerRef.current = null;
        busyRef.current = false;
    }, []);
    const formats = tableExportFormats(item?.properties?.formats);
    const exportDisabled = disabled || busy || rows.length === 0 || tableExportColumns(columns).length === 0;
    const runExport = (format) => {
        if (busyRef.current || exportDisabled) return;
        busyRef.current = true;
        setBusy(true);
        setError('');
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            try {
                downloadTableExport({
                    rows,
                    columns,
                    format,
                    filename: item?.properties?.filename || item.id || 'table-export',
                    limits: {maxRows: item?.properties?.maxRows, maxCells: item?.properties?.maxCells, maxBytes: item?.properties?.maxBytes},
                });
            } catch (cause) {
                if (mountedRef.current) setError(cause?.message || 'Export could not be created.');
            } finally {
                busyRef.current = false;
                if (mountedRef.current) setBusy(false);
            }
        }, 0);
    };
    return (
        <span key={`table-export-${item.id}-${align}`} className="forge-toolbar-table-export" style={align === 'right' ? {marginLeft: 10} : {marginRight: 10}} aria-busy={busy || undefined}>
            <Popover
                placement="bottom-end"
                interactionKind="click"
                minimal
                disabled={exportDisabled}
                content={(
                    <Menu className="forge-toolbar-select-menu" aria-label={`${item.label || 'Export'} formats`}>
                        {formats.map((format) => (
                            <MenuItem
                                key={format}
                                text={format.toUpperCase()}
                                icon={format === 'xlsx' ? 'th' : 'document'}
                                disabled={busy}
                                onClick={() => runExport(format)}
                            />
                        ))}
                    </Menu>
                )}
            >
                <Button
                    type="button"
                    icon={toolbarItemIcon(item.icon || 'export')}
                    rightIcon="caret-down"
                    loading={busy}
                    disabled={exportDisabled}
                    aria-label={item.ariaLabel || item.tooltip || item.label || 'Export'}
                    title={item.tooltip || item.label || 'Export'}
                >
                    {toolbarItemLabel(item) || ''}
                </Button>
            </Popover>
            {error ? <span className="forge-toolbar-export-error" role="alert">{error}</span> : null}
        </span>
    );
}

const Toolbar = ({
                     context,
                     toolbarItems = [],
                     exportRows = [],
                     exportPageRows = [],
                     exportColumns = [],
                     density = '',
                     layout = '',
                     className = '',
                     style,
}) => {

    useSignals();

    const toolbarEvents = useToolbarControlEvents(context, toolbarItems);
    const { signals } = context;
    const { control, formStatus } = signals;
    const disabled = control.value?.inactive || false;
    const formDirty = formStatus?.value?.dirty === true;
    const hasSelection = toolbarHasSelection(signals?.selection?.value || {});

    const renderToolbarItem = (item, align) => {
        const {events = {}, stateEvents} = toolbarEvents[item.id] || {};
        const isVisible = stateEvents?.onVisible ? stateEvents.onVisible() : true;
        if (!toolbarItemShouldRender(item, context, isVisible)) return null;
        const isReadonly = stateEvents?.onReadonly ? stateEvents.onReadonly() : false;
        if (item.type === 'tableExport' || item.widget === 'tableExport') {
            const rows = tableExportRows({filteredSortedRows: exportRows, pageRows: exportPageRows, scope: item?.properties?.scope});
            return <TableExportControl key={`table-export-${item.id}-${align}`} item={item} align={align} disabled={item.disabled === true || disabled || isReadonly} rows={rows} columns={exportColumns}/>;
        }
        if (item.type === 'collectionCount' || item.widget === 'collectionCount') {
            return <CollectionCountStatus key={`collection-count-${item.id}-${align}`} item={item} context={context} align={align}/>;
        }
        if ((item.type === 'menu' || item.widget === 'menu' || item.type === 'dropdown') && Array.isArray(item.menuItems)) {
            const menuEvents = useToolbarControlEvents(context, item.menuItems);
            const menuDisabled = item.disabled === true
                || (item.enableWhenSelection === true && !hasSelection)
                || disabled
                || isReadonly;
            const spanStyle = align === 'center'
                ? {margin: '0 10px'}
                : (align === 'right' ? {marginLeft: '10px'} : {marginRight: '10px'});
            return (
                <span key={`menu-${item.id}-${align}`} style={spanStyle}>
                    <Popover
                        placement="bottom-start"
                        interactionKind="click"
                        minimal
                        disabled={menuDisabled}
                        content={(
                            <Menu className="forge-toolbar-select-menu" aria-label={`${item.label || item.id || 'Actions'} menu`}>
                                {item.menuItems.map((menuItem) => {
                                    const nested = menuEvents[menuItem.id] || {};
                                    const nestedVisible = nested.stateEvents?.onVisible ? nested.stateEvents.onVisible() : true;
                                    if (nestedVisible === false) return null;
                                    const nestedReadonly = nested.stateEvents?.onReadonly ? nested.stateEvents.onReadonly() : false;
                                    return (
                                        <MenuItem
                                            key={menuItem.id}
                                            text={menuItem.label || menuItem.id}
                                            icon={menuItem.icon}
                                            disabled={menuItem.disabled === true || nestedReadonly}
                                            title={menuItem.tooltip || menuItem.label || menuItem.id}
                                            onClick={nested.events?.onClick}
                                        />
                                    );
                                })}
                            </Menu>
                        )}
                    >
                        <Button
                            type="button"
                            icon={toolbarItemIcon(item.icon)}
                            rightIcon="caret-down"
                            disabled={menuDisabled}
                            aria-label={item.ariaLabel || item.tooltip || item.label || item.id}
                            title={item.tooltip || item.label || item.id}
                        >
                            {item.label || ''}
                        </Button>
                    </Popover>
                </span>
            );
        }
        if (item.type === 'dateRangePreset' || item.widget === 'dateRangePreset') {
            const field = item.field || item.bind || item.id;
            const windowForm = signals?.windowForm?.value || {};
            const value = windowForm[field] ?? item.value ?? '';
            const updateValue = (nextValue) => {
                if (!signals?.windowForm) return;
                const previous = signals.windowForm.peek?.() || signals.windowForm.value || {};
                signals.windowForm.value = {...previous, [field]: nextValue};
            };
            return (
                <span key={`date-range-${item.id}-${align}`} style={{minWidth: item.minWidth || 350, marginLeft: align === 'right' ? 10 : 0}}>
                    <DateRangePresetInput
                        value={value}
                        onChange={updateValue}
                        options={item.options || []}
                        context={context}
                        item={item}
                        {...(item.properties || {})}
                    />
                </span>
            );
        }
        if (item.id === 'quickFilter' || item.id === 'quickFilterInputs') {
            return <QuickFilterInputs key={`qfinputs-${align}`} context={context} align={align} />;
        }
        if (item.id === 'quickFilterToggle') {
            return <QuickFilterToggle key={`qftoggle-${align}`} context={context} />;
        }
        if (item.type === 'checkbox' || item.widget === 'checkbox' || item.type === 'switch' || item.widget === 'switch') {
            const ctx = item.dataSourceRef ? context?.Context?.(item.dataSourceRef) || context : context;
            const field = toolbarBooleanField(item);
            const targetSignal = item.scope === 'windowForm' ? ctx?.signals?.windowForm : ctx?.signals?.form;
            const form = targetSignal?.value || targetSignal?.peek?.() || {};
            const checked = toolbarBooleanValue(resolveSelector(form, field) ?? item.value);
            const staticReadonly = item.readOnly === true || item.readonly === true || item?.properties?.readOnly === true;
            const ruleReadonly = item.readOnlyWhen ? evaluatePlainVisibleWhen(item.readOnlyWhen, ctx) : false;
            const ruleDisabled = item.disabledWhen ? evaluatePlainVisibleWhen(item.disabledWhen, ctx) : false;
            const booleanReadonly = staticReadonly || ruleReadonly || isReadonly;
            const booleanDisabled = item.disabled === true
                || item.enabled === false
                || disabled
                || ruleDisabled
                || booleanReadonly
                || (stateEvents?.onDisabled ? stateEvents.onDisabled() : false);
            const change = (event) => {
                if (booleanDisabled) return;
                updateToolbarBoolean({
                    signal: targetSignal,
                    field,
                    checked: event.currentTarget.checked,
                    event,
                    onChange: events.onChange,
                });
            };
            const BooleanControl = item.type === 'switch' || item.widget === 'switch' ? Switch : Checkbox;
            const booleanClassName = item.type === 'switch' || item.widget === 'switch' ? undefined : 'forge-blueprint-checkbox-compat';
            return <span key={`boolean-${item.id}-${align}`} className="forge-toolbar-boolean" style={align === 'right' ? {marginLeft: 10} : {marginRight: 10}}>
                <BooleanControl className={booleanClassName} checked={checked} disabled={booleanDisabled} readOnly={booleanReadonly} aria-readonly={booleanReadonly || undefined} label={item.label || undefined} aria-label={item.ariaLabel || item.tooltip || item.label || item.id} title={item.tooltip || item.label || item.id} onChange={change}/>
            </span>;
        }
        if (item.type === 'pagination' || item.id === 'pagination') {
            return (
                <span key={`pagination-${align}`} style={align === 'center' ? { margin: "0 10px" } : (align === 'right' ? { marginLeft: "10px" } : { marginRight: "10px" })}>
                    <PaginationBar context={context} pagination={item.pagination || {}} />
                </span>
            );
        }
        if (item.type === 'status' || item.type === 'label') {
            return <ToolbarStatus key={`status-${item.id}-${align}`} item={item} context={context} align={align}/>;
        }
        const isSelect = item.type === 'select' || item.widget === 'select' || Array.isArray(item.options);
        if (isSelect) {
            const ctx = item.dataSourceRef ? context?.Context?.(item.dataSourceRef) || context : context;
            const form = item.scope === 'windowForm'
                ? (ctx?.handlers?.dataSource?.peekWindowFormData?.() || {})
                : (ctx?.handlers?.dataSource?.peekFormData?.() || {});
            const field = item.field || item.bind || item.id;
            const value = (form && field && form[field] !== undefined) ? form[field] : item.value;
            const directChange = (event) => {
                const nextValue = event?.target?.value;
                if (item.scope === 'windowForm' && typeof ctx?.handlers?.dataSource?.setWindowFormField === 'function') {
                    ctx.handlers.dataSource.setWindowFormField({item: {...item, dataField: field}, value: nextValue});
                    return;
                }
                const targetSignal = item.scope === 'windowForm' ? signals?.windowForm : ctx?.signals?.form;
                if (!targetSignal) return;
                const previous = targetSignal.peek?.() || targetSignal.value || {};
                targetSignal.value = {...previous, [field]: nextValue};
            };
            const spanStyle = align === 'center'
                ? { margin: "0 10px", display: 'inline-flex', alignItems: 'center', gap: 6 }
                : (align === 'right' ? { marginLeft: "10px", display: 'inline-flex', alignItems: 'center', gap: 6 } : { marginRight: "10px", display: 'inline-flex', alignItems: 'center', gap: 6 });
            return (
                <span key={`select-${item.id}-${align}`} className={item.className || undefined} style={spanStyle}>
                    {item.label ? <span>{item.label}</span> : null}
                    <Popover
                        placement="bottom-end"
                        interactionKind="click"
                        minimal
                        content={(
                            <Menu className="forge-toolbar-select-menu" aria-label={`${item.label || item.id || 'Toolbar'} options`}>
                                {(item.options || []).map((option) => (
                                    <MenuItem
                                        key={String(option.value)}
                                        text={option.label ?? option.text ?? String(option.value)}
                                        active={String(option.value) === String(value ?? '')}
                                        icon={String(option.value) === String(value ?? '') ? 'tick' : undefined}
                                        onClick={() => dispatchToolbarSelectChange({target: {value: option.value}}, directChange, events.onChange)}
                                    />
                                ))}
                            </Menu>
                        )}
                    >
                        <Button
                            type="button"
                            rightIcon="caret-down"
                            disabled={item.disabled === true || disabled || isReadonly}
                            aria-label={`${item.label || item.id || 'Select'}: ${toolbarSelectLabel(item.options, value)}`}
                            title={item.tooltip || item.label || item.id}
                            className={`forge-toolbar-select-trigger${item.className ? ` ${item.className}` : ''}`}
                        >
                            {toolbarSelectLabel(item.options, value)}
                        </Button>
                    </Popover>
                </span>
            );
        }

        const dirtyRefs = Array.isArray(item.enableWhenDirtyDataSourceRefs) ? item.enableWhenDirtyDataSourceRefs : [];
        const hasDirtyRef = dirtyRefs.length === 0 || dirtyRefs.some((ref) => {
            try {
                return context?.Context?.(ref)?.signals?.formStatus?.value?.dirty === true;
            } catch (_) {
                return false;
            }
        });
        const disableDirtyRefs = Array.isArray(item.disableWhenDirtyDataSourceRefs) ? item.disableWhenDirtyDataSourceRefs : [];
        const hasBlockingDirtyRef = disableDirtyRefs.some((ref) => {
            try {
                return context?.Context?.(ref)?.signals?.formStatus?.value?.dirty === true;
            } catch (_) {
                return false;
            }
        });
        const effectiveDisabled = item.disabled === true
            || item.enabled === false
            || (item.enableWhenSelection === true && !hasSelection)
            || !hasDirtyRef
            || hasBlockingDirtyRef
            || (item.enabled !== true && disabled)
            || isReadonly;
        const testID = toolbarItemTestID(item);
        const spanStyle = align === 'center'
            ? { margin: "0 10px" }
            : (align === 'right' ? { marginLeft: "10px" } : { marginRight: "10px" });

        return (
            <span
                key={item.id}
                style={spanStyle}
                {...toolbarDisabledWrapperProps(item, effectiveDisabled)}
            >
                <Button
                    key={item.id}
                    icon={toolbarItemIcon(item.icon)}
                    {...events}
                    disabled={effectiveDisabled}
                    intent={item.intent || 'none'}
                    minimal={item.appearance === 'minimal'}
                    outlined={item.appearance === 'outlined'}
                    data-testid={testID}
                    aria-label={item.ariaLabel || item.tooltip || item.label || item.id}
                    title={item.tooltip || item.label || item.id}
                    className={item.className}
                    style={item.style}
                >
                    {toolbarItemLabel(item)}
                </Button>
            </span>
        );
    };

    const renderAlignedItems = (align) => {
        return toolbarItems
            .filter((item) => String(item?.placement || '').trim().toLowerCase() !== 'feedback')
            .filter((item) => (align === 'right'
                ? item.align !== 'left' && item.align !== 'center'
                : item.align === align))
            .map((item) => renderToolbarItem(item, align));
    };

    return (
        <div
            className={`toolbar-container${density === 'compact' ? ' is-compact' : ''}${layout === 'balanced' || layout === 'responsive' ? ' is-balanced' : ''}${layout === 'responsive' ? ' is-responsive' : ''}${className ? ` ${className}` : ''}`}
            style={style}
            data-form-dirty={formDirty ? 'true' : 'false'}
        >
            {/* Items aligned to the left */}
            <div className="toolbar-left">
                {renderAlignedItems('left')}
            </div>
            {/* Items aligned to the center */}
            <div className="toolbar-center">
                {renderAlignedItems('center')}
            </div>
            {/* Items aligned to the right */}
            <div className="toolbar-right">
                {renderAlignedItems('right')}
            </div>
            <div className="toolbar-feedback">
                {toolbarItems
                    .filter((item) => String(item?.placement || '').trim().toLowerCase() === 'feedback')
                    .map((item) => renderToolbarItem(item, 'left'))}
            </div>
        </div>
    );
};

export default Toolbar;
