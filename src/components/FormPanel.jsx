import React, {useState, useEffect} from 'react';
import {
    Tabs,
    Tab,
} from '@blueprintjs/core';
import Container from './Container';
import {useSignalEffect} from "@preact/signals-react";
import {getBusSignal} from "../core";

const FormPanel = ({context, container, children}) => {
    const containers = container.containers || [];
    const [selectedTabId, setSelectedTabId] = useState(containers[0]?.id);
    const handleTabChange = (newTabId) => {
        setSelectedTabId(newTabId);
    };

    // Listen for bus messages requesting tab switches
    const windowId = context?.identity?.windowId;
    useSignalEffect(() => {
        if (!windowId) return;
        const bus = getBusSignal(windowId);
        const messages = bus.value;
        if (!Array.isArray(messages) || messages.length === 0) return;
        const last = messages[messages.length - 1];
        if (last?.type === 'selectTab' && last?.tabId) {
            const target = containers.find(c => c.id === last.tabId);
            if (target) {
                setSelectedTabId(last.tabId);
            }
        }
    });
    return (
        <div className="form-panel">
            <Tabs id={`form-tabs-${containers[0]?.id || 'root'}`} className="forge-form-panel-tabs" selectedTabId={selectedTabId} onChange={handleTabChange} renderActiveTabPanelOnly={true}>
                {containers.map((tab) => (
                    <Tab
                        key={tab.id}
                        id={tab.id}
                        title={tab.title}
                        panel={
                            <Container
                                context={context}
                                container={tab}
                                isActive={selectedTabId === tab.id}
                            />
                        }
                    />
                ))}
                {children}
            </Tabs>
        </div>
    );
};

export default FormPanel;
