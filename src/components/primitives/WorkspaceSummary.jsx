import React from 'react';
import {Button, Callout, Icon, Tag} from '@blueprintjs/core';
import {useSignals} from '@preact/signals-react/runtime';
import {resolveSelector} from '../../utils/selector.js';
import './WorkspaceSummary.css';

// Collection presentation only: the window owns discovery, commands and routing.
export default function WorkspaceSummary({container, context}) {
  useSignals();
  const spec = container.workspaceSummary || {};
  const scoped = ref => ref ? context.Context(ref) : context;
  const invoke = (action, item, ref) => scoped(ref).lookupHandler?.(action.handler)?.({context:scoped(ref), action, item});
  const actionButton = action => <Button key={action.id} icon={action.icon} intent={action.intent} onClick={() => invoke(action)}>{action.label}</Button>;
  const state = scoped(spec.stateDataSourceRef)?.signals?.form?.value || {};
  return <section className="forge-workspace-summary" data-forge-primitive="workspaceSummary" aria-label={spec.title || container.title || undefined}>
    {(spec.title || spec.description || spec.actions?.length > 0) && <header className="forge-workspace-summary__header"><div>{spec.title && <h1>{spec.title}</h1>}{spec.description && <p>{spec.description}</p>}</div><div className="forge-workspace-summary__actions">{(spec.actions || []).map(actionButton)}</div></header>}
    {state[spec.errorField] && <Callout intent="warning" role="alert">{state[spec.errorField]}</Callout>}
    <div className="forge-workspace-summary__sections">{(spec.sections || []).map(section => {
      const rows = scoped(section.dataSourceRef)?.signals?.collection?.value || [];
      return <section key={section.id} className={`forge-workspace-summary__section${section.fullWidth ? ' is-full-width' : ''}`} aria-labelledby={`${container.id}-${section.id}`}>
        <div className="forge-workspace-summary__section-heading"><h2 id={`${container.id}-${section.id}`}>{section.title}</h2>{section.action && actionButton(section.action)}</div>
        <div className="forge-workspace-summary__list">{rows.length ? rows.map((row,index) => {
          const value = field => field ? resolveSelector(row, field) : undefined;
          const status = value(section.statusField);
          const statusSpec = section.statuses?.[status] || {};
          const date = value(section.dateField);
          const parsed = date && new Date(date);
          const dateLabel = date ? (Number.isNaN(parsed.valueOf()) ? String(date) : new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(parsed)) : '';
          const content = <>{status && section.statusFirst && <Tag minimal intent={statusSpec.intent} icon={statusSpec.icon}>{status}</Tag>}<span className="forge-workspace-summary__identity"><strong>{value(section.labelField)}</strong><small>{(section.detailFields || []).map(value).filter(Boolean).join(' · ')}</small></span>{status && !section.statusFirst && <Tag minimal intent={statusSpec.intent} icon={statusSpec.icon}>{status}</Tag>}{dateLabel && <time dateTime={String(date)}>{dateLabel}</time>}{section.handler && <Icon icon="chevron-right" size={14} aria-hidden="true"/>}</>;
          return section.handler ? <button type="button" key={row.id || index} onClick={() => invoke(section,row,section.dataSourceRef)}>{content}</button> : <div className="forge-workspace-summary__row" key={row.id || index}>{content}</div>;
        }) : <p className="forge-workspace-summary__empty">{section.emptyText || 'No records.'}</p>}</div>
      </section>;
    })}</div>
  </section>;
}
