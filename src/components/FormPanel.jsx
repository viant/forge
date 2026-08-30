import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
    Tabs,
    Tab,
    Icon,
} from '@blueprintjs/core';
import Container from './Container';
import {useSignals} from '@preact/signals-react/runtime';
import {findBusSignal, getViewSignal} from "../core/index.js";
import {isContainerVisible, trackContainerVisibility} from "./visibleWhen.js";
import {mergeSelectedTab, nextBusMessage} from './FormPanelState';
import SectionTabRail from './SectionTabRail.jsx';

const FormPanel = ({context, container, children}) => {
    useSignals();
    const containers = container.containers || [];
    containers.forEach((entry) => trackContainerVisibility(entry, context));
    const visibleContainers = containers.filter((entry) => isContainerVisible(entry, context));
    const windowId = context?.identity?.windowId;
    const panelId = container?.id || visibleContainers[0]?.id || containers[0]?.id || 'root';
    const viewSignal = windowId ? getViewSignal(windowId) : null;
    const viewValue = viewSignal?.value || {};
    const busMessages = windowId ? ((findBusSignal(windowId)?.value) || []) : [];
    const processedBusMessage = useRef({});
    const [browserPrintMode, setBrowserPrintMode] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const start = () => setBrowserPrintMode(true);
        const finish = () => setBrowserPrintMode(false);
        window.addEventListener('beforeprint', start);
        window.addEventListener('afterprint', finish);
        return () => {
            window.removeEventListener('beforeprint', start);
            window.removeEventListener('afterprint', finish);
        };
    }, []);
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
    const printMode = container?.tabs?.print?.expandAll === true && (
        browserPrintMode || String(context?.presentationMode || '').trim().toLowerCase() === 'print'
    );
    const tabAppearance = String(container?.tabs?.appearance || '').trim().toLowerCase();
    const tabsClassName = ['forge-form-panel-tabs', tabAppearance ? `forge-form-panel-tabs--${tabAppearance}` : ''].filter(Boolean).join(' ');
    if (printMode) {
        return (
            <div className="forge-tabbed-container-print">
                {visibleContainers.map((tab) => (
                    <section key={tab.id} className="forge-tabbed-container-print-section">
                        {tab.title ? <h2>{tab.title}</h2> : null}
                        <Container context={context} container={tab} isActive={true} suppressTitle={true} />
                    </section>
                ))}
            </div>
        );
    }
    if (tabAppearance === 'section') {
        const selected = visibleContainers.find((tab) => String(tab.id) === String(selectedTabId)) || visibleContainers[0];
        return (
            <div className="form-panel forge-form-panel-section-tabs">
                <SectionTabRail
                    items={visibleContainers.map((tab) => ({id: tab.id, label: tab.title, icon: tab.icon}))}
                    selectedId={selected?.id}
                    onChange={handleTabChange}
                    ariaLabel={container?.tabs?.ariaLabel || 'Sections'}
                    showIcons={container?.tabs?.showIcons === true}
                />
                <div className="forge-form-panel-section-tabs__panel" role="tabpanel">
                    <Container context={context} container={selected} isActive suppressTitle />
                </div>
                {children}
            </div>
        );
    }
    return (
        <div className="form-panel">
            <Tabs id={`form-tabs-${visibleContainers[0]?.id || 'root'}`} className={tabsClassName} selectedTabId={selectedTabId} onChange={handleTabChange} renderActiveTabPanelOnly={true} animate={false}>
                {visibleContainers.map((tab) => (
                    <Tab
                        key={tab.id}
                        id={tab.id}
                        title={tab.icon ? <span className="forge-form-panel-tab-title"><Icon icon={tab.icon} size={14}/><span>{tab.title}</span></span> : tab.title}
                        panel={
                            <Container
                                context={context}
                                container={tab}
                                isActive={selectedTabId === tab.id}
                                suppressTitle={true}
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
