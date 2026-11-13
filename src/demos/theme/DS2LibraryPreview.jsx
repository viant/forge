import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Menu, MenuItem} from '@blueprintjs/core';
import '@blueprintjs/core/lib/css/blueprint.css';
import {DateRangePresetInput} from '../../packs/blueprint/index.jsx';
import {ForgeThemeBoundary, ForgeThemeProvider} from '../../components/ThemeBoundary.jsx';
import Button from '../../components/Button.jsx';
import DropdownMenu from '../../components/DropdownMenu.jsx';
import MessageCard from '../../components/chat/MessageCard.jsx';
import Composer from '../../components/chat/Composer.jsx';
import FoundationSpecimen from './FoundationSpecimen.jsx';
import ComponentCatalog from './ComponentCatalog.jsx';
import ChartSpecimen from './ChartSpecimen.jsx';
import DocumentSpecimen from './DocumentSpecimen.jsx';
import ReportDocumentSpecimen from './ReportDocumentSpecimen.jsx';
import TableWidthSpecimen from './TableWidthSpecimen.jsx';
import ComparisonWidthSpecimen from './ComparisonWidthSpecimen.jsx';
import ProgressBar from '../../components/control/ProgressBar.jsx';
import SoftSkeleton from '../../components/SoftSkeleton.jsx';
import FilterChips from '../../components/content/FilterChips.jsx';
import StatusChip from '../../components/StatusChip.jsx';
import CountBadge from '../../components/CountBadge.jsx';
import './ds2LibraryPreview.css';
import '../../components/chat.css';

const themeStylesheets = [
    import.meta.env.VITE_DESIGN_SYSTEM_TOKENS_CSS,
    import.meta.env.VITE_DESIGN_SYSTEM_THEME_CSS,
    import.meta.env.VITE_DESIGN_SYSTEM_CANDIDATE_CSS,
].filter(Boolean);
const themeLabel = import.meta.env.VITE_DESIGN_SYSTEM_LABEL || 'Forge neutral';

function loadStylesheet(url) {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.onload = resolve;
        link.onerror = () => reject(new Error(`Could not load theme stylesheet: ${url}`));
        document.head.appendChild(link);
    });
}

async function loadReviewTheme() {
    await Promise.all(themeStylesheets.map(loadStylesheet));
    const fontUrl = import.meta.env.VITE_DESIGN_SYSTEM_FONT_URL;
    const fontFamily = import.meta.env.VITE_DESIGN_SYSTEM_FONT_FAMILY;
    if (fontUrl && fontFamily) {
        const font = new FontFace(fontFamily, `url("${fontUrl}")`, {weight: '200 800'});
        document.fonts.add(await font.load());
    }
}

const messages = [
    {id: 'review-user', role: 'user', content: 'Which campaigns need attention?', createdAt: '2026-11-12T10:00:00Z'},
    {id: 'review-assistant', role: 'assistant', content: 'I found three pacing risks. The first campaign needs an approval before launch.', createdAt: '2026-11-12T10:00:01Z'},
];
const calendarOptions = [
    {value: 'recent', label: 'Recent period', range: {start: '2026-11-06', end: '2026-11-12'}},
    {value: 'previous', label: 'Previous period', range: {start: '2026-10-30', end: '2026-11-05'}},
    {value: 'custom', label: 'Custom dates'},
];

