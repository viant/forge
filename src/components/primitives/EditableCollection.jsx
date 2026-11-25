import {trackVisibleWhen} from '../visibleWhen.js';
import {actionIconOnly, actionAccessibleName} from '../table/basic/actionPresentation.js';
import {containerSizingStyle} from '../containerSizing.js';
import React from 'react';
import {Button, ButtonGroup, Menu, MenuItem} from '@blueprintjs/core';
import {useSignals} from '@preact/signals-react/runtime';
import TablePanel from '../TablePanel.jsx';
import {TableExportSubmenu} from '../table/basic/Toolbar.jsx';
import ResponsiveDataGrid from './ResponsiveDataGrid.jsx';
import {resolveParameters} from '../../hooks/parameters.js';
import {
  editableCollectionOperationState,
  editableCollectionRows,
  mutationCommandTargetParameters,
} from './editableCollectionModel.js';
import MutationCommand from './MutationCommand.jsx';
import {openPreparedSelection, prepareDialogSources} from './prepareSelection.js';
import {permissionBoundaryAllows, permissionBoundaryAllowsRows} from './PermissionBoundary.jsx';
import DisabledActionShell from '../DisabledActionShell.jsx';
import ForgeButton from '../Button.jsx';
import Icon from '../Icon.jsx';
import RegisteredPopover from '../RegisteredPopover.jsx';
import {useForgeTheme} from '../ThemeBoundary.jsx';
import {resolveTableThemeOverrides} from '../table/tableThemeOverrides.js';
import {resolveSelector} from '../../utils/selector.js';
import './workflowPrimitives.css';

