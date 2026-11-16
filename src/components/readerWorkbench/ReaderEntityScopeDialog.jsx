import {WorkbenchDialog as Dialog} from './WorkbenchMutationContext.jsx';
import React, { useEffect, useState } from 'react';
import { Button, Callout, DialogBody, DialogFooter, FormGroup, HTMLSelect, InputGroup } from '@blueprintjs/core';
import {resolveTemplateText} from '../../utils/linkTarget.js';

export function hasRowScopeBinding(structure, binding) {
  if (!binding) return false;
  const { contextField, idsField } = binding;
  // A scoped field is identified by the source declared by this producer.
  const routePrefix = contextField.sourceName.split('{{')[0];
  return (structure?.declarations || []).some(({parameter}) => {
    const source = parameter?.source;
    return (parameter?.name === contextField.name && source?.kind === contextField.sourceKind
        && routePrefix && source.name?.startsWith(routePrefix))
      || (source?.kind === idsField.sourceKind && source.name === idsField.sourceName);
  });
}

function viewsOf(view) {
  return view ? [view, ...(view.relations || []).flatMap(relation => viewsOf(relation.view))] : [];
}

export function ReaderEntityScopeDialog({ isOpen, report, root, structure, binding, onClose, onApply }) {
  const views = viewsOf(root);
  const [draft, setDraft] = useState({ entity: '', view: '', qualifier: '', column: '', idType: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isOpen || !binding) return;
    setDraft({ entity: binding.defaultEntity || '', view: root?.namespace || root?.name || '', qualifier: String(root?.source?.table || '').split('.').at(-1) || '', column: binding.defaultColumn || '', idType: 0 });
    setError(''); setSaving(false);
  }, [isOpen, report?.id, binding]);
  const change = key => event => setDraft(value => ({ ...value, [key]: event.target.value }));
  const submit = async event => {
    event.preventDefault();
    const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (!identifier.test(draft.entity) || !identifier.test(draft.column) || (draft.qualifier && !identifier.test(draft.qualifier)) || !views.some(view => (view.namespace || view.name) === draft.view)) {
      setError('Choose a view and enter valid entity, column and SQL qualifier names.'); return;
    }
    const {contextField, idsField, idTypes, predicate} = binding;
    const reserved = [contextField.name, idsField.name];
    if ((structure?.declarations || []).some(({parameter}) => reserved.includes(parameter?.name))) {
      setError(`This component already defines ${reserved.join(' or ')}. Review its existing scope binding first.`); return;
    }
    setSaving(true); setError('');
    try {
      await onApply({ type: 'batch', operations: [
        { type: 'addField', field: { ...contextField, sourceName: resolveTemplateText(contextField.sourceName, {report, entity:draft.entity}) } },
        { type: 'addField', field: { ...idsField, ...idTypes[draft.idType].field } },
        { type: 'addFieldPredicate', predicate: { ...predicate, field: idsField.name, view: draft.view, args: [draft.qualifier, draft.column] } },
      ] });
      onClose();
    } catch (cause) { setError(cause.message); }
    finally { setSaving(false); }
  };
  if (!binding) return null;
  return <Dialog portalClassName="forge-reader-workbench-dialog" className="studio-connector-dialog" isOpen={isOpen} title="Bind row access scope" onClose={() => !saving && onClose()} canOutsideClickClose={!saving} canEscapeKeyClose={!saving}>
    <form onSubmit={submit}><DialogBody>
      <p>Filter this view to entity IDs supplied by the verified access policy. Callers cannot supply or replace these IDs.</p>
      {error && <Callout intent="danger" role="alert">{error}</Callout>}
      <FormGroup label="Entity type" labelFor="scope-entity"><InputGroup id="scope-entity" value={draft.entity} onChange={change('entity')} disabled={saving}/></FormGroup>
      <FormGroup label="Scoped view" labelFor="scope-view"><HTMLSelect id="scope-view" fill value={draft.view} onChange={change('view')} disabled={saving}>{views.map(view => <option key={view.namespace || view.name} value={view.namespace || view.name}>{view.namespace || view.name}</option>)}</HTMLSelect></FormGroup>
      <div className="studio-form-grid">
        <FormGroup label="Entity ID column" labelFor="scope-column"><InputGroup id="scope-column" value={draft.column} onChange={change('column')} disabled={saving}/></FormGroup>
        <FormGroup label="SQL qualifier" labelFor="scope-qualifier" helperText="The table name or alias inside this view's query; leave empty for an unqualified column."><InputGroup id="scope-qualifier" value={draft.qualifier} onChange={change('qualifier')} disabled={saving}/></FormGroup>
      </div>
      <FormGroup label="Entity ID type" labelFor="scope-type"><HTMLSelect id="scope-type" fill value={draft.idType} onChange={change('idType')} disabled={saving}>{binding.idTypes.map((option, index) => <option key={option.label} value={index}>{option.label}</option>)}</HTMLSelect></FormGroup>
      {binding.helpText && <Callout compact>{binding.helpText}</Callout>}
    </DialogBody><DialogFooter actions={<><Button disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" intent="primary" loading={saving}>Bind entity scope</Button></>}/></form>
  </Dialog>;
}
