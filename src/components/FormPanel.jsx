import React, {useEffect, useMemo} from 'react';
import {
    Tabs,
    Tab,
} from '@blueprintjs/core';
import Container from './Container';
import {useSignals} from '@preact/signals-react/runtime';
import {findBusSignal, findViewSignal} from "../core";

const FormPanel = ({context, container, children}) => {
    useSignals();
    const containers = container.containers || [];
    const windowId = context?.identity?.windowId;
    const panelId = container?.id || containers[0]?.id || 'root';
    const viewSignal = windowId ? findViewSignal(windowId) : null;
    const viewValue = viewSignal?.value || {};
    const busMessages = windowId ? ((findBusSignal(windowId)?.value) || []) : [];
    const resolveSelectedTabId = () => {
        const viewState = viewValue || {};
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
    const selectedTabId = useMemo(resolveSelectedTabId, [viewValue, panelId, container?.tabs?.selectedTabId, container?.tabs?.defaultSelectedTabId, containers]);
    const handleTabChange = (newTabId) => {
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
    useEffect(() => {
        if (!windowId) return;
        const nextSelected = String(viewValue?.tabs?.[panelId] || '').trim();
        const messages = busMessages;
        if (!Array.isArray(messages) || messages.length === 0) return;
        const last = messages[messages.length - 1];
        const targetPanelId = String(last?.containerId || '').trim();
        if (last?.type === 'selectTab' && last?.tabId && (!targetPanelId || targetPanelId === panelId)) {
            const target = containers.find(c => c.id === last.tabId);
            if (target) {
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
    }, [windowId, viewValue, busMessages, panelId, containers, selectedTabId, viewSignal]);
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
