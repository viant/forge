import {extractData} from './dataEnvelopeModel.js';
import {normalizeRelativeDaysRange, requireCalendarAnchorDate, requireCalendarTimeZone, resolveDeclaredDateRangePreset} from '../packs/blueprint/dateRangePreset.js';

const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const forbidden = new Set(['__proto__', 'prototype', 'constructor', 'backend', 'credentials', 'secretRef', 'service', 'method', 'source']);
const alias = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]*$/.test(value) && !forbidden.has(value);
const only = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
function path(value) {
    if (typeof value !== 'string' || value.length > 256 || value.split('.').length > 8 || !value.split('.').every(alias)) throw new Error('Invalid calendar field path.');
    return value;
}
function read(value, selector) {
    for (const key of path(selector).split('.')) {
        if (!object(value) || !Object.hasOwn(value, key)) return undefined;
        value = value[key];
    }
    return value;
}
export function normalizeReportDatePresets(value, dataSources = {}) {
    if (!only(value, ['calendar', 'default', 'options', 'valueParameter']) || !only(value.calendar, ['dataSourceRef', 'input', 'identityField', 'timeZoneField', 'anchorField', 'inputs'])) throw new Error('Invalid date-preset declaration.');
    if (value.valueParameter !== undefined && !alias(value.valueParameter)) throw new Error('Invalid date-preset value parameter.');
    const calendar = value.calendar, input = calendar.input;
    if (value.valueParameter !== undefined && value.valueParameter === input?.parameter) throw new Error('Date-preset value parameter must differ from calendar identity.');
    if (!alias(calendar.dataSourceRef) || !Object.hasOwn(dataSources, calendar.dataSourceRef)
        || !only(input, ['name', 'parameter', 'array']) || !alias(input.name) || !alias(input.parameter)
        || input.array !== undefined && typeof input.array !== 'boolean') throw new Error('Invalid calendar datasource binding.');
    if (calendar.inputs != null && !Array.isArray(calendar.inputs)) throw new Error('Invalid calendar input bindings.');
    const inputNames = new Set([input.name]);
    const inputs = (calendar.inputs || []).map(binding => {
        if (!only(binding, ['name', 'parameter', 'array']) || !alias(binding.name) || !alias(binding.parameter)
            || binding.array != null && typeof binding.array !== 'boolean' || inputNames.has(binding.name)) throw new Error('Invalid calendar input binding.');
        inputNames.add(binding.name);
        if (binding.parameter === value.valueParameter) throw new Error('Date-preset value parameter must differ from calendar inputs.');
        return {name: binding.name, parameter: binding.parameter, array: binding.array === true};
    });
    if (dataSources[calendar.dataSourceRef]?.cache?.enabled !== false) throw new Error('Calendar context requires a datasource with caching disabled.');
    path(calendar.identityField); path(calendar.timeZoneField);
    if (calendar.anchorField != null) path(calendar.anchorField);
    if (!Array.isArray(value.options) || value.options.length < 1 || value.options.length > 16) throw new Error('Invalid date-preset options.');
    const seen = new Set(), folded = new Set();
    const options = value.options.map(option => {
        if (!only(option, ['value', 'label', 'range']) || !alias(option.value) || folded.has(option.value.toLowerCase())
            || typeof option.label !== 'string' || !option.label.trim() || option.label.length > 160) throw new Error('Invalid date-preset option.');
        if (option.value.toLowerCase() === 'custom' && option.value !== 'custom') throw new Error('The manual date option must use the canonical custom value.');
        seen.add(option.value);folded.add(option.value.toLowerCase());
        if (option.range !== undefined) {
            if (option.range?.anchor === 'sourceDate' && calendar.anchorField == null) throw new Error('A source-date range requires a calendar anchor field.');
            if (option.value === 'custom') throw new Error('Manual dates cannot declare a relative range.');
            return {value: option.value, label: option.label, range: normalizeRelativeDaysRange(option.range)};
        }
        if (!['custom', 'yesterday', 'month_to_date', 'last_month'].includes(option.value)) throw new Error('A declared relative-days range is required for this preset.');
        return {value: option.value, label: option.label};
    });
    if (!seen.has('custom') || !seen.has(value.default) || value.default === 'custom') throw new Error('A relative default and manual date option are required.');
    return {calendar: {dataSourceRef: calendar.dataSourceRef, input: {name: input.name, parameter: input.parameter, array: input.array === true}, identityField: calendar.identityField, timeZoneField: calendar.timeZoneField, ...(calendar.inputs != null ? {inputs} : {}), ...(calendar.anchorField != null ? {anchorField: calendar.anchorField} : {})}, default: value.default, options, ...(value.valueParameter ? {valueParameter:value.valueParameter} : {})};
}
export function reportDatePresetInputs(declaration, parameters) {
    let identity = parameters?.[declaration.calendar.input.parameter];
    if (Array.isArray(identity)) {
        if (identity.length !== 1) throw new Error('Choose exactly one valid calendar identity.');
        identity = identity[0];
    }
    if (!Number.isSafeInteger(identity) || identity <= 0) throw new Error('Choose a valid calendar identity.');
    const inputs = {[declaration.calendar.input.name]: declaration.calendar.input.array ? [identity] : identity};
    for (const binding of declaration.calendar.inputs || []) {
        if (!Object.hasOwn(parameters || {}, binding.parameter) || parameters[binding.parameter] === undefined) continue;
        const value = parameters[binding.parameter];
        inputs[binding.name] = binding.array && value !== null && !Array.isArray(value) ? [value] : value;
    }
    return {identity, inputs};
}
export function decodeReportDateCalendar(declaration, identity, response) {
    const rows = extractData({}, undefined, response).records;
    if (!Array.isArray(rows) || rows.length !== 1 || read(rows[0], declaration.calendar.identityField) !== identity) throw new Error('Calendar context does not match the selected identity.');
    return {timeZone: requireCalendarTimeZone(read(rows[0], declaration.calendar.timeZoneField)),
        ...(declaration.calendar.anchorField != null ? {anchorDate: requireCalendarAnchorDate(read(rows[0], declaration.calendar.anchorField))} : {})};
}
export {resolveDeclaredDateRangePreset};

