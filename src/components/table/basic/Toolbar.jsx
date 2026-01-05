
import React from 'react';
import { Button } from '@blueprintjs/core';
import QuickFilterInputs from './QuickFilterInputs.jsx';
import QuickFilterToggle from './QuickFilterToggle.jsx';
import "./Toolbar.css";
import { useToolbarControlEvents } from '../../../hooks/event.js';

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

const Toolbar = ({
                     context,
                     toolbarItems = [],
                 }) => {

    const toolbarEvents = useToolbarControlEvents(context, toolbarItems);
    const { signals } = context;
    const { control } = signals;
    const disabled = control.value?.inactive || false;

    const renderToolbarItem = (item, align) => {
        if (item.id === 'quickFilter' || item.id === 'quickFilterInputs') {
            return <QuickFilterInputs key={`qfinputs-${align}`} context={context} align={align} />;
        }
        if (item.id === 'quickFilterToggle') {
            return <QuickFilterToggle key={`qftoggle-${align}`} context={context} />;
        }

        const { events = {}, stateEvents } = toolbarEvents[item.id] || {};
        const isReadonly = stateEvents?.onReadonly ? stateEvents.onReadonly() : false;
        const effectiveDisabled = (item.enabled !== true && disabled) || isReadonly;
        const testID = toolbarItemTestID(item);
        const spanStyle = align === 'center'
            ? { margin: "0 10px" }
            : (align === 'right' ? { marginLeft: "10px" } : { marginRight: "10px" });

        return (
            <span key={item.id} style={spanStyle}>
                <Button
                    key={item.id}
                    icon={item.icon}
                    {...events}
                    disabled={effectiveDisabled}
                    data-testid={testID}
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
        <div className="toolbar-container">
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
