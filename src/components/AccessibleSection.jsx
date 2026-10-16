import React from 'react';
import {Card, Collapse, Icon} from '@blueprintjs/core';

export default function AccessibleSection({title = '', subtitle = '', icon, rightElement, compact = false, collapsible = true, collapseProps = {}, children, className = '', ...cardProps}) {
    const generatedId = React.useId().replace(/:/g, '');
    const contentId = `forge-section-${generatedId}`;
    const titleId = `${contentId}-title`;
    const content = <div data-forge-part="section-content" id={contentId} style={{display: 'flex', flexDirection: 'column', flex: '1 1 auto', minWidth: 0, minHeight: 0}}>{children}</div>;
    const controlled = typeof collapseProps?.isOpen === 'boolean';
    const [localOpen, setLocalOpen] = React.useState(collapseProps?.defaultIsOpen !== false);
    const isOpen = !collapsible || (controlled ? collapseProps.isOpen : localOpen);
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
        <Card {...safeCardProps} aria-labelledby={title ? titleId : undefined} className={`bp6-section${compact ? ' bp6-compact' : ''}${!isOpen ? ' bp6-section-collapsed' : ''}${className ? ` ${className}` : ''}`}>
            {title ? <div data-forge-part="section-header" className={`bp6-section-header${collapsible ? ' bp6-interactive' : ''}`} onClick={collapsible ? toggle : undefined}>
                <div className="bp6-section-header-left">
                    {icon ? <Icon icon={icon} aria-hidden="true" className="bp6-text-muted"/> : null}
                    <div>
                        <h6 id={titleId} data-forge-part="section-title" className="bp6-heading bp6-section-header-title">{title}</h6>
                        {subtitle ? <div className="bp6-text-muted bp6-section-header-sub-title">{subtitle}</div> : null}
                    </div>
                </div>
                {rightElement || collapsible ? <div className="bp6-section-header-right">
                    {rightElement}
                    {collapsible ? <button type="button" className="bp6-button bp6-minimal bp6-small bp6-section-header-collapse-caret"
                        aria-expanded={isOpen} aria-controls={contentId} aria-label={isOpen ? 'collapse section' : 'expand section'}
                        onClick={(event) => { event.stopPropagation(); toggle(); }}>
                        <Icon icon={isOpen ? 'chevron-up' : 'chevron-down'} aria-hidden="true"/>
                    </button> : null}
                </div> : null}
            </div> : null}
            {collapsible ? <Collapse {...collapseRest} isOpen={isOpen} keepChildrenMounted={collapseProps?.keepChildrenMounted === true}>
                {content}
            </Collapse> : content}
        </Card>
    );
}
