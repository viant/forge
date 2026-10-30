import {normalizeRelativeDaysRange, requireCalendarTimeZone, resolveDeclaredDateRangePreset} from '../packs/blueprint/dateRangePreset.js';

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
    if (!only(value, ['calendar', 'default', 'options']) || !only(value.calendar, ['dataSourceRef', 'input', 'identityField', 'timeZoneField'])) throw new Error('Invalid date-preset declaration.');
    const calendar = value.calendar, input = calendar.input;
    if (!alias(calendar.dataSourceRef) || !Object.hasOwn(dataSources, calendar.dataSourceRef)
        || !only(input, ['name', 'parameter', 'array']) || !alias(input.name) || !alias(input.parameter)
        || input.array !== undefined && typeof input.array !== 'boolean') throw new Error('Invalid calendar datasource binding.');
    if (dataSources[calendar.dataSourceRef]?.cache?.enabled !== false) throw new Error('Calendar context requires a datasource with caching disabled.');
    path(calendar.identityField); path(calendar.timeZoneField);
    if (!Array.isArray(value.options) || value.options.length < 1 || value.options.length > 16) throw new Error('Invalid date-preset options.');
    const seen = new Set(), folded = new Set();
    const options = value.options.map(option => {
        if (!only(option, ['value', 'label', 'range']) || !alias(option.value) || folded.has(option.value.toLowerCase())
            || typeof option.label !== 'string' || !option.label.trim() || option.label.length > 160) throw new Error('Invalid date-preset option.');
        if (option.value.toLowerCase() === 'custom' && option.value !== 'custom') throw new Error('The manual date option must use the canonical custom value.');
        seen.add(option.value);folded.add(option.value.toLowerCase());
        if (option.range !== undefined) {
            if (option.value === 'custom') throw new Error('Manual dates cannot declare a relative range.');
            return {value: option.value, label: option.label, range: normalizeRelativeDaysRange(option.range)};
        }
        if (!['custom', 'yesterday', 'month_to_date', 'last_month'].includes(option.value)) throw new Error('A declared relative-days range is required for this preset.');
        return {value: option.value, label: option.label};
    });
    if (!seen.has('custom') || !seen.has(value.default) || value.default === 'custom') throw new Error('A relative default and manual date option are required.');
    return {calendar: {dataSourceRef: calendar.dataSourceRef, input: {name: input.name, parameter: input.parameter, array: input.array === true}, identityField: calendar.identityField, timeZoneField: calendar.timeZoneField}, default: value.default, options};
}
export function reportDatePresetInputs(declaration, parameters) {
    let identity = parameters?.[declaration.calendar.input.parameter];
    if (Array.isArray(identity)) {
        if (identity.length !== 1) throw new Error('Choose exactly one valid calendar identity.');
        identity = identity[0];
    }
    if (!Number.isSafeInteger(identity) || identity <= 0) throw new Error('Choose a valid calendar identity.');
    return {identity, inputs: {[declaration.calendar.input.name]: declaration.calendar.input.array ? [identity] : identity}};
}
export function decodeReportDateCalendar(declaration, identity, response) {
    const rows = response?.data;
    if (!Array.isArray(rows) || rows.length !== 1 || read(rows[0], declaration.calendar.identityField) !== identity) throw new Error('Calendar context does not match the selected identity.');
    return {timeZone: requireCalendarTimeZone(read(rows[0], declaration.calendar.timeZoneField))};
}
export {resolveDeclaredDateRangePreset};
