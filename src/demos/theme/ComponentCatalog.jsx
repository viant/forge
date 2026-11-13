import React, {useMemo, useState} from 'react';
import FilterChips from '../../components/content/FilterChips.jsx';
import Icon from '../../components/Icon.jsx';
import StatusChip from '../../components/StatusChip.jsx';
import {componentCatalog, componentFamilies} from './componentCatalog.js';
import './componentCatalog.css';

const stageLabel = {live: 'Live', review: 'In review', planned: 'Planned'};
const stageTone = {live: 'success', review: 'warning', planned: 'neutral'};

export default function ComponentCatalog() {
    const [family, setFamily] = useState('all');
    const [query, setQuery] = useState('');
    const terms = query.trim().toLocaleLowerCase();
    const visible = useMemo(() => componentCatalog.filter(item =>
        (family === 'all' || item.family === family)
        && (!terms || [item.name, ...item.variants, ...item.behaviors].join(' ').toLocaleLowerCase().includes(terms))), [family, terms]);
    const options = [
        {value: 'all', label: 'All', count: componentCatalog.length},
        ...componentFamilies.map(group => ({value: group.id, label: group.name, count: componentCatalog.filter(item => item.family === group.id).length})),
    ];
    const liveCount = componentCatalog.filter(item => item.stage === 'live').length;

    return <section className="ds2-catalog" id="ds2-component-catalog" aria-labelledby="ds2-catalog-title">
        <div className="ds2-catalog__heading">
            <div>
                <h2 id="ds2-catalog-title">Components</h2>
                <p>Find a component, compare its variants, then try its behavior in the live examples below.</p>
            </div>
            <p className="ds2-catalog__summary">{liveCount} live examples · {componentCatalog.length} catalog entries</p>
        </div>
        <div className="ds2-catalog__tools">
            <label className="ds2-catalog__search">
                <span>Search components</span>
                <span className="ds2-catalog__search-field"><Icon name="lucide:search"/><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search names, variants, or behavior" aria-label="Search components"/></span>
            </label>
            <FilterChips aria-label="Component categories" value={[family]} options={options} onChange={next => setFamily(next.at(-1) || 'all')}/>
        </div>
        <p className="ds2-catalog__result" role="status">{visible.length} {visible.length === 1 ? 'component' : 'components'} shown</p>
        {visible.length ? componentFamilies.map(group => {
            const items = visible.filter(item => item.family === group.id);
            if (!items.length) return null;
            return <div className="ds2-catalog__group" key={group.id}>
                <h3>{group.name}<span>{items.length}</span></h3>
                <div className="ds2-catalog__items">
                    {items.map(item => <article className="ds2-catalog__item" key={`${item.family}:${item.name}`}>
                        <div className="ds2-catalog__identity"><h4>{item.name}</h4><StatusChip tone={stageTone[item.stage]}>{stageLabel[item.stage]}</StatusChip></div>
                        <dl>
                            <div><dt>Variants</dt><dd>{item.variants.join(' · ')}</dd></div>
                            <div><dt>Try</dt><dd>{item.behaviors.join(' · ')}</dd></div>
                        </dl>
                        {item.href ? <a href={item.href}>{item.stage === 'planned' ? 'View proposal' : item.stage === 'review' ? 'View current example' : 'Try live example'}<Icon name="lucide:arrow-right"/></a>
                            : <span className="ds2-catalog__pending">Example to build</span>}
                    </article>)}
                </div>
            </div>;
        }) : <p className="ds2-catalog__empty">No components match. Try a different name or behavior.</p>}
    </section>;
}
