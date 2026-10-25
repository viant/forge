import {normalizeReportBuilderOptionDefinitions} from '../components/dashboard/reportBuilderOptions.js';

const forbidden = new Set(['__proto__','prototype','constructor','backend','credentials','secretRef','service','method','source','rows','reportSpec','reportFill','reportPrint']);
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
function pathParts(path) {
    const parts = typeof path === 'string' ? path.split('.') : [];
    if (!parts.length || parts.length > 8 || parts.some(part => !/^[A-Za-z][A-Za-z0-9_]*$/.test(part) || forbidden.has(part))) throw new Error('Invalid report request binding path.');
    return parts;
}
function read(value,path) {
    for (const part of pathParts(path)) {
        if (!object(value) || !Object.hasOwn(value,part)) return undefined;
        value=value[part];
    }
    return value;
}
function write(target,path,value) {
    const parts=pathParts(path);
    for (const part of parts.slice(0,-1)) {
        if (Object.hasOwn(target,part) && !object(target[part])) throw new Error('Conflicting report request binding paths.');
        target=target[part] ||= {};
    }
    const last=parts.at(-1);
    if (Object.hasOwn(target,last)) throw new Error('Conflicting report request binding paths.');
    target[last]=clone(value);
}
function names(value) {
    let result;
    if (Array.isArray(value)) result=value;
    else if (object(value)) {
        if (Object.keys(value).some(name=>forbidden.has(name)) || Object.values(value).some(selected=>typeof selected!=='boolean')) throw new Error('Invalid enabled-name selection.');
        result=Object.keys(value).filter(key=>value[key]);
    } else throw new Error('Invalid enabled-name selection.');
    if (result.length>2048 || result.some(name=>typeof name!=='string' || !name || name.length>256 || forbidden.has(name))) throw new Error('Invalid enabled-name selection.');
    return [...new Set(result)];
}
export function declaredReportRequestFields(config) {
    return new Set([config,...(config.dataSources || [])].flatMap(source=>[...(source.dimensions || []),...(source.measures || [])])
        .flatMap(field=>[field.id,field.key,field.value]).filter(value=>typeof value==='string' && value));
}
function typed(value,type,config) {
    if (type==='singlePositiveInteger') {
        if (Array.isArray(value)) {
            if (value.length!==1) throw new Error('Select exactly one advertiser or entity for this report.');
            value=value[0];
        }
        type='positiveInteger';
    }
    switch(type) {
    case 'positiveInteger': if (Number.isSafeInteger(value) && value>0) return value; break;
    case 'nonNegativeInteger': if (Number.isSafeInteger(value) && value>=0) return value; break;
    case 'boolean': if (typeof value==='boolean') return value; break;
    case 'string': if (typeof value==='string' && value.length<=8192) return value; break;
    case 'enabledNames': {
        const selected=names(value),allowed=declaredReportRequestFields(config);
        if (selected.some(name=>!allowed.has(name))) throw new Error('The report request references an undeclared field.');
        return selected;
    }
    case 'positiveIntegerList':
        if (Array.isArray(value) && value.length<=2048 && value.every(id=>Number.isSafeInteger(id) && id>0)) return [...new Set(value)].sort((a,b)=>a-b);
        break;
    case 'orderBy':
        if (Array.isArray(value) && value.length<=32 && value.every(item=>typeof item==='string' && /^[A-Za-z][A-Za-z0-9_]*(?: (?:asc|desc))?$/i.test(item))) {
            const allowed=new Set((config.result?.orderFields || []).flatMap(item=>[item.field,item.value]).filter(Boolean));
            if (value.every(item=>allowed.has(item.split(' ')[0]))) return clone(value);
        }
        break;
    case 'declaredOptions': {
        if (!object(value)) break;
        const definitions=new Map(normalizeReportBuilderOptionDefinitions(config.reportOptions).map(option=>[option.name,option]));
        if (Object.keys(value).length>32) break;
        for (const [name,item] of Object.entries(value)) {
            pathParts(name);
            const definition=definitions.get(name);
            if (!definition) throw new Error('The report request references an undeclared option.');
            const optionType={integer:'nonNegativeInteger',number:'number',boolean:'boolean',string:'string'}[definition.type];
            const valid=optionType==='number' ? typeof item==='number' && Number.isFinite(item)
                : definition.type==='integer' ? Number.isSafeInteger(item)
                : optionType==='boolean' ? typeof item==='boolean' : optionType==='string' && typeof item==='string';
            if (!valid || definition.values?.length && !definition.values.some(entry=>Object.is(entry.value,item))) throw new Error('The report request option has an invalid type or value.');
        }
        return clone(value);
    }
    default: throw new Error('Unknown report request binding type.');
    }
    throw new Error('The report request binding has an invalid value type.');
}

