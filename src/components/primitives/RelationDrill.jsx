import React from 'react';
import {Button} from '@blueprintjs/core';
import {useSignals} from '@preact/signals-react/runtime';
import {relationDrillValue, resolveRelationDrillTarget} from './presentationModels.js';

export default function RelationDrill({container, context}) {
  useSignals();
  const spec = container.relationDrill || {};
  const dataContext = context.Context?.(spec.dataSourceRef || container.dataSourceRef) || context;
  const record = dataContext?.signals?.form?.value || dataContext?.signals?.collection?.value?.[0] || {};
  const relation = relationDrillValue(record, spec);
  const target = resolveRelationDrillTarget(record, spec, dataContext);
  const window = dataContext?.handlers?.window;
  const supported = target?.kind === 'dialog' ? typeof window?.openDialog === 'function'
    : target?.kind === 'window' && typeof window?.openTarget === 'function';
  const open = () => {
    const link = target;
    if (link?.kind === 'dialog') return dataContext?.handlers?.window?.openDialog?.({context: dataContext, execution: {args: [link.dialogId, {awaitResult: link.awaitResult === true}]}, parameters: link.parameters});
    if (link?.kind === 'window') return window?.openTarget?.({context: dataContext, target: link});
    return false;
  };
  return <div className="forge-relation-drill" data-forge-primitive="relationDrill"><Button minimal disabled={!relation.actionable || !supported} onClick={open}>{relation.count > 0 ? relation.label : spec.emptyText || relation.label}</Button></div>;
}
