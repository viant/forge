import React, { useEffect, useState } from 'react';
import {
  buildReportDocumentChartBlock,
  buildReportDocumentKpiBlock,
  buildReportDocumentMarkdownBlock,
  buildReportDocumentTableBlock,
  normalizeReportBuilderDocumentBlocks,
} from '../../reporting/reportDocumentModel.js';
import './ReportBlockDesigner.css';

const KINDS = {
  tableBlock: 'Table',
  chartBlock: 'Chart',
  kpiBlock: 'KPI',
  markdownBlock: 'Markdown',
};
const BUILDERS = {
  tableBlock: buildReportDocumentTableBlock,
  chartBlock: buildReportDocumentChartBlock,
  kpiBlock: buildReportDocumentKpiBlock,
  markdownBlock: buildReportDocumentMarkdownBlock,
};
const value = (entry) => String(entry ?? '');
const fieldNames = (fields) => (Array.isArray(fields) ? fields : []).map((field) => value(field?.name)).filter(Boolean);
const uniqueId = (kind, blocks) => {
  const stem = kind.replace(/Block$/, '');
  const used = new Set(blocks.map((block) => value(block?.id)));
  let number = 1;
  while (used.has(`${stem}-${number}`)) number += 1;
  return `${stem}-${number}`;
};

