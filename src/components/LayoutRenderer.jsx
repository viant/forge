import React, {useState} from 'react';
import {Section, Card} from '@blueprintjs/core';
import Container from './Container.jsx';
import {resolveTemplate} from "../utils";

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

    useSignalEffect(() => {
        const cTitle = container.title || ''
        if(cTitle.indexOf('{') > -1) {
            const data = context.handlers.dataSource.getDataSourceValue('form')
            setTitle(resolveTemplate(cTitle, data))
        }
    })




    let content = (<Container context={context.Context(dataSourceRef)} container={container}/>)
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