export default function EditableCollection({sizingMode = 'fill', container, context, isActive}) {
  useSignals();
  const spec = container?.editableCollection || {};
  const ref = spec.dataSourceRef || container?.dataSourceRef || context?.identity?.dataSourceRef;
  const dataContext = ref && context?.identity?.dataSourceRef !== ref ? context?.Context?.(ref) : context;
  const selection = dataContext?.signals?.selection?.value || {};
  const operations = Array.isArray(spec.operations) ? spec.operations : [];
  const themeId = useForgeTheme()?.themeId;
  const themedTable = resolveTableThemeOverrides(container?.table, [], themeId).table;
  const operationToolbar = themeId === 'design-system-2' && themedTable?.presentation === 'list-page'
    ? themedTable.operationToolbar : null;
  for (const operation of operations) {
    if (operation.prepareSelection) prepareDialogSources(dataContext.metadata);
    trackVisibleWhen(operation.visibleWhen, dataContext);
    trackVisibleWhen(operation.disabledWhen, dataContext);
    trackVisibleWhen((operation.selection || spec.selection)?.disabledWhen, dataContext);
  }
  const selectedRows = editableCollectionRows(selection);

  const operationState = (operation, owner = dataContext, currentSelection = selection) => {
    const state = editableCollectionOperationState({...operation, selection: operation.selection || spec.selection}, owner, currentSelection);
    const boundaryMode = String(container.permissionBoundary?.mode || 'resource').toLowerCase();
    const selectionPermitted = !container.permissionBoundary || (boundaryMode === 'resource'
      ? permissionBoundaryAllows(container.permissionBoundary, owner)
      : permissionBoundaryAllowsRows(container.permissionBoundary, owner, state.rows));
    return {...state, disabled: state.disabled || !selectionPermitted};
  };

  const invoke = (operation) => {
    const state = operationState(operation);
    if (state.disabled) return false;
    if (operation.prepareSelection) {
      return openPreparedSelection(dataContext, operation, owner => {
        const live = operationState(operation, owner, owner.signals?.selection?.peek?.() || {});
        return live.visible && !live.disabled;
      });
    }
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

  const byId = new Map(operations.map(operation => [operation.id, operation]));
  const menuOperations = (Array.isArray(operationToolbar?.menu?.operations) ? operationToolbar.menu.operations : []).map(id => byId.get(id))
    .filter(operation => operation && (operation.handler || operation.dialogId));
  const primaryCandidate = byId.get(operationToolbar?.primary);
  const primary = primaryCandidate && (primaryCandidate.handler || primaryCandidate.dialogId) ? primaryCandidate : null;
  const review = operationToolbar?.editReview;
  const applyCandidate = byId.get(review?.apply), revertCandidate = byId.get(review?.revert);
  const hasReview = !!review?.countField && !!(applyCandidate?.handler || applyCandidate?.dialogId) && !!(revertCandidate?.handler || revertCandidate?.dialogId);
  const applyOperation = hasReview ? applyCandidate : null;
  const revertOperation = hasReview ? revertCandidate : null;
  const form = dataContext?.signals?.windowForm?.value || {};
  const changeCount = hasReview ? Number(resolveSelector(form, review.countField) || 0) : 0;
  const rowCount = review?.rowCountField ? Number(resolveSelector(form, review.rowCountField) || 0) : 0;
  const groupedIds = new Set(operationToolbar ? [primary?.id, ...menuOperations.map(operation => operation.id),
    applyOperation?.id, revertOperation?.id].filter(Boolean) : []);
  const inlineOperations = operations.filter(operation => !groupedIds.has(operation.id));

  const groupedActions = exportState => operationToolbar ? <div className="forge-editable-collection__operation-bar forge-editable-collection__operation-menu">
    {primary && <Button intent="primary" className="forge-toolbar-action" disabled={operationState(primary).disabled} onClick={() => invoke(primary)}>{primary.label || primary.id}</Button>}
    {(!!menuOperations.length || !!exportState) && <RegisteredPopover
      context={dataContext} item={{id:`${container.id}-operations`,type:'menu',label:operationToolbar.menu.label || 'Actions'}}
      disabled={!exportState && (!selectedRows.length || !menuOperations.some(operation => operationState(operation).visible))} placement="bottom-start" renderContent={close => <Menu className="forge-toolbar-select-menu forge-dropdown-menu" aria-label={`${operationToolbar.menu.label || 'Actions'} menu`}>
        {menuOperations.map(operation => {
          const state = operationState(operation);
          return state.visible ? <MenuItem key={operation.id} text={operationToolbar.menu.labels?.[operation.id] || operation.label || operation.id}
            disabled={state.disabled} onClick={() => {close();return invoke(operation);}}/> : null;
        })}
        {exportState && <TableExportSubmenu context={dataContext} exportState={exportState} close={close}/>}
      </Menu>}>
      <Button className="forge-toolbar-action" rightIcon={<Icon name="lucide:chevron-down"/>} disabled={!exportState && (!selectedRows.length || !menuOperations.some(operation => operationState(operation).visible))}>{operationToolbar.menu.label || 'Actions'}</Button>
    </RegisteredPopover>}
    {exportState?.error ? <span className="forge-toolbar-export-error" role="alert">{exportState.error}</span> : null}
  </div> : null;

  const renderToolbarActions = exportState => <>{groupedActions(exportState)}{inlineOperations.length > 0 ? (
        <ButtonGroup className="forge-editable-collection__operation-bar" minimal={false}>
          {inlineOperations.map((operation) => {
            const state = operationState(operation);
            if (!state.visible) return null;
            const command = operation.mutation || spec.mutation;
            if (command && !operation.handler && !operation.dialogId) {
              return <MutationCommand key={operation.id} command={{...command, commandId: command.commandId || operation.id, label: operation.label || operation.id, intent: operation.intent || command.intent, tooltip: operation.tooltip || command.tooltip}} context={dataContext} extras={{selectedRows: state.rows, operationId: operation.id}} disabled={state.disabled}/>;
            }
            const disabled = state.disabled;
            const button = (
              <Button
                icon={operation.icon}
                aria-label={actionAccessibleName(operation)}
                className={`forge-toolbar-action${actionIconOnly(operation) ? ' is-icon-only' : ''}`}
                intent={operation.intent || undefined}
                disabled={disabled}
                title={operation.tooltip || actionAccessibleName(operation)}
                onClick={() => invoke(operation)}
              >
                {actionIconOnly(operation) ? null : operation.label || operation.id}
              </Button>
            );
            return disabled && operation.tooltip ? (
              <DisabledActionShell key={operation.id} reason={operation.tooltip} label={operation.label || operation.id}>
                {button}
              </DisabledActionShell>
            ) : React.cloneElement(button, {key: operation.id});
          })}
        </ButtonGroup>
      ) : null}</>;
  const toolbarActions = operationToolbar?.menu ? renderToolbarActions : renderToolbarActions();
  return (
    <div style={containerSizingStyle(container,sizingMode,{chrome:true})} className={`forge-editable-collection${operationToolbar ? ' forge-list-page-review' : ''}`} data-forge-primitive="editableCollection">
      {spec.selectionStatus === true ? (
        <div className="forge-editable-collection__selection-status" role="status" aria-live="polite">
          {selectedRows.length > 0
            ? `${selectedRows.length} ${selectedRows.length === 1 ? 'row' : 'rows'} selected`
            : (spec.selectionPrompt || 'Select a row to enable row actions.')}
        </div>
      ) : null}
      {container.responsiveDataGrid
        ? <ResponsiveDataGrid toolbarActions={toolbarActions} sizingMode={sizingMode} container={{...container, dataSourceRef: ref}} context={dataContext} isActive={isActive}/>
        : <TablePanel toolbarActions={toolbarActions} sizingMode={sizingMode} container={{...container, dataSourceRef: ref}} context={dataContext} isActive={isActive}/>}
      {operationToolbar && changeCount > 0 && applyOperation && revertOperation && <div className="forge-table-edit-review" role="region" aria-label="Review table changes">
        <span className="forge-table-edit-review__status" role="status" aria-live="polite"><span className="forge-table-edit-review__dot" aria-hidden="true"/><span><span data-forge-value-type="number">{changeCount}</span> unsaved {changeCount === 1 ? 'change' : 'changes'}{rowCount > 0 && <> in <span data-forge-value-type="number">{rowCount}</span> {rowCount === 1 ? 'row' : 'rows'}</>}</span></span>
        <ForgeButton variant="secondary" disabled={operationState(revertOperation).disabled} onClick={() => invoke(revertOperation)}>Revert all</ForgeButton>
        <ForgeButton variant="primary" disabled={operationState(applyOperation).disabled} onClick={() => invoke(applyOperation)}>Apply changes</ForgeButton>
      </div>}
    </div>
  );
}
