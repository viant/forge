import React from 'react';
import Typography from '../Typography.jsx';
import './ListPagePattern.css';

// A composition of existing controls and tables. Data, permissions and table
// interactions remain with the native control supplied in each named region.
export default function ListPagePattern({title, period, actions, summary, children, className = ''}) {
    return <section className={`forge-list-page ${className}`.trim()} aria-label={typeof title === 'string' ? title : 'Record list'}>
        <header className="forge-list-page__header">
            <Typography as="h1" typeRole="title">{title}</Typography>
            {period && <div className="forge-list-page__period">{period}</div>}
        </header>
        {actions}
        <div className="forge-list-page__table">{children}{summary}</div>
    </section>;
}