export function validateReportRequestOptions(value,config={}) {
    return typed(value,'declaredOptions',config);
}

// Declared identity types are validated before the host fetches a definition.
// No selected entity is inferred from an array's first element.
export function reportRequestWindowIdentity(config={},windowParameters={}) {
    const declaration=config.request?.definitionIdentity;
    if (!object(declaration) || Object.keys(declaration).some(key=>!['fields','catalog'].includes(key)) || !object(declaration.fields) || !Object.keys(declaration.fields).length || Object.keys(declaration.fields).length>8) throw new Error('A declarative report definition identity is required.');
    const result={};
    for (const [name,field] of Object.entries(declaration.fields)) {
        pathParts(name);
        if (!object(field) || Object.keys(field).some(key=>!['path','type','resolveWhenAbsent'].includes(key))) throw new Error('Invalid report definition identity declaration.');
        pathParts(field.path);
        if (!['positiveInteger','singlePositiveInteger','boolean','string'].includes(field.type)) throw new Error('Invalid report definition identity type.');
        const value=read(windowParameters,name);
        if (value===undefined && field.resolveWhenAbsent===true) continue;
        if (value===undefined) throw new Error('A declared report identity parameter is missing.');
        result[name]=typed(value,field.type,config);
    }
    return result;
}

// Host input is the current admitted definition plus declared window values.
// The resulting context is invocation-local; callers cannot supply it as state.
export function hydrateReportRequestEnvelope(config={},windowParameters={},definition={}) {
    if (!config.request?.envelope) return clone(config);
    const next=clone(config),identity=reportRequestWindowIdentity(config,windowParameters);
    for (const [name,field] of Object.entries(config.request.definitionIdentity.fields)) {
        const returned=typed(read(definition,field.path),field.type,config);
        if (Object.hasOwn(identity,name) && identity[name]!==returned) throw new Error('The current report definition identity does not match the selected scope.');
        identity[name]=returned;
    }
    const catalog=config.request.definitionIdentity.catalog;
    if (catalog) {
        if (!object(catalog) || Object.keys(catalog).some(key=>!['path','prefix','separator','fields'].includes(key)) || typeof catalog.prefix!=='string' || typeof catalog.separator!=='string'
            || !Array.isArray(catalog.fields) || catalog.fields.length>8 || catalog.fields.some(name=>!Object.hasOwn(identity,name))) throw new Error('Invalid report catalog identity declaration.');
        const expected=catalog.prefix+catalog.fields.map(name=>String(identity[name])).join(catalog.separator);
        if (read(definition,catalog.path)!==expected) throw new Error('The current report field catalog identity does not match the selected scope.');
    }
    const defaults={global:{},datasets:{}};
    const profiles=config.request.profileQueryDefaults;
    if (profiles) {
        if (!object(profiles) || Object.keys(profiles).some(key=>!['path','values'].includes(key)) || !object(profiles.values) || Object.keys(profiles.values).length>32) throw new Error('Invalid report profile query defaults.');
        const profile=read(definition,profiles.path);
        if (profile!==undefined && typeof profile!=='string') throw new Error('The current report profile is unavailable.');
        if (Object.hasOwn(profiles.values,profile)) defaults.global=clone(profiles.values[profile]);
    }
    const seenSources=new Set();
    for (const source of next.dataSources || []) {
        if (!object(source) || typeof source.id!=='string' || !source.id || forbidden.has(source.id) || seenSources.has(source.id)) throw new Error('Invalid or duplicate declared dataset.');
        seenSources.add(source.id);
        if (!source.queryDefaultsFromDefinition) continue;
        if (!source.id || forbidden.has(source.id) || !object(source.queryDefaultsFromDefinition) || Object.keys(source.queryDefaultsFromDefinition).length>8) throw new Error('Invalid dataset query defaults.');
        const dataset={};
        for (const [name,binding] of Object.entries(source.queryDefaultsFromDefinition)) {
            pathParts(name);
            if (!object(binding) || Object.keys(binding).some(key=>!['path','type'].includes(key)) || binding.type!=='enabledNames') throw new Error('Invalid dataset default binding.');
            const raw=read(definition,binding.path);
            if (raw===undefined) continue;
            const selected=names(raw);
            if (selected.some(field=>!declaredReportRequestFields(next).has(field))) throw new Error('A dataset default references an undeclared field.');
            dataset[name]=Object.fromEntries(selected.map(field=>[field,true]));
        }
        defaults.datasets[source.id]=dataset;
    }
    next.request.envelopeContext={identity,defaults};
    return next;
}

