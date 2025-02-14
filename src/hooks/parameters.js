import {resolveSelector} from "../utils/selector.js";


export function resolveParameters(parameterDefinitions = [], context) {
    const resolved = {};
    parameterDefinitions.forEach((param) => {
        const {name, kind, in: inWhere, location} = param;
        if (!resolved[kind]) {
            resolved[kind] = {};
        }
        const value = resolveParameter(context, inWhere, location);
        resolved[kind][name] = value;
    });
    return resolved;
}



function resolveParameter(context, inWhere, location) {
    switch (inWhere) {
        case 'selection':
            return resolveFromSelection(context, location);
        case 'form':
            return resolveFromValuesForm(context, location);
        case 'metadata':
            return resolveFromMetadata(context, location);
        case 'filterSet':
            return resolveFromFilterSet(context, location);
        case 'tableSetting':
            return resolveFromTableSetting(context, location);
        default:
            throw new Error(`Unknown 'in' value: ${inWhere}`);
    }
}

function resolveFromSelection(context, location) {
    let dataSourceRef;
    let fieldPath;

    // Check if `location` contains a dot
    const dotIndex = location.indexOf('.');

    if (dotIndex === -1) {
        // No dot => the entire `location` is the dataSourceRef
        dataSourceRef = location;
        fieldPath = '';
    } else {
        // There is a dot => split out the possible dataSourceRef
        const possibleDataSourceRef = location.substring(0, dotIndex);
        if (context.dataSources[possibleDataSourceRef]) {
            dataSourceRef = possibleDataSourceRef;
            fieldPath = location.substring(dotIndex + 1);
        } else {
            // Fallback to context.identity.dataSourceRef
            dataSourceRef = context.identity.dataSourceRef;
            fieldPath = location;
        }
    }

    // Access the data source context and signals
    const dsContext = context.Context(dataSourceRef);
    const {dataSource} = dsContext
    const dsSelection = dsContext.handlers.dataSource.peekSelection();

    // Handle multi-selection vs single selection
    if (dataSource.selectionMode === 'multi') {
        const selection = dsSelection.selection || [];
        if(fieldPath === '') {
            return selection;
        }
        return selection.map(item => resolveSelector(item, fieldPath));
    } else {
        const selected = dsSelection.selected;
        if(fieldPath === '') {
            return selected;
        }
        return selected ? resolveSelector(selected, fieldPath) : null;
    }
}

function resolveFromValuesForm(context, location) {
    let dataSourceRef;
    let fieldPath;

    // Check if `location` contains a dot
    const dotIndex = location.indexOf('.');

    if (dotIndex === -1) {
        // No dot => the entire `location` is the dataSourceRef
        dataSourceRef = location;
        fieldPath = '';
    } else {
        // There is a dot => split out the possible dataSourceRef
        const possibleDataSourceRef = location.substring(0, dotIndex);
        if (context.dataSources[possibleDataSourceRef]) {
            dataSourceRef = possibleDataSourceRef;
            fieldPath = location.substring(dotIndex + 1);
        } else {
            // Fallback to the identity dataSourceRef
            dataSourceRef = context.identity.dataSourceRef;
            fieldPath = location;
        }
    }

    // Retrieve the dsContext and formData
    const dsContext = context.Context(dataSourceRef);
    const formData = dsContext.handlers.dataSource.peekFormData();

    // If no fieldPath was derived, return the entire formData
    if (!fieldPath) {
        return formData;
    }

    // Otherwise, resolve a specific field
    return resolveSelector(formData, fieldPath);
}




function resolveFromMetadata(context, location) {
    const metadata = context.metadata;
    if(location === '') {
        return metadata;
    }
    return resolveSelector(metadata, location);
}



function resolveFromFilterSet(context, location) {
    // Implement as needed
    // E.g., context may provide access to filterSet
    return undefined;
}



function resolveFromTableSetting(context, location) {
    // Implement as needed
    // E.g., context may provide access to tableSettings
    return undefined;
}