export default function ReportBlockDesigner({ blocks = [], datasets = [], onChange, disabled = false }) {
  const source = Array.isArray(blocks) ? blocks : [];
  const sourceSignature = JSON.stringify(source);
  const catalog = Array.isArray(datasets) ? datasets : [];
  const [selection, setSelection] = useState(null);
  const [draft, setDraft] = useState(null);
  const [addKind, setAddKind] = useState('tableBlock');
  const [error, setError] = useState('');

  // A parent may replace the document while a form is open. Never save a stale draft over it.
  useEffect(() => {
    setSelection(null);
    setDraft(null);
    setError('');
  }, [sourceSignature]);

  const selectedIndex = selection?.mode === 'edit'
    ? source.findIndex((block, index) => index === selection.index && value(block?.id) === selection.id)
    : -1;
  const editing = selectedIndex >= 0;
  const active = draft && (selection?.mode === 'add' || editing) ? draft : null;
  const dataset = catalog.find((item) => value(item?.id) === value(active?.datasetRef));
  const fields = Array.isArray(dataset?.fields) ? dataset.fields.filter((field) => value(field?.name)) : [];
  const names = fieldNames(fields);

  const beginAdd = () => {
    if (disabled) return;
    setSelection({ mode: 'add' });
    setDraft({ kind: addKind, title: KINDS[addKind], datasetRef: '', columns: [], chartSpec: { type: 'bar', xField: '', yFields: [] }, valueField: '', markdown: '' });
    setError('');
  };
  const beginEdit = (block, index) => {
    if (disabled || !BUILDERS[block?.kind]) return;
    setSelection({ mode: 'edit', index, id: value(block?.id) });
    setDraft({ ...block, chartSpec: block.chartSpec ? { ...block.chartSpec } : undefined });
    setError('');
  };
  const update = (patch) => { setDraft((current) => ({ ...current, ...patch })); setError(''); };
  const updateChart = (patch) => update({ chartSpec: { ...draft.chartSpec, ...patch } });
  const emit = (next) => {
    if (disabled || typeof onChange !== 'function') return;
    onChange(next);
    setSelection(null);
    setDraft(null);
  };
  const save = () => {
    if (!active || disabled) return;
    const kind = active.kind;
    if (!value(active.title).trim()) { setError('Enter a title.'); return; }
    if (kind === 'markdownBlock' && !value(active.markdown).trim()) { setError('Enter report text.'); return; }
    if (kind !== 'markdownBlock') {
      if (!dataset) { setError('Select an available dataset.'); return; }
      if (kind === 'tableBlock' && (!active.columns?.length || active.columns.some((column) => !names.includes(value(column?.key))))) {
        setError('Select at least one available projected field.'); return;
      }
      if (kind === 'kpiBlock' && !names.includes(value(active.valueField))) { setError('Select a value field.'); return; }
      if (kind === 'chartBlock' && (!names.includes(value(active.chartSpec?.xField)) || !active.chartSpec?.yFields?.length || active.chartSpec.yFields.some((name) => !names.includes(name)))) {
        setError('Select a category field and at least one value field.'); return;
      }
    }
    const id = editing ? source[selectedIndex].id : uniqueId(kind, source);
    const input = { ...active, id, title: active.title.trim() };
    // The model builder owns the block grammar; retain properties outside this
    // compact editor so editing a title does not erase advanced authored settings.
    const built = BUILDERS[kind](input);
    const authored = { ...active, ...built, ...(active.runtime ? { runtime: active.runtime } : {}) };
    const [normalized] = normalizeReportBuilderDocumentBlocks([authored]);
    const result = normalized ? { ...authored, ...normalized } : authored;
    const next = [...source];
    if (editing) next[selectedIndex] = result;
    else next.push(result);
    emit(next);
  };
  const remove = (index) => { if (!disabled) emit(source.filter((_, item) => item !== index)); };
  const move = (index, offset) => {
    const target = index + offset;
    if (disabled || target < 0 || target >= source.length) return;
    const next = [...source];
    [next[index], next[target]] = [next[target], next[index]];
    emit(next);
  };
  const chooseDataset = (datasetRef) => {
    const next = { datasetRef };
    if (draft.kind === 'tableBlock') next.columns = [];
    if (draft.kind === 'chartBlock') next.chartSpec = { ...draft.chartSpec, xField: '', yFields: [] };
    if (draft.kind === 'kpiBlock') next.valueField = '';
    update(next);
  };
  const toggleTableField = (field, checked) => {
    const columns = Array.isArray(draft.columns) ? draft.columns : [];
    update({ columns: checked
      ? [...columns, { key: field.name, label: field.label || field.name }]
      : columns.filter((column) => column.key !== field.name) });
  };
  const toggleChartValue = (name, checked) => {
    const current = Array.isArray(draft.chartSpec?.yFields) ? draft.chartSpec.yFields : [];
    updateChart({ yFields: checked ? [...current, name] : current.filter((item) => item !== name) });
  };

  return <section className="forge-report-block-designer" aria-label="Report block designer">
    <div className="forge-report-block-designer__toolbar">
      <label>New block
        <select value={addKind} onChange={(event) => setAddKind(event.target.value)} disabled={disabled}>
          {Object.entries(KINDS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
        </select>
      </label>
      <button className="bp6-button bp6-intent-primary" type="button" onClick={beginAdd} disabled={disabled}>Add block</button>
    </div>
    {source.length === 0 ? <p>No blocks yet.</p> : <ol className="forge-report-block-designer__list">
      {source.map((block, index) => {
        const supported = !!BUILDERS[block?.kind];
        const label = value(block?.title) || value(block?.kind) || 'Unknown block';
        return <li key={`${value(block?.id)}-${index}`} className="forge-report-block-designer__item">
          <span><strong>{label}</strong> <small>{KINDS[block?.kind] || value(block?.kind) || 'Unsupported'}{supported ? '' : ' · Read only'}</small></span>
          {supported && <span className="forge-report-block-designer__actions">
            <button className="bp6-button bp6-small bp6-minimal" type="button" onClick={() => beginEdit(block, index)} disabled={disabled} aria-label={`Edit ${label}`}>Edit</button>
            <button className="bp6-button bp6-small bp6-minimal" type="button" onClick={() => move(index, -1)} disabled={disabled || index === 0} aria-label={`Move ${label} up`}>↑</button>
            <button className="bp6-button bp6-small bp6-minimal" type="button" onClick={() => move(index, 1)} disabled={disabled || index === source.length - 1} aria-label={`Move ${label} down`}>↓</button>
            <button className="bp6-button bp6-small bp6-minimal bp6-intent-danger" type="button" onClick={() => remove(index)} disabled={disabled} aria-label={`Delete ${label}`}>Delete</button>
          </span>}
        </li>;
      })}
    </ol>}
    {active && <form className="forge-report-block-designer__form" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <h3>{editing ? `Edit ${KINDS[active.kind]}` : `Add ${KINDS[active.kind]}`}</h3>
      <label>Title <input value={value(active.title)} onChange={(event) => update({ title: event.target.value })} disabled={disabled} required /></label>
      {active.kind === 'markdownBlock' ? <label>Markdown <textarea value={value(active.markdown)} onChange={(event) => update({ markdown: event.target.value })} disabled={disabled} rows={5} /></label> : <>
        <label>Dataset
          <select value={value(active.datasetRef)} onChange={(event) => chooseDataset(event.target.value)} disabled={disabled} required>
            <option value="">Select dataset</option>
            {active.datasetRef && !dataset && <option value={active.datasetRef}>{active.datasetRef} (unavailable)</option>}
            {catalog.map((item) => <option key={item.id} value={item.id}>{item.label || item.id}</option>)}
          </select>
        </label>
        {active.kind === 'tableBlock' && <fieldset disabled={disabled || !dataset}><legend>Projected fields</legend>
          {fields.map((field) => <label key={field.name}><input type="checkbox" checked={active.columns?.some((column) => column.key === field.name) || false} onChange={(event) => toggleTableField(field, event.target.checked)} />{field.label || field.name}</label>)}
        </fieldset>}
        {active.kind === 'chartBlock' && <>
          <label>Chart type <select value={value(active.chartSpec?.type || 'bar')} onChange={(event) => updateChart({ type: event.target.value })} disabled={disabled}>
            {['bar', 'line', 'area', 'pie'].map((type) => <option key={type} value={type}>{type}</option>)}
          </select></label>
          <label>Category field <select value={value(active.chartSpec?.xField)} onChange={(event) => updateChart({ xField: event.target.value })} disabled={disabled || !dataset} required>
            <option value="">Select field</option>{fields.map((field) => <option key={field.name} value={field.name}>{field.label || field.name}</option>)}
          </select></label>
          <fieldset disabled={disabled || !dataset}><legend>Value fields</legend>
            {fields.map((field) => <label key={field.name}><input type="checkbox" checked={active.chartSpec?.yFields?.includes(field.name) || false} onChange={(event) => toggleChartValue(field.name, event.target.checked)} />{field.label || field.name}</label>)}
          </fieldset>
        </>}
        {active.kind === 'kpiBlock' && <label>Value field <select value={value(active.valueField)} onChange={(event) => {
          const field = fields.find((item) => item.name === event.target.value);
          update({ valueField: event.target.value, valueLabel: field?.label || field?.name || '' });
        }} disabled={disabled || !dataset} required>
          <option value="">Select field</option>{fields.map((field) => <option key={field.name} value={field.name}>{field.label || field.name}</option>)}
        </select></label>}
      </>}
      {error && <p role="alert">{error}</p>}
      <div className="forge-report-block-designer__form-actions">
        <button className="bp6-button bp6-intent-primary" type="submit" disabled={disabled}>Save block</button>
        <button className="bp6-button bp6-minimal" type="button" onClick={() => { setSelection(null); setDraft(null); setError(''); }}>Cancel</button>
      </div>
    </form>}
  </section>;
}
