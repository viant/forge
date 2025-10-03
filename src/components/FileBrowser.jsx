import React, {useState, useEffect} from 'react';
import {Tree} from '@blueprintjs/core';
import { SoftBlock } from './SoftSkeleton.jsx';
import {useSignalEffect} from '@preact/signals-react';
import { fileBrowserHandlers} from "../hooks";


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


const FileBrowser = (props) => {
    const {context, config={}, isActive} = props;
    const {handlers, signals} = context;
    const {control} = signals;
    const [fileTreeData, setFileTreeData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const events = fileBrowserHandlers(context, config);


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
        const {loading, error} = control.value || {};
        setLoading(loading);
        setError(error);
        const data = handlers.dataSource.getCollection();

        if (data) {
            // Build tree data from the collection and prepend ".." when we
            // are inside a sub-folder so the user can navigate up.
            const expanded = collectExpanded(fileTreeData);
            let input = data;
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
        const data = handlers.dataSource.getCollection();
        if (data?.length > 0) {
            const expanded = collectExpanded(fileTreeData);
            let input = data;
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
    }, [isActive]);




    /**
     * Build the tree recursively from dataSource collection
     */
    const buildTree = (nodes, path = []) => {
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
    };

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

    if (loading && fileTreeData.length === 0) {
        // Soft loading block while fetching tree
        return <SoftBlock height={160} />;
    }

    const style = config.style || {}
    const {width= '100%', height = '70vh'} = style


    return (
        <div
            style={{
                padding: '10px',
                border: '1px solid #ccc',
                overflow: 'auto',
                ...style,
                width: width,
                height:height,
            }}
        >
            <Tree
                contents={fileTreeData}
                onNodeClick={handleNodeClick}
                onNodeExpand={handleNodeExpand}
                onNodeCollapse={handleNodeCollapse}
            />
        </div>
    );
};

export default FileBrowser;
