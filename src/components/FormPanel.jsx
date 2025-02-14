import React, {useState, useEffect} from 'react';
import {
    Tabs,
    Tab,
} from '@blueprintjs/core';
import Container from './Container';

const FormPanel = ({context, container, children}) => {
    const containers = container.containers || [];
    const [selectedTabId, setSelectedTabId] = useState(containers[0]?.id);
    const handleTabChange = (newTabId) => {
        setSelectedTabId(newTabId);
    };
    return (
        <div className="form-panel">
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
                {children}
            </Tabs>
        </div>
    );
};

export default FormPanel;