// Canonical authored admission uses the same declaration consumed by report hosts.
export const reportDatePresetsSchema = {
 type:'object', additionalProperties:false, required:['calendar','default','options'], properties:{
  valueParameter:{type:'string',pattern:'^[A-Za-z][A-Za-z0-9_]*$'}, default:{type:'string'},
  calendar:{type:'object',additionalProperties:false,required:['dataSourceRef','input','identityField','timeZoneField'],properties:{
   dataSourceRef:{type:'string',minLength:1},identityField:{type:'string',minLength:1},timeZoneField:{type:'string',minLength:1},anchorField:{type:['string','null'],minLength:1},
   inputs:{type:['array','null'],items:{type:'object',additionalProperties:false,required:['name','parameter'],properties:{name:{type:'string',minLength:1},parameter:{type:'string',minLength:1},array:{type:['boolean','null']}}}},
   input:{type:'object',additionalProperties:false,required:['name','parameter'],properties:{name:{type:'string',minLength:1},parameter:{type:'string',minLength:1},array:{type:'boolean'}}}}},
  options:{type:'array',minItems:1,maxItems:16,items:{type:'object',additionalProperties:false,required:['value','label'],properties:{
   value:{type:'string',minLength:1},label:{type:'string',minLength:1,maxLength:160},
   range:{type:'object',additionalProperties:false,required:['kind','startOffset','endOffset'],properties:{kind:{const:'relativeDays'},anchor:{enum:['sourceDate',null]},startOffset:{type:'integer',minimum:-36600,maximum:0},endOffset:{type:'integer',minimum:-36600,maximum:0}}}}}},
 }
};
