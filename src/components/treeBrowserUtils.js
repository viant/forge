export function resolveTreeValue(holder, selector) {
    if (holder == null) return undefined;
    if (!selector) return holder;
    const parts = String(selector).split('.').filter(Boolean);
    let current = holder;
    for (const part of parts) {
        if (current == null || typeof current !== 'object') {
            return undefined;
        }
        current = current[part];
    }
    return current;
}

function normalizePath(pathValue, separator = '/') {
    if (Array.isArray(pathValue)) {
        return pathValue.map((item) => String(item ?? '').trim()).filter(Boolean);
    }
    const text = String(pathValue ?? '').trim();
    if (!text) return [];
    return text.split(separator).map((item) => String(item ?? '').trim()).filter(Boolean);
}

function normalizeTreeChildren(childrenValue) {
    return Array.isArray(childrenValue) ? childrenValue : [];
}

function makeNodeId(parts, fallback) {
    const base = parts.filter(Boolean).join('::');
    return base || String(fallback || 'node');
}

export function buildTreeBrowserNodes(rows = [], config = {}) {
    const {
        pathField = 'path',
        labelField = '',
        valueField = 'value',
        subtitleField = '',
        childrenField = 'childNodes',
        separator = '/',
    } = config || {};

    const makeLeafNode = (row, parts, index) => {
        const explicitLabel = labelField ? resolveTreeValue(row, labelField) : undefined;
        const value = resolveTreeValue(row, valueField);
        const subtitle = subtitleField
            ? resolveTreeValue(row, subtitleField)
            : value;
        return {
            id: makeNodeId(parts, `leaf-${index}`),
            label: String(explicitLabel ?? parts[parts.length - 1] ?? value ?? 'Item').trim(),
            secondaryLabel: subtitle == null || subtitle === '' ? '' : String(subtitle),
            fullValue: value,
            nodeData: row,
            isLeaf: true,
            childNodes: [],
        };
    };

    const fromNestedRows = (inputRows, parentParts = []) => {
        return inputRows.map((row, index) => {
            const explicitLabel = labelField ? resolveTreeValue(row, labelField) : undefined;
            const pathParts = normalizePath(resolveTreeValue(row, pathField), separator);
            const label = String(explicitLabel ?? pathParts[pathParts.length - 1] ?? row?.label ?? row?.name ?? `Node ${index + 1}`).trim();
            const children = normalizeTreeChildren(resolveTreeValue(row, childrenField));
            const parts = pathParts.length > 0 ? pathParts : [...parentParts, label];
            const value = resolveTreeValue(row, valueField);
            const subtitle = subtitleField
                ? resolveTreeValue(row, subtitleField)
                : value;
            return {
                id: makeNodeId(parts, `node-${index}`),
                label,
                secondaryLabel: subtitle == null || subtitle === '' ? '' : String(subtitle),
                fullValue: children.length === 0 ? value : null,
                nodeData: row,
                isLeaf: children.length === 0,
                childNodes: fromNestedRows(children, parts),
            };
        });
    };

    const hasNestedChildren = rows.some((row) => normalizeTreeChildren(resolveTreeValue(row, childrenField)).length > 0);
    if (hasNestedChildren) {
        return fromNestedRows(rows);
    }

    const rootMap = new Map();
    rows.forEach((row, index) => {
        const explicitLabel = labelField ? resolveTreeValue(row, labelField) : undefined;
        const value = resolveTreeValue(row, valueField);
        const parts = normalizePath(resolveTreeValue(row, pathField), separator);
        const normalizedParts = parts.length > 0
            ? parts
            : [String(explicitLabel ?? value ?? `Item ${index + 1}`).trim()];
        let currentMap = rootMap;
        normalizedParts.forEach((part, partIndex) => {
            const isLeaf = partIndex === normalizedParts.length - 1;
            if (!currentMap.has(part)) {
                currentMap.set(part, {
                    id: makeNodeId(normalizedParts.slice(0, partIndex + 1), `node-${index}-${partIndex}`),
                    label: String(part).trim(),
                    childMap: new Map(),
                    nodeData: isLeaf ? row : null,
                    leafLabel: isLeaf ? String(explicitLabel ?? part).trim() : '',
                    fullValue: isLeaf ? value : null,
                    secondaryLabel: isLeaf
                        ? (subtitleField
                            ? String(resolveTreeValue(row, subtitleField) ?? '')
                            : (value == null || value === '' ? '' : String(value)))
                        : '',
                });
            } else if (isLeaf) {
                const entry = currentMap.get(part);
                entry.nodeData = row;
                entry.leafLabel = String(explicitLabel ?? part).trim();
                entry.fullValue = value;
                entry.secondaryLabel = subtitleField
                    ? String(resolveTreeValue(row, subtitleField) ?? '')
                    : (value == null || value === '' ? '' : String(value));
            }
            currentMap = currentMap.get(part).childMap;
        });
    });

    const mapToNodes = (map) => {
        return Array.from(map.values()).map((entry) => {
            const childNodes = mapToNodes(entry.childMap);
            const isLeaf = childNodes.length === 0;
            return {
                id: entry.id,
                label: isLeaf ? (entry.leafLabel || entry.label) : entry.label,
                secondaryLabel: isLeaf ? entry.secondaryLabel : '',
                fullValue: isLeaf ? entry.fullValue : null,
                nodeData: entry.nodeData,
                isLeaf,
                childNodes,
            };
        });
    };

    return mapToNodes(rootMap);
}
