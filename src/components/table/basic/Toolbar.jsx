
import React from 'react';
import {Button, Menu, MenuItem, Popover} from '@blueprintjs/core';
import { useSignals } from '@preact/signals-react/runtime';
import QuickFilterInputs from './QuickFilterInputs.jsx';
import QuickFilterToggle from './QuickFilterToggle.jsx';
import PaginationBar from './PaginationBar.jsx';
import "./Toolbar.css";
import { useToolbarControlEvents } from '../../../hooks/event.js';
import { DateRangePresetInput } from '../../../packs/blueprint/index.jsx';
import {toolbarSelectLabel} from './toolbarSelect.js';

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

const Toolbar = ({
                     context,
                     toolbarItems = [],
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
    const selectedRows = signals?.selection?.value?.selection;
    const hasSelection = Array.isArray(selectedRows) && selectedRows.length > 0;

    const renderToolbarItem = (item, align) => {
        const {events = {}, stateEvents} = toolbarEvents[item.id] || {};
        const isVisible = stateEvents?.onVisible ? stateEvents.onVisible() : true;
        if (isVisible === false) return null;
        const isReadonly = stateEvents?.onReadonly ? stateEvents.onReadonly() : false;
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
        if (item.type === 'pagination' || item.id === 'pagination') {
            return (
                <span key={`pagination-${align}`} style={align === 'center' ? { margin: "0 10px" } : (align === 'right' ? { marginLeft: "10px" } : { marginRight: "10px" })}>
                    <PaginationBar context={context} pagination={item.pagination || {}} />
                </span>
            );
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
                <span key={`select-${item.id}-${align}`} style={spanStyle}>
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
                                        onClick={() => (events.onChange || directChange)({target: {value: option.value}})}
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
                            className="forge-toolbar-select-trigger"
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
            <span key={item.id} style={spanStyle}>
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
                    {item.label || ""}
                </Button>
            </span>
        );
    };

    const renderAlignedItems = (align) => {
        return toolbarItems
            .filter((item) => (align === 'right'
                ? item.align !== 'left' && item.align !== 'center'
                : item.align === align))
            .map((item) => renderToolbarItem(item, align));
    };

    return (
        <div
            className={`toolbar-container${density === 'compact' ? ' is-compact' : ''}${layout === 'balanced' ? ' is-balanced' : ''}${className ? ` ${className}` : ''}`}
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
        </div>
    );
};

export default Toolbar;
