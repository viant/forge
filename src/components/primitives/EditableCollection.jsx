import React from 'react';
import {Button, ButtonGroup} from '@blueprintjs/core';
import {useSignals} from '@preact/signals-react/runtime';
import TablePanel from '../TablePanel.jsx';
import ResponsiveDataGrid from './ResponsiveDataGrid.jsx';
import {resolveParameters} from '../../hooks/parameters.js';
import {
  editableCollectionOperationState,
  mutationCommandTargetParameters,
} from './editableCollectionModel.js';
import MutationCommand from './MutationCommand.jsx';
import {permissionBoundaryAllows, permissionBoundaryAllowsRows} from './PermissionBoundary.jsx';
import './workflowPrimitives.css';

export default function EditableCollection({container, context, isActive}) {
  useSignals();
  const spec = container?.editableCollection || {};
  const ref = spec.dataSourceRef || container?.dataSourceRef || context?.identity?.dataSourceRef;
  const dataContext = ref && context?.identity?.dataSourceRef !== ref ? context?.Context?.(ref) : context;
  const selection = dataContext?.signals?.selection?.value || {};
  const operations = Array.isArray(spec.operations) ? spec.operations : [];

  const invoke = (operation) => {
    const state = editableCollectionOperationState({...operation, selection: operation.selection || spec.selection}, dataContext, selection);
    const boundaryMode = String(container.permissionBoundary?.mode || 'resource').toLowerCase();
    const selectionPermitted = !container.permissionBoundary || (boundaryMode === 'resource'
      ? permissionBoundaryAllows(container.permissionBoundary, dataContext)
      : permissionBoundaryAllowsRows(container.permissionBoundary, dataContext, state.rows));
    if (state.disabled || !selectionPermitted) return false;
    const resolved = resolveParameters(operation.parameters || [], dataContext) || {};
    const seed = {
      ...mutationCommandTargetParameters(resolved, ref),
      operationId: operation.id,
      selectedRows: state.rows,
    };
    if (operation.handler) {
      const handler = dataContext?.lookupHandler?.(operation.handler);
      return typeof handler === 'function' ? handler({context: dataContext, operation, parameters: seed}) : false;
    }
    if (operation.dialogId) {
      return dataContext?.handlers?.window?.openDialog?.({
        context: dataContext,
        execution: {args: [operation.dialogId, {awaitResult: false}]},
        parameters: seed,
      });
    }
    return false;
  };

  return (
    <div className="forge-editable-collection" data-forge-primitive="editableCollection">
      {operations.length > 0 ? (
        <ButtonGroup className="forge-editable-collection__operation-bar" minimal={false}>
          {operations.map((operation) => {
            const state = editableCollectionOperationState({...operation, selection: operation.selection || spec.selection}, dataContext, selection);
            const boundaryMode = String(container.permissionBoundary?.mode || 'resource').toLowerCase();
            const selectionPermitted = !container.permissionBoundary || (boundaryMode === 'resource'
              ? permissionBoundaryAllows(container.permissionBoundary, dataContext)
              : permissionBoundaryAllowsRows(container.permissionBoundary, dataContext, state.rows));
            if (!state.visible) return null;
            const command = operation.mutation || spec.mutation;
            if (command && !operation.handler && !operation.dialogId) {
              return <MutationCommand key={operation.id} command={{...command, commandId: command.commandId || operation.id, label: operation.label || operation.id, intent: operation.intent || command.intent}} context={dataContext} extras={{selectedRows: state.rows, operationId: operation.id}} disabled={state.disabled || !selectionPermitted}/>;
            }
            return (
              <Button
                key={operation.id}
                intent={operation.intent || undefined}
                disabled={state.disabled || !selectionPermitted}
                onClick={() => invoke(operation)}
              >
                {operation.label || operation.id}
              </Button>
            );
          })}
        </ButtonGroup>
      ) : null}
      {container.responsiveDataGrid
        ? <ResponsiveDataGrid container={{...container, dataSourceRef: ref}} context={dataContext} isActive={isActive}/>
        : <TablePanel container={{...container, dataSourceRef: ref}} context={dataContext} isActive={isActive}/>}
    </div>
  );
}
