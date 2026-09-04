import React from 'react';
import {Card, Collapse, Icon} from '@blueprintjs/core';

export default function AccessibleSection({title = '', subtitle = '', icon, rightElement, compact = false, collapsible: _collapsible, collapseProps = {}, children, className = '', ...cardProps}) {
    const generatedId = React.useId().replace(/:/g, '');
    const contentId = `forge-section-${generatedId}`;
    const controlled = typeof collapseProps?.isOpen === 'boolean';
    const [localOpen, setLocalOpen] = React.useState(collapseProps?.defaultIsOpen !== false);
    const isOpen = controlled ? collapseProps.isOpen : localOpen;
    const toggle = () => {
        if (!controlled) setLocalOpen((current) => !current);
        collapseProps?.onToggle?.();
    };
    const safeCardProps = {...cardProps};
    delete safeCardProps.collapsible;
    delete safeCardProps.persistState;
    delete safeCardProps.stateKey;
    delete safeCardProps.properties;
    const {isOpen: _isOpen, defaultIsOpen: _defaultIsOpen, onToggle: _onToggle, ...collapseRest} = collapseProps || {};
    return (
        <Card {...safeCardProps} className={`bp6-section${compact ? ' bp6-compact' : ''}${!isOpen ? ' bp6-section-collapsed' : ''}${className ? ` ${className}` : ''}`}>
            <div className="bp6-section-header bp6-interactive" onClick={toggle}>
                <div className="bp6-section-header-left">
                    {icon ? <Icon icon={icon} aria-hidden="true" className="bp6-text-muted"/> : null}
                    <div>
                        <h6 className="bp6-heading bp6-section-header-title">{title}</h6>
                        {subtitle ? <div className="bp6-text-muted bp6-section-header-sub-title">{subtitle}</div> : null}
                    </div>
                </div>
                <div className="bp6-section-header-right">
                    {rightElement}
                    <button type="button" className="bp6-button bp6-minimal bp6-small bp6-section-header-collapse-caret"
                        aria-expanded={isOpen} aria-controls={contentId} aria-label={isOpen ? 'collapse section' : 'expand section'}
                        onClick={(event) => { event.stopPropagation(); toggle(); }}>
                        <Icon icon={isOpen ? 'chevron-up' : 'chevron-down'} aria-hidden="true"/>
                    </button>
                </div>
            </div>
            <Collapse {...collapseRest} isOpen={isOpen} keepChildrenMounted={collapseProps?.keepChildrenMounted === true}>
                <div id={contentId}>{children}</div>
            </Collapse>
        </Card>
    );
}