function App() {
    const [mode, setMode] = useState('light');
    const [draft, setDraft] = useState('');
    const [menuChoice, setMenuChoice] = useState('No action selected');
    const [viewChoice, setViewChoice] = useState('List view');
    const [periodChoice, setPeriodChoice] = useState('recent');
    const [periodRange, setPeriodRange] = useState(calendarOptions[0].range);
    const [currentFilters, setCurrentFilters] = useState(['active']);
    const filterOptions = [
        {value: 'active', label: 'Active', count: 12},
        {value: 'pending', label: 'Pending', count: 4},
        {value: 'archived', label: 'Archived', count: 8},
        {value: 'unavailable', label: 'Unavailable', disabled: true},
    ];
    return <ForgeThemeProvider themeId="design-system-2" mode={mode}>
        <ForgeThemeBoundary windowKey="design-system-2-library">
            <div className="ds2-library">
                <header className="ds2-library__top">
                    <div>
                        <strong>{themeLabel} · Component library</strong><strong className="ds2-library__mobile-title">Component library</strong>
                        <span>Live Forge component library · local review</span>
                    </div>
                    <div className="ds2-library__top-actions">
                        <Button variant="secondary" onClick={() => setMode(current => current === 'light' ? 'dark' : 'light')}>
                            {mode === 'light' ? 'View dark theme' : 'View light theme'}
                        </Button>
                    </div>
                </header>
                <div className="ds2-library__intro">
                    <h1>One library across the product</h1>
                    <p>Real Forge components using {themeLabel} semantic values in both themes.</p>
                    <p className="ds2-library__review-state" role="status">{mode === 'light' ? 'Light' : 'Dark'} theme · soft surface borders</p>
                </div>
                <ComponentCatalog/>
                <FoundationSpecimen includeDocuments={false}/>
                <section className="ds2-library__family" id="ds2-loading" aria-label="Loading and progress">
                    <h2>Loading and progress</h2>
                    <p>Compare the existing appearances with a full-width candidate composed from the semantic meter. The older full bar uses fixed green and red; it needs a shared replacement.</p>
                    <div className="ds2-library__progress-grid">
                        <div><h3>Inline meter</h3><ProgressBar value={65} text="65%" label="Example completion" progress={{appearance: 'inline'}}/></div>
                        <div><h3>Legacy full bar</h3><ProgressBar value={65} text="65%" label="Example completion"/></div>
                        <div className="ds2-library__progress-candidate"><h3>Full-width candidate</h3><ProgressBar value={65} text="65%" label="Example completion" progress={{appearance: 'inline'}}/></div>
                        <div className="ds2-library__skeleton-review"><h3>Loading placeholder</h3>
                            <span>Current</span><div aria-hidden="true"><SoftSkeleton lines={3}/></div>
                            <span>Visibility candidate</span><div className="ds2-library__skeleton-candidate" aria-hidden="true"><SoftSkeleton lines={3}/></div>
                            <span className="ds2-library__sr-only" role="status">Example content is loading</span>
                        </div>
                    </div>
                </section>
                <section className="ds2-library__family" id="ds2-filter-chips" aria-label="Filter and status chips">
                    <h2>Labels, counts, and filters</h2>
                    <p>Status is a label; filters are controls; counts are tallies. These examples use the shared semantic component recipes.</p>
                    <div className="ds2-library__chip-grid">
                        <div><h3>Status labels</h3><div className="ds2-library__chip-row"><StatusChip tone="success">Active</StatusChip><StatusChip tone="warning">Pending</StatusChip><StatusChip tone="neutral">Archived</StatusChip></div></div>
                        <div><h3>Count badges</h3><div className="ds2-library__count-examples"><span>Approvals <CountBadge count={4}/></span><span>Messages <CountBadge count={132}/></span></div><p className="ds2-library__candidate-note">Numeric tallies use one shared recipe. The label names what is counted.</p></div>
                        <div><h3>Interactive filters</h3><FilterChips aria-label="Example filters" value={currentFilters} options={filterOptions} onChange={setCurrentFilters}/></div>
                    </div>
                </section>
                <section className="ds2-library__family" id="ds2-menu" aria-label="Action menu">
                    <h2>Action menu</h2>
                    <p>Actions execute immediately; view options keep their selection. Every dropdown shares the same full-width row hover, rounded surface, and keyboard behavior.</p>
                    <div className="ds2-library__menu-examples">
                        <DropdownMenu content={<Menu aria-label="Quick actions">
                            <MenuItem text="Open" onClick={() => setMenuChoice('Open selected')}/>
                            <MenuItem text="Copy" onClick={() => setMenuChoice('Copy selected')}/>
                        </Menu>}><Button variant="secondary">Quick actions</Button></DropdownMenu>
                        <DropdownMenu content={<Menu aria-label="View options" role="listbox">
                            {['List view', 'Grid view'].map(option => <MenuItem key={option} text={option} roleStructure="listoption" selected={viewChoice === option} onClick={() => setViewChoice(option)}/>)}
                        </Menu>}><Button variant="secondary">View options</Button></DropdownMenu>
                        <DropdownMenu content={<Menu aria-label="Item actions">
                            <MenuItem text="Open item" onClick={() => setMenuChoice('Open item selected')}/>
                            <MenuItem text="Duplicate item" onClick={() => setMenuChoice('Duplicate item selected')}/>
                            <MenuItem text="Review item details and supporting information" onClick={() => setMenuChoice('Review details selected')}/>
                            <MenuItem text="Export data" disabled/>
                        </Menu>}><Button variant="secondary">Item actions</Button></DropdownMenu>
                    </div>
                    <span role="status">{menuChoice} · {viewChoice} selected</span>
                    <div className="ds2-library__calendar-example">
                        <h3>Calendar menu</h3>
                        <p>Choose a period or enter custom dates. The popup and native calendar follow the selected Light or Dark theme.</p>
                        <DateRangePresetInput item={{id: 'review-period', label: 'Review period'}} value={periodChoice} range={periodRange}
                            options={calendarOptions} customApplyEnabled
                            onPresetRequest={option => {setPeriodChoice(option.value); setPeriodRange(option.range); return true;}}
                            onRangeChange={range => {setPeriodChoice('custom'); setPeriodRange(range);}}/>
                    </div>
                </section>
                <section className="ds2-library__family" id="ds2-chat" aria-label="Chat thread">
                    <h2>Chat thread</h2>
                    <p>Forge message and composer primitives shown together. Agently owns their final shell composition.</p>
                    <div className="forge-document-chat ds2-library__conversation">
                        {messages.map((message, index) => <MessageCard key={message.id} msg={message} messageIndex={index} appearance="document"/>)}
                        <Composer appearance="document" draftKey="ds2-review" draftValue={draft} onDraftChange={setDraft} onSubmit={() => setDraft('')}/>
                    </div>
                </section>
                <section className="ds2-library__charts" aria-label="Charts and analytics">
                    <ChartSpecimen/>
                </section>
                <section className="ds2-library__patterns" id="ds2-patterns" aria-label="Page and report patterns">
                    <h2>Page and report patterns</h2>
                    <p>Composition examples built from the same shared foundations and components.</p>
                    <div className="ds2-library__pattern-grid">
                        <DocumentSpecimen/>
                        <ReportDocumentSpecimen/>
                        <TableWidthSpecimen/>
                        <ComparisonWidthSpecimen/>
                    </div>
                </section>
            </div>
        </ForgeThemeBoundary>
    </ForgeThemeProvider>;
}

loadReviewTheme().then(() => createRoot(document.getElementById('root')).render(<App/>)).catch(error => {
    document.getElementById('root').textContent = error.message;
});
