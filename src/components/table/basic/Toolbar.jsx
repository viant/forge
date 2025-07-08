
import React from 'react';
import { Button } from '@blueprintjs/core';
import QuickFilterInputs from './QuickFilterInputs.jsx';
import QuickFilterToggle from './QuickFilterToggle.jsx';
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
                        if (item.id === 'quickFilter') {
                            return (
                                <QuickFilterInputs key="qfinputs-left" context={context} align="left" />
                            );
                        }
                        if (item.id === 'quickFilterInputs') {
                            return <QuickFilterInputs key="qfinputs-left" context={context} align="left" />;
                        }
                        if (item.id === 'quickFilterToggle') {
                            return <QuickFilterToggle key="qftoggle-left" context={context} />;
                        }
                        const {events={}, stateEvents} = toolbarEvents[item.id] || {};
                        const isReadonly = stateEvents.onReadonly ? stateEvents.onReadonly() : false;
                        const effectiveDisabled = (item.enabled !== true && disabled) || isReadonly;
                        return (
                            <span key={item.id} style={{ marginRight: "10px" }}>
                                <Button
                                    key={item.id}
                                    icon={item.icon}
                                    {...events}
                                    disabled={effectiveDisabled}
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
                        if (item.id === 'quickFilter') {
                            return (
                                <QuickFilterInputs key="qfinputs-center" context={context} align="center" />
                            );
                        }
                        if (item.id === 'quickFilterInputs') {
                            return <QuickFilterInputs key="qfinputs-center" context={context} align="center" />;
                        }
                        if (item.id === 'quickFilterToggle') {
                            return <QuickFilterToggle key="qftoggle-center" context={context} />;
                        }
                        const {events={}, stateEvents} = toolbarEvents[item.id] || {};

                        const isReadonly = stateEvents.onReadonly ? stateEvents.onReadonly() : false;
                        const effectiveDisabled = (item.enabled !== true && disabled) || isReadonly;
                        return (
                            <span key={item.id} style={{margin: "0 10px"}}>
                                <Button
                                    key={item.id}
                                    icon={item.icon}
                                    {...events}
                                    disabled={effectiveDisabled}
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
                        if (item.id === 'quickFilter') {
                            return (
                                <QuickFilterInputs key="qfinputs-right" context={context} align="right" />
                            );
                        }
                        if (item.id === 'quickFilterInputs') {
                            return <QuickFilterInputs key="qfinputs-right" context={context} align="right" />;
                        }
                        if (item.id === 'quickFilterToggle') {
                            return <QuickFilterToggle key="qftoggle-right" context={context} />;
                        }
                        const {events={}, stateEvents} = toolbarEvents[item.id] || {};
                        const isReadonly = stateEvents.onReadonly ? stateEvents.onReadonly() : false;
                        const effectiveDisabled = (item.enabled !== true && disabled) || isReadonly;
                        return (
                            <span key={item.id} style={{ marginLeft: "10px" }}>
                                <Button
                                    key={item.id}
                                    icon={item.icon}
                                    {...events}
                                    disabled={effectiveDisabled}
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
