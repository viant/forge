import React, {useEffect, useMemo, useRef, useState} from 'react';
import {sourceAssetNodes, sourceAssetAncestors, visibleSourceAssets, sourceAssetKey} from './sourceAssetTreeModel.js';
import './SourceAssetTree.css';

export default function SourceAssetTree({files, selectedPath, onSelect, disabled = false}) {
  const nodes = useMemo(() => sourceAssetNodes(Object.keys(files)), [files]);
  const [expanded, setExpanded] = useState(() => new Set(sourceAssetAncestors(selectedPath)));
  const [focused, setFocused] = useState(() => `file:${selectedPath}`);
  const refs = useRef(new Map());
  useEffect(() => {
    setExpanded(previous => new Set([...previous, ...sourceAssetAncestors(selectedPath)]));
    setFocused(`file:${selectedPath}`);
  }, [selectedPath]);
  const rows = visibleSourceAssets(nodes, expanded);
  const focusId = rows.some(row => row.id === focused) ? focused : rows[0]?.id;
  const keyboard = event => {
    const next = sourceAssetKey(event.key, focusId, rows, expanded);
    if (!next) return;
    event.preventDefault();
    setExpanded(next.expanded); setFocused(next.focus);
    if (next.selected !== undefined) onSelect(next.selected);
    refs.current.get(next.focus)?.focus();
  };
  return <nav className="fwe-source-assets" aria-label="Source files">
    <div className="fwe-source-assets__heading">Files</div>
    <div role="tree" aria-label="Source files" onKeyDown={keyboard}>
      {rows.map(node => <button key={node.id} type="button" role="treeitem"
        ref={element => element ? refs.current.set(node.id, element) : refs.current.delete(node.id)}
        className="fwe-source-assets__item" style={{'--source-level': node.level}}
        title={node.path} aria-label={node.name} aria-level={node.level}
        aria-posinset={node.posInSet} aria-setsize={node.setSize}
        aria-expanded={node.kind === 'folder' ? expanded.has(node.id) : undefined}
        aria-selected={node.kind === 'file' ? node.path === selectedPath : undefined}
        tabIndex={!disabled && node.id === focusId ? 0 : -1} disabled={disabled}
        onFocus={() => setFocused(node.id)} onClick={() => {
          setFocused(node.id);
          if (node.kind === 'file') onSelect(node.path);
          else setExpanded(previous => {const next = new Set(previous); next.has(node.id) ? next.delete(node.id) : next.add(node.id); return next;});
        }}>
        <svg className="fwe-source-assets__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
          {node.kind === 'folder' ? <path d={expanded.has(node.id) ? 'm4 6 4 4 4-4' : 'm6 4 4 4-4 4'}/> : <path d="M4 2h5l3 3v9H4z M9 2v4h3"/>}
        </svg><span>{node.name}</span>
      </button>)}
    </div>
    {!rows.length && <p>No source files.</p>}
  </nav>;
}
