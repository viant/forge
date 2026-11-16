import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import {ReaderEntityScopeDialog, hasRowScopeBinding} from './ReaderEntityScopeDialog.jsx';

it('authors the binding declared by the source, including its destination and parameter types', async () => {
  const binding = {
    defaultEntity: 'record', defaultColumn: 'entry_key',
    contextField: {name:'Selection', sourceKind:'component', type:'*example.org/catalog.Filter', sourceName:'GET:/v2/{{entity}}/rules/{{report.id}}', required:true},
    idsField: {name:'Keys', sourceKind:'param', sourceName:'Selection.allowedKeys', required:true},
    idTypes: [{label:'Text keys', field:{type:'[]string'}}],
    predicate: {name:'in', group:2, groupOperator:'AND', applyWhenAbsent:true},
  };
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const apply = vi.fn();
  const props = {isOpen:true, report:{id:'weekly'}, root:{name:'entries',source:{table:'example.items'}}, onApply:apply, onClose:vi.fn()};
  try {
    await act(async () => root.render(<ReaderEntityScopeDialog {...props}/>));
    expect(document.querySelector('#scope-entity')).toBeNull();
    await act(async () => root.render(<ReaderEntityScopeDialog {...props} binding={binding}/>));
    const form = document.getElementById('scope-entity').closest('form');
    await act(async () => form.dispatchEvent(new Event('submit', {bubbles:true, cancelable:true})));
    expect(apply).toHaveBeenCalledWith({type:'batch', operations:[
      {type:'addField',field:{...binding.contextField,sourceName:'GET:/v2/record/rules/weekly'}},
      {type:'addField',field:{...binding.idsField,type:'[]string'}},
      {type:'addFieldPredicate',predicate:{...binding.predicate,field:'Keys',view:'entries',args:['items','entry_key']}},
    ]});
    const declare = (name, source) => ({declarations:[{parameter:{name,source}}]});
    expect(hasRowScopeBinding(declare('Selection',{kind:'component',name:'GET:/v2/record/rules/weekly'}),binding)).toBe(true);
    expect(hasRowScopeBinding(declare('Other',{kind:'component',name:'GET:/v2/other'}),binding)).toBe(false);
    expect(hasRowScopeBinding(declare('Keys',{kind:'param',name:'Selection.allowedKeys'}),binding)).toBe(true);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
