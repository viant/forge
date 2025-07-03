// parameterMapper.js – single place to translate a Parameter descriptor
// defined in docs/window-parameter-passing.md into assignments on the target
// object.  This logic is used by window/dialog parameter passing as well as
// DataSource dependency propagation so that the two flows stay in sync.

import { resolveSelector } from './selector.js';

function spreadInto(target, source) {
    if (!source || typeof source !== 'object') return;
    Object.entries(source).forEach(([k, v]) => {
        target[k] = v;
    });
}

export function mapParameter({ param, sourceData, targetData }) {
    if (!param || !param.name) return;

    const { name, location } = param;

    // Handle spread ("...")  – copy every property from source (or subtree)
    if (name === '...') {
        const sub = location ? resolveSelector(sourceData, location) : sourceData;
        spreadInto(targetData, sub);
        return;
    }

    // Handle array wrapper – name starts with []
    if (name.startsWith('[]')) {
        const bare = name.slice(2);
        const val = resolveSelector(sourceData, location || bare);
        if (val !== undefined) {
            targetData[bare] = Array.isArray(val) ? val : [val];
        }
        return;
    }

    // Default one-to-one mapping
    const val = resolveSelector(sourceData, location || name);
    targetData[name] = val;
}

export function mapParameters(params = [], sourceData, targetData) {
    params.forEach((p) => mapParameter({ param: p, sourceData, targetData }));
}
