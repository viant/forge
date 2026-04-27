import React, { useEffect, useMemo, useState } from 'react';
import { NonIdealState, Tree, Tag } from '@blueprintjs/core';
import { useSignalEffect } from '@preact/signals-react';
import { buildTreeBrowserNodes } from './treeBrowserUtils.js';
import { treeBrowserHandlers } from "../hooks";
import { getLogger } from '../utils/logger.js';
import { formatDataSourceError } from '../utils/dataSourceError.js';
import './tree-browser.css';

function decorateNodes(nodes = [], expanded = new Set(), depth = 0, onNodeActivate = null, parentPath = []) {
    return nodes.map((node, index) => {
        const nodePath = [...parentPath, index];
        const childNodes = decorateNodes(node.childNodes || [], expanded, depth + 1, onNodeActivate, nodePath);
        const hasChildren = childNodes.length > 0;
        const secondary = String(node.secondaryLabel || '').trim();
        const rowClassName = [
            'forge-tree-browser-row',
            node.isLeaf ? 'is-leaf' : 'is-branch',
            depth === 0 ? 'is-root' : 'is-nested',
            `depth-${depth}`,
        ].join(' ');
        return {
            ...node,
            nodePath,
            isExpanded: expanded.has(node.id),
            hasCaret: hasChildren,
            icon: hasChildren ? (expanded.has(node.id) ? 'folder-open' : 'folder-close') : 'tag',
            childNodes,
            label: (
                <div
                    className={rowClassName}
                    data-tree-depth={depth}
                    data-tree-kind={node.isLeaf ? 'leaf' : (depth === 0 ? 'root' : 'branch')}
                    onClick={(event) => {
                        if (typeof onNodeActivate !== 'function') return;
                        event.preventDefault();
                        event.stopPropagation();
                        onNodeActivate({ ...node, nodePath }, event);
                    }}
                >
                    <div className="forge-tree-browser-main">
                        <span className="forge-tree-browser-label">{node.label}</span>
                        {secondary ? <Tag minimal className="forge-tree-browser-badge">{secondary}</Tag> : null}
                    </div>
                </div>
            ),
        };
    });
}

export default function TreeBrowser(props) {
    const { context, config = {}, isActive } = props;
    const { handlers, signals } = context;
    const { control } = signals;
    const log = getLogger('tree');
    const [treeNodes, setTreeNodes] = useState([]);
    const [expanded, setExpanded] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const events = treeBrowserHandlers(context, config);

    const rebuildTree = (collection) => {
        if (!Array.isArray(collection)) {
            setTreeNodes([]);
            return;
        }
        let rows = collection;
        try {
            if (events.onPrepareTreeData && events.onPrepareTreeData.isDefined()) {
                const transformed = events.onPrepareTreeData.execute({ collection, context });
                if (Array.isArray(transformed)) {
                    rows = transformed;
                } else if (Array.isArray(transformed?.collection)) {
                    rows = transformed.collection;
                }
            }
        } catch (e) {
            console.warn('TreeBrowser – onPrepareTreeData failed, using original collection', e);
        }
        setTreeNodes(buildTreeBrowserNodes(rows, config));
    };

    useSignalEffect(() => {
        const { loading, error } = control.value || {};
        setLoading(loading);
        setError(error);
        rebuildTree(handlers.dataSource.getCollection());
    });

    useEffect(() => {
        const data = handlers.dataSource.getCollection();
        if (Array.isArray(data) && data.length > 0) {
            rebuildTree(data);
            setLoading(false);
        } else {
            events.onInit.execute({});
        }
    }, [isActive]);

    const decoratedNodes = useMemo(
        () => decorateNodes(treeNodes, expanded, 0, (node, event) => handleNodeClick(node, node.nodePath || [], event)),
        [treeNodes, expanded]
    );

    const handleNodeExpand = (nodeData, nodePath, e) => {
        try { log.info('[expand]', { id: nodeData?.id, label: nodeData?.label, nodePath }); } catch (_) {}
        setExpanded((prev) => new Set(prev).add(nodeData.id));
        if (config.lazyExpand && (!nodeData.childNodes || nodeData.childNodes.length === 0) && events.onFolderSelect?.isDefined?.()) {
            events.onFolderSelect.execute({
                event: e,
                node: nodeData,
                nodePath,
                item: nodeData.nodeData || null,
                nodeData: nodeData.nodeData || null,
            });
        }
    };

    const handleNodeCollapse = (nodeData) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            next.delete(nodeData.id);
            return next;
        });
    };

    const handleNodeClick = (nodeData, nodePath, e) => {
        try { log.info('[click]', { id: nodeData?.id, label: nodeData?.label, isLeaf: nodeData?.isLeaf, nodePath }); } catch (_) {}
        if (!nodeData.isLeaf) {
            if (nodeData.isExpanded) {
                handleNodeCollapse(nodeData);
            } else {
                handleNodeExpand(nodeData, nodePath, e);
            }
            return;
        }

        const selection = {
            selected: {
                ...(nodeData.nodeData || {}),
                label: String((nodeData.nodeData && nodeData.nodeData.label) || nodeData.label || '').trim(),
                displayPath: Array.isArray(nodeData.nodeData?.path)
                    ? nodeData.nodeData.path.join(' / ')
                    : String(nodeData.nodeData?.displayPath || '').trim(),
                value: nodeData.nodeData?.value ?? nodeData.fullValue,
            },
            rowIndex: -1,
            nodePath,
        };
        try { log.info('[select]', selection); } catch (_) {}

        if (events.onNodeSelect?.isDefined?.()) {
            events.onNodeSelect.execute({
                event: e,
                node: nodeData,
                nodePath,
                item: selection.selected,
                row: selection.selected,
                nodeData: selection.selected,
            });
        }
    };

    if (loading && decoratedNodes.length === 0) {
        return <div className="forge-tree-browser-state">Loading…</div>;
    }

    if (error && decoratedNodes.length === 0) {
        return <div className="forge-tree-browser-state forge-tree-browser-error">{formatDataSourceError(error)}</div>;
    }

    if (decoratedNodes.length === 0) {
        return <NonIdealState icon="tree" description="No tree data" layout="horizontal" />;
    }

    return (
        <div className={`forge-tree-browser ${config.className || ''}`} style={config.style || {}}>
            <Tree
                contents={decoratedNodes}
                onNodeExpand={handleNodeExpand}
                onNodeCollapse={handleNodeCollapse}
            />
        </div>
    );
}
