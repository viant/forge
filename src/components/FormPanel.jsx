import React, {useState, useEffect} from 'react';
import {
    Tabs,
    Tab,
} from '@blueprintjs/core';
import Container from './Container';
import {useSignalEffect} from "@preact/signals-react";
import {getBusSignal, getViewSignal} from "../core";

const FormPanel = ({context, container, children}) => {
    const containers = container.containers || [];
    const windowId = context?.identity?.windowId;
    const panelId = container?.id || containers[0]?.id || 'root';
    const viewSignal = windowId ? getViewSignal(windowId) : null;
    const resolveInitialTabId = () => {
        const viewState = viewSignal?.peek?.() || {};
        const savedTabId = String(viewState?.tabs?.[panelId] || '').trim();
        if (savedTabId && containers.some((entry) => String(entry?.id || '').trim() === savedTabId)) {
            return savedTabId;
        }
        const configured = String(container?.tabs?.selectedTabId || container?.tabs?.defaultSelectedTabId || '').trim();
        if (configured && containers.some((entry) => String(entry?.id || '').trim() === configured)) {
            return configured;
        }
        return containers[0]?.id;
    };
    const [selectedTabId, setSelectedTabId] = useState(resolveInitialTabId);
    const handleTabChange = (newTabId) => {
        setSelectedTabId(newTabId);
        if (viewSignal) {
            const previous = viewSignal.peek?.() || {};
            viewSignal.value = {
                ...previous,
                tabs: {
                    ...(previous?.tabs || {}),
                    [panelId]: newTabId,
                },
            };
        }
    };

    // Listen for bus messages requesting tab switches
    useSignalEffect(() => {
        if (!windowId) return;
        const nextSelected = String(viewSignal?.value?.tabs?.[panelId] || '').trim();
        if (nextSelected && nextSelected !== selectedTabId && containers.some((entry) => String(entry?.id || '').trim() === nextSelected)) {
            setSelectedTabId(nextSelected);
            return;
        }
        const bus = getBusSignal(windowId);
        const messages = bus.value;
        if (!Array.isArray(messages) || messages.length === 0) return;
        const last = messages[messages.length - 1];
        const targetPanelId = String(last?.containerId || '').trim();
        if (last?.type === 'selectTab' && last?.tabId && (!targetPanelId || targetPanelId === panelId)) {
            const target = containers.find(c => c.id === last.tabId);
            if (target) {
                setSelectedTabId(last.tabId);
                if (viewSignal) {
                    const previous = viewSignal.peek?.() || {};
                    viewSignal.value = {
                        ...previous,
                        tabs: {
                            ...(previous?.tabs || {}),
                            [panelId]: last.tabId,
                        },
                    };
                }
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
