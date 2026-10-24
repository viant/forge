import React, {useEffect, useRef, useState} from 'react';
import Button from '../Button.jsx';
import Icon from '../Icon.jsx';
import Typography, {typographyProps} from '../Typography.jsx';
import './documentChat.css';

export default function StarterTaskBrowser({tasks = [], categories = [], onSelect, initialLibrary = false, library: controlledLibrary, onLibraryChange, assistantName = 'your assistant'}) {
    const [localLibrary, setLocalLibrary] = useState(initialLibrary);
    const library = controlledLibrary ?? localLibrary;
    const setLibrary = value => {const next = typeof value === 'function' ? value(library) : value; setLocalLibrary(next); onLibraryChange?.(next);};
    const browserRef = useRef(null), previousLibrary = useRef(library);
    useEffect(() => {if (previousLibrary.current === library) return; previousLibrary.current = library; browserRef.current?.querySelector(library ? 'h1' : '.forge-task-browse')?.focus({preventScroll: true});}, [library]);
    const [category, setCategory] = useState('');
    const [search, setSearch] = useState('');
    const searchRef = useRef(null);
    const matches = (task, group) => task.categoryId === group.id && (!task.agentId || !group.agentId || task.agentId === group.agentId);
    const groups = categories.filter(group => tasks.some(task => matches(task, group)));
    const key = group => `${group.agentId || ''}:${group.id}`;
    const active = groups.find(group => key(group) === category);
    const query = search.trim().toLocaleLowerCase();
    const filtered = tasks.filter(task => (!active || matches(task, active)) && (!library || !query ||
        [task.title, task.description, task.resultLabel, ...groups.filter(group => matches(task, group)).map(group => group.title)].join(' ').toLocaleLowerCase().includes(query)));
    const suggested = groups.length ? groups.map(group => tasks.find(task => matches(task, group))) : tasks.slice(0, 5);
    const visible = library || active ? filtered : [...new Set(suggested)];
    if (!tasks.length) return null;
    const rows = items => <div className="forge-task-list">{items.map(task => <button key={`${task.agentId || ''}:${task.id}`} type="button" className="forge-task-row" onClick={() => onSelect?.(task, {library, category, search})}>
        <span><Typography as="strong" typeRole="label">{task.title}</Typography><Typography as="span" typeRole="small">{task.description || task.agentName || ''}</Typography>{task.resultLabel ? <Typography as="span" typeRole="caption">{task.resultLabel}</Typography> : null}</span><Icon name="lucide:arrow-right"/>
    </button>)}</div>;
    return <section className={`forge-task-browser${library ? ' is-library' : ''}`} ref={browserRef} aria-label="Starter tasks" data-testid="chat-starter-tasks">
        {library ? <>
            <Button className="forge-task-back" variant="link" {...typographyProps('small')} onClick={() => {setLibrary(false); setCategory(''); setSearch('');}}><Icon name="lucide:arrow-left"/>New Chat</Button>
            <Typography as="h1" typeRole="display" tabIndex={-1}>All tasks</Typography>
            <Typography className="forge-task-intro" as="p" typeRole="body">Explore what {assistantName || 'your assistant'} can help you do. Choose a task to review the details and get started.</Typography>
        </> : <div className="forge-task-heading">
            <Typography as="h2" typeRole="section">Start with a task</Typography>
            <Button className="forge-task-browse" variant="link" {...typographyProps('small')} onClick={() => {setLibrary(true); setCategory(''); setSearch('');}}>Browse all {tasks.length} tasks<Icon name="lucide:arrow-right"/></Button>
        </div>}
        {library ? <label className="forge-task-search" {...typographyProps('body')}><Icon name="lucide:search"/><input ref={searchRef} {...typographyProps('body')} type="search" aria-label="Search tasks" placeholder="Search tasks" value={search} onChange={event => setSearch(event.target.value)}/></label> : null}
        <div className="forge-task-filters" role="group" aria-label="Task categories">
            <Button variant="ghost" {...typographyProps('small')} aria-pressed={!active} onClick={() => setCategory('')}>{library ? `All tasks (${tasks.length})` : 'Suggested'}</Button>
            {groups.map(group => <Button key={key(group)} variant="ghost" {...typographyProps('small')} aria-pressed={active === group} onClick={() => setCategory(key(group))}><span>{group.title} <span className="forge-task-category-count">{tasks.filter(task => matches(task, group)).length}</span></span></Button>)}
        </div>
        <Typography as="p" className="forge-task-note" typeRole="small" role="status">{library || active ? (library ? `${visible.length} ${visible.length === 1 ? 'task' : 'tasks'}` : active.description || `${visible.length} tasks`) : 'A few ways to get started, one from each category.'}</Typography>
        {library && !active && groups.length ? groups.map(group => {
            const items = visible.filter(task => matches(task, group));
            return items.length ? <section className="forge-task-group" key={key(group)}><Typography as="h2" typeRole="section">{group.title}</Typography>{rows(items)}</section> : null;
        }) : rows(visible)}
        {!visible.length ? <div className="forge-task-empty"><Typography as="h3" typeRole="section">No tasks match your search</Typography><Typography as="p" typeRole="body">Try another term or category.</Typography><Button variant="ghost" onClick={() => {setSearch(''); setCategory(''); searchRef.current?.focus();}}>Show all tasks</Button></div> : null}
    </section>;
}
