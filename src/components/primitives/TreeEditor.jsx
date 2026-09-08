import React from 'react';
import {Button, Checkbox, InputGroup, NonIdealState} from '@blueprintjs/core';
import {useSignals} from '@preact/signals-react/runtime';
import {resolveSelector} from '../../utils/selector.js';
import {toggleTreeSelection} from './workflowModels.js';
import MutationCommand from './MutationCommand.jsx';

function TreeNodes({nodes, spec, selected, excluded, onToggle, descendants, expanded, onExpand, level = 0}) {
  return (nodes || []).map((node) => {
    const id = String(resolveSelector(node, spec.identityField || 'id') ?? '');
    const children = resolveSelector(node, spec.childrenField || 'children') || [];
    const descendantIDs = descendants.get(id) || [];
    const selectedDescendants = descendantIDs.filter((key) => selected.includes(key)).length;
    const excludedDescendants = descendantIDs.filter((key) => excluded.includes(key)).length;
    return (
      <div key={id} className="forge-tree-editor__node" style={{'--forge-tree-depth': level}}>
        <div className="forge-tree-editor__choice">
          {children.length && spec.collapsible !== false ? <Button minimal small icon={expanded.has(id) ? 'chevron-down' : 'chevron-right'} aria-label={`${expanded.has(id) ? 'Collapse' : 'Expand'} ${String(resolveSelector(node, spec.labelField || 'name') ?? id)}`} onClick={() => onExpand(id)}/> : null}
          <Checkbox checked={selected.includes(id)} indeterminate={!selected.includes(id) && selectedDescendants > 0} label={String(resolveSelector(node, spec.labelField || 'name') ?? id)} onChange={(event) => onToggle(id, event.currentTarget.checked, 'include')}/>
          {spec.selectionMode === 'includeExclude' ? <Checkbox checked={excluded.includes(id)} indeterminate={!excluded.includes(id) && excludedDescendants > 0} label={`Exclude ${String(resolveSelector(node, spec.labelField || 'name') ?? id)}`} onChange={(event) => onToggle(id, event.currentTarget.checked, 'exclude')}/> : null}
        </div>
        {children.length && (spec.collapsible === false || expanded.has(id)) ? <div className="forge-tree-editor__children"><TreeNodes nodes={children} spec={spec} selected={selected} excluded={excluded} onToggle={onToggle} descendants={descendants} expanded={expanded} onExpand={onExpand} level={level + 1}/></div> : null}
      </div>
    );
  });
}

export default function TreeEditor({container, context}) {
  useSignals();
  const spec = container.treeEditor || {};
  const dataContext = context.Context?.(spec.dataSourceRef || container.dataSourceRef) || context;
  const nodes = dataContext?.signals?.collection?.value || [];
  const form = dataContext?.handlers?.dataSource?.getFormData?.() || dataContext?.signals?.form?.value || {};
  const sourceSelected = resolveSelector(form, spec.selectedField || 'selectedIds') || [];
  const sourceExcluded = resolveSelector(form, spec.excludedField || 'excludedIds') || [];
  const [selected, setSelected] = React.useState(() => sourceSelected.map(String));
  const [excluded, setExcluded] = React.useState(() => sourceExcluded.map(String));
  const [dirty, setDirty] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const {descendants, initiallyExpanded} = React.useMemo(() => {
    const result = new Map();
    const open = new Set();
    const visit = (items, depth) => (items || []).flatMap((node) => {
      const id = String(resolveSelector(node, spec.identityField || 'id') ?? '');
      const children = resolveSelector(node, spec.childrenField || 'children') || [];
      if (depth < Number(spec.defaultExpandedDepth || 1)) open.add(id);
      const nested = visit(children, depth + 1);
      result.set(id, nested.map((entry) => entry.id));
      return [{id}, ...nested];
    });
    visit(nodes, 0);
    return {descendants: result, initiallyExpanded: open};
  }, [nodes, spec.childrenField, spec.identityField, spec.defaultExpandedDepth]);
  const [expanded, setExpanded] = React.useState(initiallyExpanded);
  React.useEffect(() => setExpanded(initiallyExpanded), [initiallyExpanded]);
  const filteredNodes = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return nodes;
    const filter = (items) => (items || []).map((node) => {
      const children = filter(resolveSelector(node, spec.childrenField || 'children') || []);
      const label = String(resolveSelector(node, spec.labelField || 'name') ?? '').toLowerCase();
      return label.includes(normalized) || children.length ? {...node, [spec.childrenField || 'children']: children} : null;
    }).filter(Boolean);
    return filter(nodes);
  }, [nodes, query, spec.childrenField, spec.labelField]);
  React.useEffect(() => { if (query.trim()) setExpanded(new Set(descendants.keys())); }, [query, descendants]);
  const sourceSignature = JSON.stringify([sourceSelected, sourceExcluded]);
  React.useEffect(() => {
    if (dirty) return;
    setSelected(sourceSelected.map(String));
    setExcluded(sourceExcluded.map(String));
  }, [dirty, sourceSignature]);
  const toggle = (id, checked, mode) => {
    setDirty(true);
    if (mode === 'exclude') {
      setExcluded((current) => toggleTreeSelection(nodes, current, id, checked, spec));
      if (checked) setSelected((current) => toggleTreeSelection(nodes, current, id, false, spec));
    } else {
      setSelected((current) => toggleTreeSelection(nodes, current, id, checked, spec));
      if (checked) setExcluded((current) => toggleTreeSelection(nodes, current, id, false, spec));
    }
  };
  const reset = () => {
    setSelected(sourceSelected.map(String));
    setExcluded(sourceExcluded.map(String));
    setDirty(false);
  };
  if (!nodes.length) return <NonIdealState icon="diagram-tree" title={spec.emptyMessage || 'No options available'}/>;
  return (
    <div className="forge-tree-editor" data-forge-primitive="treeEditor">
      {spec.searchable !== false ? <InputGroup leftIcon="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search options" aria-label="Search tree options"/> : null}
      <div className="forge-tree-editor__nodes"><TreeNodes nodes={filteredNodes} spec={spec} selected={selected} excluded={excluded} onToggle={toggle} descendants={descendants} expanded={expanded} onExpand={(id) => setExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; })}/></div>
      <div className="forge-tree-editor__actions">
        <Button disabled={!dirty} onClick={reset}>Reset</Button>
        {spec.mutation ? <MutationCommand command={{...spec.mutation, label: 'Save selection', intent: 'primary'}} context={dataContext} disabled={!dirty} extras={{selectedIds: selected, excludedIds: excluded}} onSettled={({status}) => { if (status === 'succeeded') setDirty(false); }}/> : null}
      </div>
    </div>
  );
}
