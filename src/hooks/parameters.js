import {resolveSelector} from "../utils/selector.js";

function shouldPreserveResolvedValue(existingValue, nextValue) {
    if (existingValue === undefined) {
        return false;
    }
    if (nextValue === undefined || nextValue === null) {
        return true;
    }
    if (typeof nextValue === 'string' && nextValue.trim() === '') {
        return true;
    }
    if (Array.isArray(nextValue) && nextValue.length === 0) {
        return true;
    }
    return false;
}

function assignResolvedField(target, fieldName, nextValue) {
    if (!target || !fieldName) return;
    if (shouldPreserveResolvedValue(target[fieldName], nextValue)) {
        return;
    }
    target[fieldName] = nextValue;
}

export function resolveParameters(parameterDefinitions = [], context) {
    // New-style rows: have explicit `from` and `to` with a ':' separator.
    const isCompactedFormat = (p) => typeof p.from === 'string' && typeof p.to === 'string' && p.from.includes(':') && p.to.includes(':');

    const resolved = {};
    const outboundRows = [];

    parameterDefinitions.forEach((param) => {
        if (isCompactedFormat(param)) {
            // --- New style row processing ---
            if ((param.direction && param.direction === 'out') || param.from.endsWith(':output')) {
                outboundRows.push(param);
                return; // defer to outbound processing
            }

            const [srcDsRaw, rawSrcStore] = param.from.split(':');
            const [dstDsRaw, rawDstStore] = param.to.split(':');

            // Expand shorthand query/path → input.query / input.path
            const expandStore = (s) => {
                switch (s) {
                    case 'query':
                        return 'input.query';
                    case 'path':
                        return 'input.path';
                    case 'headers':
                        return 'input.headers';
                    case 'body':
                        return 'input.body';
                    default:
                        return s;
                }
            };

            const srcStore = expandStore(rawSrcStore);
            const dstStore = expandStore(rawDstStore);

            const srcDs = srcDsRaw || context.identity.dataSourceRef;
            const dstDs = dstDsRaw || context.identity.dataSourceRef;

            const srcPath = param.location || param.name;
            const dstPath = param.name; // required by spec

            const srcCtx = context.Context(srcDs);

            let srcVal;
            switch (srcStore) {
                case 'form':
                    srcVal = resolveSelector(srcCtx.handlers.dataSource.peekFormData(), srcPath);
                    break;
                case 'selection':
                    srcVal = resolveSelector(srcCtx.handlers.dataSource.peekSelection()?.selected||{}, srcPath);
                    break;
                case 'filter':
                    srcVal = resolveSelector(srcCtx.handlers.dataSource.peekFilter(), srcPath);
                    break;
                case 'metrics':
                    srcVal = resolveSelector(srcCtx.signals.metrics?.peek?.() || {}, srcPath);
                    break;
                case 'windowform':
                    srcVal = resolveSelector(context?.signals?.windowForm?.peek?.() || {}, srcPath);
                    break;
                case 'input':
                    srcVal = resolveSelector(srcCtx.signals.input?.peek?.() || {}, srcPath);
                    break;
                default:
                    console.warn('resolveParameters: unsupported store in new-style param (M-1)', srcStore);
                    return;
            }

            if (dstStore === 'input' || dstStore === 'query' || dstStore === 'path') {
                // Simplistic handling: write into input store
                const dsRes = resolved[dstDs] = resolved[dstDs] || {};
                dsRes.input = dsRes.input || {};
                const targetObj = dstStore === 'input' ? dsRes.input : (dsRes.input[dstStore] = dsRes.input[dstStore] || {});

                if (dstPath === '...') {
                    Object.assign(targetObj, srcVal);
                } else if (dstPath.startsWith('[]')) {
                    const k = dstPath.substring(2);
                    targetObj[k] = Array.isArray(srcVal) ? srcVal : [srcVal];
                } else if (dstPath.includes('.')) {
                    const parts = dstPath.split('.');
                    let tgt = targetObj;
                    for (let i = 0; i < parts.length; i++) {
                        const part = parts[i];
                        if (i === parts.length - 1) {
                            tgt[part] = srcVal;
                        } else {
                            tgt[part] = tgt[part] || {};
                            tgt = tgt[part];
                        }
                    }
                } else {
                    targetObj[dstPath] = srcVal;
                }
            } else {
                const dsRes = resolved[dstDs] = resolved[dstDs] || {};
                dsRes[dstStore] = dsRes[dstStore] || {};

                if (dstPath === '...') {
                    Object.assign(dsRes[dstStore], srcVal);
                } else if (dstPath.startsWith('[]')) {
                    const keyArr = dstPath.substring(2);
                    dsRes[dstStore][keyArr] = Array.isArray(srcVal) ? srcVal : [srcVal];
                } else if (dstPath.includes('.')) {
                    // deep path build
                    const parts = dstPath.split('.');
                    let tgt = dsRes[dstStore];
                    for (let i = 0; i < parts.length; i++) {
                        const part = parts[i];
                        if (i === parts.length - 1) {
                            tgt[part] = srcVal;
                        } else {
                            tgt[part] = tgt[part] || {};
                            tgt = tgt[part];
                        }
                    }
                } else {
                    dsRes[dstStore][dstPath] = srcVal;
                }

            }
            return; // processed new row
        }
    }); // end first forEach (new rows)

    // -----------------------------------
    // Legacy path (original implementation)
    // -----------------------------------

    parameterDefinitions.forEach((param) => {
        if (isCompactedFormat(param)) return; // already processed above new-style legacy out captured

        if (param.output === true) {
            outboundRows.push(param);
            return;
        }
        // 'to' is the preferred attribute naming the destination DataSourceRef.
        // Fallback to legacy 'kind' for backward-compatibility.
        const toDataSource = param.to || param.kind;
        if (toDataSource && !resolved[toDataSource]) {
            resolved[toDataSource] = {};
        }

        const {name, in: inWhere, location} = param;
        const value = resolveParameter(context, inWhere, location);
        if(name === "...") {
            resolved[toDataSource] = {...value}
        } else if(name.startsWith("[]")) {
            const key = name.substring(2);
            resolved[toDataSource][key] = [value];
        } else if(name.includes(".")) {
            const parts = name.split(".");
            let selected = resolved
            if(toDataSource) {
                selected = resolved[toDataSource]
            }
            for(let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if(!selected[part])  {
                    selected[part] = {}
                }
                if (i === parts.length - 1) {
                    selected[part] = value;
                }
                selected = selected[part]

            }

        } else {
            if(toDataSource) {
                assignResolvedField(resolved[toDataSource], name, value);
            } else {
                assignResolvedField(resolved, name, value);
            }
        }
    });
    if (outboundRows.length === 0) {
        return resolved;
    }
    return { inbound: resolved, outbound: outboundRows };
}



