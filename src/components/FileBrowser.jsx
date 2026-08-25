import React, {useState, useEffect} from 'react';
import {Tree} from '@blueprintjs/core';
import { SoftBlock } from './SoftSkeleton.jsx';
import {useSignalEffect} from '@preact/signals-react';
import { fileBrowserHandlers} from "../hooks/index.js";


// Helper function to get node at a specific path
const getNodeAtPath = (nodes, path) => {
    let node = null;
    let children = nodes;

    for (const index of path) {
        node = children[index];
        if (!node) {
            break;
        }
        children = node.childNodes || [];
    }
    return node;
};

export const resolveFilePreviewPayload = (preview = {}, row = {}) => {
    const currentField = String(preview?.currentField || 'url').trim();
    const previousField = String(preview?.previousField || 'origUrl').trim();
    const diffField = String(preview?.diffField || 'diff').trim();
    return {
        kind: String(preview?.kind || 'file').trim(),
        tool: String(preview?.tool || '').trim(),
        modes: Array.isArray(preview?.modes) ? preview.modes.map(String) : ['current'],
        currentUri: String(row?.[currentField] || row?.uri || row?.url || '').trim(),
        previousUri: String(row?.[previousField] || row?.origUri || row?.origUrl || '').trim(),
        diff: String(row?.[diffField] || row?.diff || ''),
        row,
        preview,
    };
};

export const dedupeFileBrowserRows = (rows = [], field = '') => {
    const key = String(field || '').trim();
    if (!key || !Array.isArray(rows)) return Array.isArray(rows) ? rows : [];
    const deduped = new Map();
    for (const row of rows) {
        const value = String(row?.[key] || '').trim();
        if (!value) continue;
        deduped.set(value, row);
    }
    return Array.from(deduped.values());
};

export const buildFileBrowserTreeRows = (rows = [], pathField = 'url') => {
    const entries = (Array.isArray(rows) ? rows : []).map((row) => ({
        row,
        parts: String(row?.[pathField] || row?.url || row?.uri || '').split('/').filter(Boolean),
    })).filter((entry) => entry.parts.length > 0);
    if (entries.length === 0) return [];
    let common = 0;
    while (entries.every((entry) => entry.parts[common] && entry.parts[common] === entries[0].parts[common])) common += 1;
    const roots = [];
    const folders = new Map();
    for (const entry of entries) {
        const relative = entry.parts.slice(common);
        const parts = relative.length ? relative : [entry.parts[entry.parts.length - 1]];
        let children = roots;
        let folderPath = '';
        for (const part of parts.slice(0, -1)) {
            folderPath = folderPath ? `${folderPath}/${part}` : part;
            let folder = folders.get(folderPath);
            if (!folder) {
                folder = { uri: `/${folderPath}`, name: part, isFolder: true, isExpanded: true, childNodes: [] };
                folders.set(folderPath, folder);
                children.push(folder);
            }
            children = folder.childNodes;
        }
        children.push({ ...entry.row, name: parts[parts.length - 1], isFolder: false, childNodes: [] });
    }
    return roots;
};


