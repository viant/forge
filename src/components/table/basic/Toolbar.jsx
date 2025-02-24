
import React from 'react';
import { Button } from '@blueprintjs/core';
import "./Toolbar.css";
import { useToolbarControlEvents } from '../../../hooks/event.js';

const Toolbar = ({
                     context,
                     toolbarItems = [],
                 }) => {

    const toolbarEvents = useToolbarControlEvents(context, toolbarItems);
    const { signals } = context;
    const { control } = signals;
    const disabled = control.value?.inactive || false;

    return (
        <div className="toolbar-container">
            {/* Items aligned to the left */}
            <div className="toolbar-left">
                {toolbarItems
                    .filter((item) => item.align === 'left')
                    .map((item) => {
                        const {events={}, stateEvents} = toolbarEvents[item.id] || {};
                        // Determine if the button is readonly (disabled)
                        const isReadonly = stateEvents.onReadonly ? stateEvents.onReadonly() : false;
                        const isDisabled = disabled || isReadonly;

                        return (
                            <span key={item.id} style={{ marginRight: "10px" }}>
                                <Button
                                    key={item.id}
                                    icon={item.icon}
                                    {...events}
                                    disabled={isDisabled}
                                >
                                    {item.label || ""}
                                </Button>
                            </span>
                        );
                    })}
            </div>
            {/* Items aligned to the center */}
            <div className="toolbar-center">
                {toolbarItems
                    .filter((item) => item.align === 'center')
                    .map((item) => {
                        const {events={}, stateEvents} = toolbarEvents[item.id] || {};

                        const isReadonly = stateEvents.onReadonly ? stateEvents.onReadonly() : false;
                        const isDisabled = disabled || isReadonly;
                        return (
                            <span key={item.id} style={{margin: "0 10px"}}>
                                <Button
                                    key={item.id}
                                    icon={item.icon}
                                    {...events}
                                    disabled={isDisabled}
                                >
                                    {item.label || ""}
                                </Button>
                            </span>
                        );
                    })}
            </div>
            {/* Items aligned to the right */}
            <div className="toolbar-right">
                {toolbarItems
                    .filter((item) => item.align !== 'left' && item.align !== 'center')
                    .map((item) => {
                        const {events={}, stateEvents} = toolbarEvents[item.id] || {};
                        const isReadonly = stateEvents.onReadonly ? stateEvents.onReadonly() : false;
                        const isDisabled = disabled || isReadonly;
                        return (
                            <span key={item.id} style={{ marginLeft: "10px" }}>
                                <Button
                                    key={item.id}
                                    icon={item.icon}
                                    {...events}
                                    disabled={isDisabled}
                                >
                                    {item.label || ""}
                                </Button>
                            </span>
                        );
                    })}
            </div>
        </div>
    );
};

export default Toolbar;
