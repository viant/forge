import {resolveTemplate} from "./selector.js";


export function expandRepeatItems(collection,  repeatConfig, iterator, state) {
    return collection.map((itemData) => {
        const itemTemplate = repeatConfig.item;
        // Deep clone itemTemplate (use structuredClone if available)
        const itemInstance = JSON.parse(JSON.stringify(itemTemplate));
        // Function to recursively replace variables in the itemInstance
        const replaceVariables = (obj) => {
            if (typeof obj === "string") {
                return resolveTemplate(obj, {[iterator]: itemData, state});
            } else if (Array.isArray(obj)) {
                return obj.map(replaceVariables);
            } else if (typeof obj === "object" && obj !== null) {
                return Object.fromEntries(
                    Object.entries(obj).map(([key, value]) => [key, replaceVariables(value)])
                );
            }
            return obj;
        };

        return replaceVariables(itemInstance);
    });
}