const FileBrowser = (props) => {
    const {context, config={}, isActive} = props;
    const {handlers, signals} = context;
    const {control} = signals;
    const [fileTreeData, setFileTreeData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const events = fileBrowserHandlers(context, config);
    const providedRowsSignature = JSON.stringify(Array.isArray(config.rows) ? config.rows : []);
    const resolvedCollection = () => Array.isArray(config.rows)
        ? config.rows
        : handlers.dataSource.getCollection();


    // Helpers to preserve expansion across refreshes
    const collectExpanded = (nodes = [], acc = new Set()) => {
        for (const n of nodes) {
            const key = n?.nodeData?.uri || n?.id;
            if (n?.isFolder && n?.isExpanded && key) acc.add(key);
            if (n?.childNodes?.length) collectExpanded(n.childNodes, acc);
        }
        return acc;
    };

    const applyExpanded = (nodes = [], expanded = new Set()) => {
        for (const n of nodes) {
            if (n?.isFolder) {
                const key = n?.nodeData?.uri || n?.id;
                if (key && expanded.has(key)) {
                    n.isExpanded = true;
                    if (n.nodeData) n.nodeData.isExpanded = true;
                    n.icon = 'folder-open';
                }
                if (n?.childNodes?.length) applyExpanded(n.childNodes, expanded);
            }
        }
    };

    // Whenever the collection signal changes, rebuild tree data
    useSignalEffect(() => {
        if (Array.isArray(config.rows)) return;
        const {loading, error} = control.value || {};
        setLoading(loading);
        setError(error);
        const data = resolvedCollection();

        if (data) {
            // Build tree data from the collection and prepend ".." when we
            // are inside a sub-folder so the user can navigate up.
            const expanded = collectExpanded(fileTreeData);
            let input = dedupeFileBrowserRows(data, config.dedupeBy);
            try {
                if (events.onPrepareTreeData && events.onPrepareTreeData.isDefined()) {
                    const transformed = events.onPrepareTreeData.execute({ collection: data, context });
                    if (Array.isArray(transformed)) {
                        input = transformed;
                    } else if (Array.isArray(transformed?.collection)) {
                        input = transformed.collection;
                    }
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('FileBrowser – onPrepareTreeData failed, using original collection', e);
            }

            let treeData = buildTree(input);

            try {
                const currentUri = handlers.dataSource.peekFilter()?.uri || '';
                const parentUri = currentUri.replace(/\/?[^/]+$/, '') || '/';
                const hasParent = currentUri && currentUri !== '/' && currentUri !== '';

                if (hasParent) {
                    const parentNode = {
                        id: `${parentUri}__parent`,
                        label: '..',
                        icon: 'folder-open',
                        isExpanded: false,
                        hasCaret: false,
                        nodeData: {
                            uri: parentUri,
                            isFolder: true,
                            isParent: true,
                        },
                    };
                    treeData = [parentNode, ...treeData];
                }
            } catch (e) {
                /* eslint-disable-next-line no-console */
                console.warn('FileBrowser – unable to compute parent folder', e);
            }

            applyExpanded(treeData, expanded);
            setFileTreeData(treeData);
            setLoading(false);
        }
    });



    useEffect(() => {
        // Fetch top-level items when component mounts
        setLoading(true);
        const data = resolvedCollection();
        if (data?.length > 0) {
            const expanded = collectExpanded(fileTreeData);
            let input = dedupeFileBrowserRows(data, config.dedupeBy);
            try {
                if (events.onPrepareTreeData && events.onPrepareTreeData.isDefined()) {
                    const transformed = events.onPrepareTreeData.execute({ collection: data, context });
                    if (Array.isArray(transformed)) {
                        input = transformed;
                    } else if (Array.isArray(transformed?.collection)) {
                        input = transformed.collection;
                    }
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('FileBrowser – onPrepareTreeData (init) failed, using original collection', e);
            }

            let treeData = buildTree(input);

            try {
                const currentUri = handlers.dataSource.peekFilter()?.uri || '';
                const parentUri = currentUri.replace(/\/?[^/]+$/, '') || '/';
                const hasParent = currentUri && currentUri !== '/' && currentUri !== '';

                if (hasParent) {
                    const parentNode = {
                        id: `${parentUri}__parent`,
                        label: '..',
                        icon: 'folder-open',
                        isExpanded: false,
                        hasCaret: false,
                        nodeData: {
                            uri: parentUri,
                            isFolder: true,
                            isParent: true,
                        },
                    };
                    treeData = [parentNode, ...treeData];
                }
            } catch (e) {
                /* eslint-disable-next-line no-console */
                console.warn('FileBrowser – unable to compute parent folder (init)', e);
            }

            applyExpanded(treeData, expanded);
            setFileTreeData(treeData);
            setLoading(false);
        } else if (data?.length === 0) {
            events.onInit.execute({});
        }
    }, [isActive, providedRowsSignature, config.dedupeBy]);




    /**
     * Build the tree recursively from dataSource collection
     */
    function buildTree(nodes, path = []) {
        return nodes.map((node, index) => {
            const currentNodePath = [...path, index];
            const isSelected = handlers.dataSource.isSelected({node, nodePath: currentNodePath});
            if(!node.uri && node.url) {
                node.uri = node.url
            }
            if (node.name === undefined && node.isFolder === undefined) {
                node.isFolder = false;
            }
            const segments = (node.uri || "").split("/").filter(Boolean);
            const label = node.name && node.name.trim() ? node.name : segments.pop() || "Unnamed";
            return {
                id: node.uri, // Use uri as unique identifier
                label: label,
                icon: node.isFolder ? (node.isExpanded ? 'folder-open' : 'folder-close') : 'document',
                isExpanded: node.isExpanded || false,
                hasCaret: node.isFolder,
                childNodes: node.childNodes ? buildTree(node.childNodes, currentNodePath) : [],
                nodeData: node,
                isSelected: isSelected,
            };
        });
    }

    // Helper function to get node at a specific path
    const getNodeAtPath = (nodes, path) => {
        let node = null;
        let children = nodes;

        for (const index of path) {
            node = children[index];
            if (!node) {
                break;
            }
            children = node.childNodes || [];
        }
        return node;
    };

    const handleNodeExpand = (node, nodePath) => {
        // Clone the tree data to trigger re-render
        const newTreeData = [...fileTreeData];

        // Find the node to update
        const nodeToUpdate = getNodeAtPath(newTreeData, nodePath);
        if (nodeToUpdate) {
            nodeToUpdate.isExpanded = true;
            nodeToUpdate.isSelected = handlers.dataSource.isSelected({nodePath});
            nodeToUpdate.nodeData['isExpanded'] = true;
            nodeToUpdate.icon = 'folder-open';
            // If childNodes are not loaded, fetch them
            if (!nodeToUpdate.childNodes || nodeToUpdate.childNodes.length === 0) {
                const selection = handlers.dataSource.peekSelection();
                setLoading(true);
                // Fetch children using dataSource handler
                handlers.dataSource.refreshSelection({filter: {uri: nodeToUpdate.nodeData.uri}});
                return;
            }

            setFileTreeData(newTreeData);
        }
    };

    const handleNodeCollapse = (node, nodePath) => {
        // Clone the tree data to trigger re-render
        const newTreeData = [...fileTreeData];

        // Find the node to update
        const nodeToUpdate = getNodeAtPath(newTreeData, nodePath);
        if (nodeToUpdate) {
            nodeToUpdate.isExpanded = false;
            nodeToUpdate.isSelected = handlers.dataSource.isSelected({nodePath});

            nodeToUpdate.nodeData['isExpanded'] = false;
            nodeToUpdate.icon = 'folder-close';
            setFileTreeData(newTreeData);
        }
    };

    const handleNodeClick = (node, nodePath, e) => {
        const nodeToUpdate = getNodeAtPath(fileTreeData, nodePath);

        // Special case – parent folder navigation via ".." entry
        if (nodeToUpdate?.nodeData?.isParent) {
            handlers.dataSource.setFilter({ filter: { uri: nodeToUpdate.nodeData.uri } });
            // Force fetch of new collection
            events.onInit.execute({});
            return;
        }

        const args = { item: nodeToUpdate, node:nodeToUpdate, nodePath, ...node.nodeData, handleNodeCollapse, handleNodeExpand }

        if (!node.nodeData.isFolder && config.preview && typeof context?.handlers?.filePreview?.open === 'function') {
            e?.stopPropagation?.();
            return context.handlers.filePreview.open(resolveFilePreviewPayload(config.preview, node.nodeData));
        }

        // Prefer specific handlers over the generic onNodeSelect.
        if (node.nodeData.isFolder) {
            if (events.onFolderSelect && events.onFolderSelect.isDefined()) {
                e?.stopPropagation?.();
                return events.onFolderSelect.execute(args);
            }
        } else {
            if (events.onFileSelect && events.onFileSelect.isDefined()) {
                e?.stopPropagation?.();
                return events.onFileSelect.execute(args);
            }
        }

        // Fallback to generic handler only when no specific handler was provided.
        if (events.onNodeSelect && events.onNodeSelect.isDefined()) {
            return events.onNodeSelect.execute(args);
        }



        // If no handlers, default behavior
        if (node.nodeData.isFolder) {
            // Toggle expansion
            if (node.isExpanded) {
                handleNodeCollapse(node, nodePath);
            } else {
                handleNodeExpand(node, nodePath);
            }
        }
    };

    const providedTreeData = Array.isArray(config.rows)
        ? buildTree(config.display === 'tree'
            ? buildFileBrowserTreeRows(dedupeFileBrowserRows(config.rows, config.dedupeBy), config.pathField || 'url')
            : dedupeFileBrowserRows(config.rows, config.dedupeBy))
        : null;
    const effectiveTreeData = providedTreeData || fileTreeData;

    if (loading && effectiveTreeData.length === 0) {
        // Soft loading block while fetching tree
        return <SoftBlock height={160} />;
    }

    const style = config.style || {}
    const {width= '100%', height = '70vh', overflow, ...restStyle} = style
    const className = ['app-file-browser', config.className || ''].filter(Boolean).join(' ')


    return (
        <div
            className={className}
            style={{
                width: width,
                height:height,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                ...restStyle,
            }}
        >
            <div className="app-file-browser-scroll" style={{ flex: 1, minHeight: 0, overflow: overflow || 'auto' }}>
                <Tree
                    contents={effectiveTreeData}
                    onNodeClick={handleNodeClick}
                    onNodeExpand={handleNodeExpand}
                    onNodeCollapse={handleNodeCollapse}
                />
            </div>
        </div>
    );
};

export default FileBrowser;