function resolveParameter(context, inWhere, location) {
    switch (inWhere) {
        case 'selection':
            return resolveFromSelection(context, location);
        case 'form':
            return resolveFromValuesForm(context, location);
        case 'dataSource':
            return resolveFromLegacyDataSource(context, location);
        case 'windowForm':
            return resolveFromWindowForm(context, location);
        case 'metadata':
            return resolveFromMetadata(context, location);
        case 'filterSet':
            return resolveFromFilterSet(context, location);
        case 'metrics':
            return resolveFromDataSource(context, location, 'metrics');
        case 'input':
            return resolveFromDataSource(context, location, 'input');
        case 'filter':
            return resolveFromDataSource(context, location, 'filter');
        case 'tableSetting':
            return resolveFromTableSetting(context, location);
        case 'const':
            return location;
        default:
            console.warn(`resolveParameters: unknown legacy 'in' value: ${inWhere}`, { location });
            return undefined;
    }
}

function resolveLegacyLocationContext(context, location) {
    const rawLocation = typeof location === 'string' ? location.trim() : '';
    if (!rawLocation) {
        return { sourceContext: context, sourcePath: rawLocation };
    }

    const dotIndex = rawLocation.indexOf('.');
    if (dotIndex > 0) {
        const possibleDataSourceRef = rawLocation.substring(0, dotIndex);
        if (context.dataSources?.[possibleDataSourceRef]) {
            return {
                sourceContext: context.Context(possibleDataSourceRef),
                sourcePath: rawLocation.substring(dotIndex + 1),
            };
        }
    }

    return { sourceContext: context, sourcePath: rawLocation };
}

function resolveFromLegacyDataSource(context, location) {
    const { sourceContext, sourcePath } = resolveLegacyLocationContext(context, location);
    const selected = sourceContext?.handlers?.dataSource?.peekSelection?.()?.selected;
    const formData = sourceContext?.handlers?.dataSource?.peekFormData?.();
    const filterData = sourceContext?.handlers?.dataSource?.peekFilter?.();
    const inputData = sourceContext?.signals?.input?.peek?.();

    const candidates = [selected, formData, filterData, inputData];
    for (const candidate of candidates) {
        if (!candidate) continue;
        const resolved = sourcePath ? resolveSelector(candidate, sourcePath) : candidate;
        if (resolved !== undefined) {
            return resolved;
        }
    }

    // Some older metadata points at a data-source ref directly.
    if (sourcePath && context.dataSources?.[sourcePath]) {
        const dataSourceContext = context.Context(sourcePath);
        return dataSourceContext?.handlers?.dataSource?.peekSelection?.()?.selected
            ?? dataSourceContext?.handlers?.dataSource?.peekFormData?.()
            ?? dataSourceContext?.handlers?.dataSource?.peekFilter?.()
            ?? undefined;
    }

    return undefined;
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

function resolveFromWindowForm(context, location) {
    const formData = context?.signals?.windowForm?.peek?.() || {};
    if (!location) {
        return formData;
    }
    return resolveSelector(formData, location);
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


function resolveFromDataSource(context, location, scope = 'form') {
    let dataSourceRef;
    let fieldPath;

    const dotIndex = location.indexOf('.');
    if (dotIndex === -1) {
        dataSourceRef = location;
        fieldPath = '';
    } else {
        dataSourceRef = location.substring(0, dotIndex);
        fieldPath = location.substring(dotIndex + 1);
    }

    const dsCtx = context.Context(dataSourceRef);

    let storeObj;
    switch (scope) {
        case 'form':
            storeObj = dsCtx.handlers.dataSource.peekFormData();
            break;
        case 'filter':
            storeObj = dsCtx.handlers.dataSource.peekFilter();
            break;
        case 'selection':
            storeObj = dsCtx.handlers.dataSource.peekSelection();
            break;
        case 'input':
            storeObj = dsCtx.signals.input.peek();
            break;
        case 'metrics':
            storeObj = dsCtx.signals.metrics.peek();
            break;
        default:
            storeObj = dsCtx.handlers.dataSource.peekFormData();
    }

    if (!fieldPath) return storeObj;
    return resolveSelector(storeObj, fieldPath);
}
