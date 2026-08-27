import React from 'react';
import {Button, Icon} from '@blueprintjs/core';
import {useToolbarControlEvents} from '../../../hooks/event.js';

const TableEmptyState = ({context, config = {}}) => {
    const action = config?.action?.id ? config.action : null;
    const actionEvents = useToolbarControlEvents(context, action ? [action] : []);
    const {events = {}, stateEvents = {}} = action ? (actionEvents[action.id] || {}) : {};
    const disabled = stateEvents.onReadonly ? stateEvents.onReadonly() : false;
    const steps = Array.isArray(config.steps) ? config.steps : [];

    return (
        <section
            className={`forge-table-empty-state${steps.length ? ' forge-table-empty-state--guided' : ''}`}
            aria-label={config.title || 'No records'}
            style={config.style}
        >
            {config.icon ? (
                <div className="forge-table-empty-state__visual" aria-hidden="true">
                    <Icon icon={config.icon} size={28}/>
                </div>
            ) : null}
            {config.kicker ? <div className="forge-table-empty-state__kicker">{config.kicker}</div> : null}
            <h2 className="forge-table-empty-state__title">{config.title || 'No records yet'}</h2>
            {config.body ? <p className="forge-table-empty-state__body">{config.body}</p> : null}
            {steps.length ? (
                <ol className="forge-table-empty-state__steps">
                    {steps.map((step, index) => (
                        <li className="forge-table-empty-state__step" key={step.id || step.title || index}>
                            <span className="forge-table-empty-state__step-number">{step.number || index + 1}</span>
                            <span className="forge-table-empty-state__step-copy">
                                <strong>{step.title}</strong>
                                {step.body ? <span>{step.body}</span> : null}
                            </span>
                        </li>
                    ))}
                </ol>
            ) : null}
            {action ? (
                <Button
                    icon={action.icon}
                    intent={action.intent || 'primary'}
                    disabled={disabled}
                    className={`forge-table-empty-state__action${action.className ? ` ${action.className}` : ''}`}
                    style={action.style}
                    {...events}
                >
                    {action.label || 'Get started'}
                </Button>
            ) : null}
        </section>
    );
};

export default TableEmptyState;
