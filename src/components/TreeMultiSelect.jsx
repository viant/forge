import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Tree, Switch, NonIdealState, Tooltip } from '@blueprintjs/core';

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

    options.forEach(({ value, label, tooltip }) => {
        const parts = value.split(separator);
        let currentLevel = rootMap;

        parts.forEach((part, idx) => {
            const isLeaf = idx === parts.length - 1;
            const key = parts.slice(0, idx + 1).join(separator);
            if (!currentLevel.has(part)) {
                const initialLabel = isLeaf ? (label === value ? part : label) : part;
                currentLevel.set(part, {
                    id: key,
                    label: initialLabel,
                    fullValue: isLeaf ? value : null,
                    childrenMap: new Map(),
                    optionLabel: isLeaf ? initialLabel : part,
                    tooltip: isLeaf ? tooltip : undefined,
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
                tooltip: n.tooltip,
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
    separator = '-',
    readOnly = false,
    ...rest
}) {

    const [nodes, setNodes] = useState([]);
    const [expanded, setExpanded] = useState(new Set());

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
            const sw = (
                <Switch
                    style={{ margin: '4px 2px' }}
                    checked={checked}
                    disabled={readOnly}
                    onChange={(e) => {
                        e.stopPropagation();
                        toggleLeaf(node);
                    }}
                    label={node.label}
                    alignIndicator="right"
                />
            );
            return node.tooltip ? (
                <Tooltip content={node.tooltip} placement="right" hoverOpenDelay={250}>
                    {sw}
                </Tooltip>
            ) : (
                sw
            );
        }

        // Parent node – simple square indicator
        const all = areAllChildrenSelected(node);
        const partial = areSomeChildrenSelected(node);
        const boxStyle = {
            display: 'inline-block',
            width: 14,
            height: 14,
            marginRight: 6,
            border: '1px solid currentColor',
            backgroundColor: all ? 'currentColor' : 'transparent',
            position: 'relative',
        };

        const dotStyle = {
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 6,
            height: 6,
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
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
            newNode.isExpanded = expanded.has(node.id);
            if (node.childNodes) {
                newNode.childNodes = node.childNodes.map(decorate);
            }
            return newNode;
        };
        return nodes.map(decorate);
    }, [nodes, selectedValues, readOnly, expanded]);

    // Tree expand/collapse handlers – keep simple local state
    const handleNodeExpand = (nodeData) => {
        setExpanded(new Set(expanded).add(nodeData.id));
    };
    const handleNodeCollapse = (nodeData) => {
        const next = new Set(expanded);
        next.delete(nodeData.id);
        setExpanded(next);
    };

    return (
        decoratedNodes.length === 0 ? (
            <NonIdealState icon="box" description="No options" layout="horizontal" />
        ) : (
            <Tree
                {...rest}
                contents={decoratedNodes}
                onNodeCollapse={handleNodeCollapse}
                onNodeExpand={handleNodeExpand}
            />
        )
    );
}
