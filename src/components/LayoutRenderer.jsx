import React, {useState} from 'react';
import Splitter from './Splitter';
import {Section, Card, Tabs, Tab} from '@blueprintjs/core';
import Container from './Container.jsx';
import {resolveTemplate} from "../utils/selector.js";

import {useSignalEffect} from "@preact/signals-react";

const LayoutRenderer = ({context, container}) => {
    if (!container) {
        return <div>No container provided to LayoutRenderer.</div>;
    }


    const [title, setTitle] = useState(container.title||'')
    const {identity} = context
    const {layout, containers, section, card} = container;
    const [selectedTabId, setSelectedTabId] = useState(containers?.length > 0 ? containers[0]?.id : '');
    const handleTabChange = (newTabId) => {
        setSelectedTabId(newTabId);
    };


    const dataSourceRef = container.dataSourceRef || identity.dataSourceRef
    const orientation = layout?.orientation || 'vertical';

    useSignalEffect(() => {
        const cTitle = container.title || ''
        if(cTitle.indexOf('{') > -1) {

            const data = context.handlers.dataSource.getDataSourceValue('form')

            setTitle(resolveTemplate(cTitle, data))
        }
    })



    const renderContent = () => {
        if (containers && containers.length > 0) {
            if (container.tabs) {
                return (<div className="form-panel">
                    <Tabs id="form-tabs" selectedTabId={selectedTabId} onChange={handleTabChange}>
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
                    </Tabs>
                </div>)
            }
            return (
                <Splitter orientation={orientation} divider={layout?.divider}>
                    {containers.map((subContainer, index) => {
                        const dataSourceRef = subContainer.dataSourceRef || identity.dataSourceRef
                        return (<LayoutRenderer
                                key={subContainer.id || index}
                                context={context.Context(dataSourceRef)}
                                container={subContainer}
                            />
                        )
                    })}
                </Splitter>
            );
        }
        return <Container context={context.Context(dataSourceRef)} container={container}/>;
    }


    let content = renderContent();
    if(container.items && containers && containers.length > 0) {
        const {items, layout, dataSourceRef} = container
        content = (<>
                <Container context={context.Context(dataSourceRef)} container={{items, layout, dataSourceRef}}/>
                {content}
            </>)
    }


    if (section) {

        const sectionProperties = section.properties || {}
        const properties = {
            ...sectionProperties,
            collapsible: sectionProperties.collapsible || false,
        }
        content = (
            <Section title={title} {...properties}  >
                <Card {...card}>
                    {content}
                </Card>
            </Section>
        );
    } else if (card) {
        content = (
            <Card {...card}>
                {content}
            </Card>
        );
    }


    return content;
};


export default LayoutRenderer;