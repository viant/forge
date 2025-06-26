import {toUTC, fromUTC, getZoneOffset, timeAt} from "../utils/datetime.js";
import {format, parse, parseISO} from "date-fns";


const utilities = {
    date: {
        toUTC,
        fromUTC,
        getZoneOffset,
        format,
        parse,
        parseISO,
        timeAt,
    }
}


export function injectActions(metadata) {
    if (!metadata || !metadata.actions) {
        metadata['actions'] = {
            import: () => {
                return {}
            }
        };
        return
    }
    const namespace = metadata.namespace;
    if (!namespace) {
        throw new Error("Namespace is required for action injection.");
    }
    try {

        const actionCode = metadata.actions.code;
        const fn = new Function('context', 'utilities', 'with(context,utilities) { return ' + actionCode + ';}')
        metadata.actions['import'] = (context) => {
            const result = fn(context, utilities)
            return {[namespace]: result}
        }

    } catch (error) {
        console.error("Error injecting actions:", error);
        throw error;
    }
}


/**
 * Resolve a dot-separated action name to the corresponding function in the registry.
 */
export const resolveHandler = (registry = {}, name) => {
    const keys = name.split(".");
    let result = registry;
    for (const key of keys) {
        if (!key || typeof result[key] === "undefined") {
            let reportAvailableKeys = ''
            for (const key in result) {
                reportAvailableKeys += +' ' + key
            }
            throw new Error(`Handler key "${key}" not found in registry, avails: "${reportAvailableKeys}".`, result);
        }
        result = result[key]
    }

    if (typeof result !== "function") {
        throw new Error(`Resolved handler "${name}" is not a function.`);
    }
    return result;
};

