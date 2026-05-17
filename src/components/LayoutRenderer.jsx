import React from 'react';
import Container from './Container.jsx';

function resolveChildContext(context, dataSourceRef) {
    const targetRef = dataSourceRef || context?.identity?.dataSourceRef;
    if (!targetRef) {
        return context;
    }
    if (context?.signals && context?.identity?.dataSourceRef === targetRef) {
        return context;
    }
    return context.Context(targetRef);
}

const LayoutRenderer = ({context, container}) => {
    if (!container) {
        return <div>No container provided to LayoutRenderer.</div>;
    }
    const dataSourceRef = container.dataSourceRef || context.identity.dataSourceRef;
    return <Container context={resolveChildContext(context, dataSourceRef)} container={container}/>;
};


export default LayoutRenderer;
