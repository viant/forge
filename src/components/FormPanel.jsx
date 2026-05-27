import React, {useEffect, useMemo, useRef} from 'react';
import {
    Tabs,
    Tab,
} from '@blueprintjs/core';
import Container from './Container';
import {useSignals} from '@preact/signals-react/runtime';
import {findBusSignal, findViewSignal} from "../core";
import {isContainerVisible, trackContainerVisibility} from "./visibleWhen.js";
import {mergeSelectedTab, nextBusMessage} from './FormPanelState';

const FormPanel = ({context, container, children}) => {
    useSignals();
    const containers = container.containers || [];
    containers.forEach((entry) => trackContainerVisibility(entry, context));
    const visibleContainers = containers.filter((entry) => isContainerVisible(entry, context));
    const windowId = context?.identity?.windowId;
    const panelId = container?.id || visibleContainers[0]?.id || containers[0]?.id || 'root';
    const viewSignal = windowId ? findViewSignal(windowId) : null;
    const viewValue = viewSignal?.value || {};
    const busMessages = windowId ? ((findBusSignal(windowId)?.value) || []) : [];
    const processedBusMessage = useRef({});
    const resolveSelectedTabId = () => {
        const viewState = viewValue || {};
        const savedTabId = String(viewState?.tabs?.[panelId] || '').trim();
        if (savedTabId && visibleContainers.some((entry) => String(entry?.id || '').trim() === savedTabId)) {
            return savedTabId;
        }
        const configured = String(container?.tabs?.selectedTabId || container?.tabs?.defaultSelectedTabId || '').trim();
        if (configured && visibleContainers.some((entry) => String(entry?.id || '').trim() === configured)) {
            return configured;
        }
        return visibleContainers[0]?.id;
    };
    const selectedTabId = useMemo(resolveSelectedTabId, [viewValue, panelId, container?.tabs?.selectedTabId, container?.tabs?.defaultSelectedTabId, visibleContainers]);
    const handleTabChange = (newTabId) => {
        if (viewSignal) {
            const previous = viewSignal.peek?.() || {};
            const next = mergeSelectedTab(previous, panelId, newTabId);
            if (next.changed) viewSignal.value = next.value;
        }
    };

    // Listen for bus messages requesting tab switches
    useEffect(() => {
        if (!windowId) return;
        const messages = busMessages;
        const bus = nextBusMessage(messages, processedBusMessage.current);
        processedBusMessage.current = bus.state;
        if (!bus.changed) return;
        const last = bus.message;
        const targetPanelId = String(last?.containerId || '').trim();
        if (last?.type === 'selectTab' && last?.tabId && (!targetPanelId || targetPanelId === panelId)) {
            const target = visibleContainers.find(c => c.id === last.tabId);
            if (target) {
                if (viewSignal) {
                    const previous = viewSignal.peek?.() || {};
                    const next = mergeSelectedTab(previous, panelId, last.tabId);
                    if (next.changed) viewSignal.value = next.value;
                }
            }
        }
    }, [windowId, busMessages, panelId, visibleContainers, viewSignal]);
    if (visibleContainers.length === 0) {
        return null;
    }
    return (
        <div className="form-panel">
            <Tabs id={`form-tabs-${visibleContainers[0]?.id || 'root'}`} className="forge-form-panel-tabs" selectedTabId={selectedTabId} onChange={handleTabChange} renderActiveTabPanelOnly={true} animate={false}>
                {visibleContainers.map((tab) => (
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
