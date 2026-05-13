import React from 'react';
import Container from './Container.jsx';

const LayoutRenderer = ({context, container}) => {
    if (!container) {
        return <div>No container provided to LayoutRenderer.</div>;
    }
    const dataSourceRef = container.dataSourceRef || context.identity.dataSourceRef;
    return <Container context={context.Context(dataSourceRef)} container={container}/>;
};


export default LayoutRenderer;
