import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Tree } from '@blueprintjs/core';
import { Switch } from '@blueprintjs/core';

/* -------------------------------------------------------------------
 * TreeMultiSelect – hierarchical multi–select control based on
 * Blueprint Tree & Switch components.
 *
 * Props
 *   options     Array<{ value: string, label: string }>
 *   value       string[] – currently selected option values (leaf values)
 *   onChange    (values: string[]) => void
 *   separator   string – hierarchy delimiter within value (default "_")
 *   readOnly    boolean – disables interaction
 * ------------------------------------------------------------------- */

// Helper – build a tree structure from flat option list
function buildTree(options, separator) {
    const rootMap = new Map();

    options.forEach(({ value, label }) => {
        const parts = value.split(separator);
        let currentLevel = rootMap;

        parts.forEach((part, idx) => {
            const isLeaf = idx === parts.length - 1;
            const key = parts.slice(0, idx + 1).join(separator);
            if (!currentLevel.has(part)) {
                currentLevel.set(part, {
                    id: key,
                    label: part,
                    fullValue: isLeaf ? value : null,
                    childrenMap: new Map(),
                    optionLabel: isLeaf ? label : part,
                });
            }
            const node = currentLevel.get(part);
            currentLevel = node.childrenMap;
        });
    });

    // Recursively convert Map structure produced above into Blueprint Tree node list
    const mapToNodes = (map) => {
        return Array.from(map.values()).map((n) => {
            const childNodes = mapToNodes(n.childrenMap);
            const hasChildren = childNodes.length > 0;
            return {
                id: n.id,
                label: n.optionLabel,
                childNodes: childNodes,
                fullValue: n.fullValue, // undefined for non-leaf
                hasCaret: hasChildren,
                isExpanded: false,
            };
        });
    };

    return mapToNodes(rootMap);
}

export default function TreeMultiSelect({
    options = [],
    value: selectedValues = [],
    onChange,
    separator = '_',
    readOnly = false,
    ...rest
}) {
    const [nodes, setNodes] = useState([]);

    // Build tree once options change
    useEffect(() => {
        const built = buildTree(options, separator);
        setNodes(built);
    }, [options, separator]);

    // Utility – list leaf values under a node (recursive)
    const leafValuesUnder = useCallback((node) => {
        if (node.fullValue) return [node.fullValue];
        if (!node.childNodes) return [];
        return node.childNodes.flatMap(leafValuesUnder);
    }, []);

    /* --------------------------------------------------------------
     * Selection helpers
     * ---------------------------------------------------------- */

    const isLeafSelected = (leaf) => selectedValues.includes(leaf.fullValue);

    const areAllChildrenSelected = (node) => {
        const leaves = leafValuesUnder(node);
        return leaves.every((v) => selectedValues.includes(v));
    };

    const areSomeChildrenSelected = (node) => {
        const leaves = leafValuesUnder(node);
        return leaves.some((v) => selectedValues.includes(v)) && !areAllChildrenSelected(node);
    };

    /* --------------------------------------------------------------
     * Rendering helpers
     * ---------------------------------------------------------- */
    const renderLabelForNode = (node) => {
        const isLeaf = !!node.fullValue;

        if (isLeaf) {
            const checked = isLeafSelected(node);
            return (
                <Switch
                    checked={checked}
                    disabled={readOnly}
                    onChange={() => toggleLeaf(node)}
                    label={node.label}
                />
            );
        }

        // Parent node – simple square indicator
        const all = areAllChildrenSelected(node);
        const partial = areSomeChildrenSelected(node);
        const boxStyle = {
            display: 'inline-block',
            width: 12,
            height: 12,
            marginRight: 6,
            border: '1px solid currentColor',
            backgroundColor: all ? 'currentColor' : 'transparent',
            position: 'relative',
        };

        const dotStyle = {
            position: 'absolute',
            top: 3,
            left: 3,
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: partial ? 'currentColor' : 'transparent',
        };

        return (
            <span
                onClick={(e) => {
                    e.stopPropagation();
                    toggleBranch(node);
                }}
                style={{ cursor: readOnly ? 'default' : 'pointer', userSelect: 'none' }}
            >
                <span style={boxStyle}>
                    <span style={dotStyle} />
                </span>
                {node.label}
            </span>
        );
    };

    // Toggle handlers
    const toggleLeaf = (leafNode) => {
        if (readOnly) return;
        const exists = selectedValues.includes(leafNode.fullValue);
        const next = exists
            ? selectedValues.filter((v) => v !== leafNode.fullValue)
            : [...selectedValues, leafNode.fullValue];
        onChange?.(next);
    };

    const toggleBranch = (node) => {
        if (readOnly) return;
        const leaves = leafValuesUnder(node);
        const allSel = leaves.every((l) => selectedValues.includes(l));
        let next;
        if (allSel) {
            next = selectedValues.filter((v) => !leaves.includes(v));
        } else {
            const set = new Set([...selectedValues, ...leaves]);
            next = Array.from(set);
        }
        onChange?.(next);
    };

    /* --------------------------------------------------------------
     * Augment original tree nodes with runtime state (expanded, selected…)
     * Blueprint Tree requires new objects for state updates, so compute on render
     * ---------------------------------------------------------- */
    const decoratedNodes = useMemo(() => {
        const decorate = (node) => {
            const isLeaf = !!node.fullValue;
            const newNode = { ...node };
            newNode.label = renderLabelForNode(node);
            newNode.isSelected = false; // we handle visuals ourselves
            if (node.childNodes) {
                newNode.childNodes = node.childNodes.map(decorate);
            }
            return newNode;
        };
        return nodes.map(decorate);
    }, [nodes, selectedValues, readOnly]);

    // Tree expand/collapse handlers – keep simple local state
    const handleNodeExpand = (nodeData) => {
        nodeData.isExpanded = true;
        setNodes([...nodes]);
    };
    const handleNodeCollapse = (nodeData) => {
        nodeData.isExpanded = false;
        setNodes([...nodes]);
    };

    return (
        <Tree
            {...rest}
            contents={decoratedNodes}
            onNodeCollapse={handleNodeCollapse}
            onNodeExpand={handleNodeExpand}
        />
    );
}