function empty(value) {return value===undefined || Array.isArray(value) && value.length===0 || object(value) && Object.keys(value).length===0;}

// The only transport operation is a typed structural projection. Business
// access remains the producer's decision on every ordinary datasource call.
export function mapReportRequestEnvelope(config={},query={},datasetId='primary') {
    const declaration=config.request?.envelope;
    if (!declaration) return clone(query);
    if (!object(declaration) || Object.keys(declaration).some(key=>!['version','fields'].includes(key)) || declaration.version!==1 || !object(declaration.fields)
        || Object.keys(declaration.fields).length===0 || Object.keys(declaration.fields).length>32 || !object(query)) throw new Error('Invalid report request envelope declaration.');
    const context=config.request.envelopeContext;
    if (!object(context?.identity) || !object(context?.defaults)) throw new Error('The report request identity has not been verified.');
    if (datasetId!=='primary' && !(config.dataSources || []).some(source=>source.id===datasetId)) throw new Error('The report request references an undeclared dataset.');
    const effective=clone(query);
    for (const defaults of [context.defaults.global,context.defaults.datasets?.[datasetId]]) {
        if (!defaults) continue;
        for (const [name,value] of Object.entries(defaults)) {
            if (pathParts(name).length!==1) throw new Error('Query defaults must name a top-level query field.');
            if(empty(effective[name])) effective[name]=clone(value);
        }
    }
    if (Number.isSafeInteger(config.request.maxRows) && config.request.maxRows>0 && Number.isSafeInteger(effective.limit) && effective.limit>config.request.maxRows) effective.limit=config.request.maxRows;
    const result={};
    for (const [destination,field] of Object.entries(declaration.fields)) {
        pathParts(destination);
        if (!object(field) || Object.keys(field).some(key=>!['literal','window','query','type','optional','omitEmpty'].includes(key)) || ['literal','window','query'].filter(key=>Object.hasOwn(field,key)).length!==1
            || field.optional!==undefined && typeof field.optional!=='boolean' || field.omitEmpty!==undefined && typeof field.omitEmpty!=='boolean') throw new Error('Invalid report request envelope field.');
        let value=Object.hasOwn(field,'literal')?field.literal:Object.hasOwn(field,'window')?read(context.identity,field.window):read(effective,field.query);
        if (value===undefined && field.optional===true) continue;
        value=typed(value,field.type,config);
        if (field.omitEmpty===true && (Array.isArray(value) && !value.length || object(value) && !Object.keys(value).length || value==='')) continue;
        write(result,destination,value);
    }
    if (JSON.stringify(result).length>256*1024) throw new Error('The report request envelope exceeds the size limit.');
    return result;
}
