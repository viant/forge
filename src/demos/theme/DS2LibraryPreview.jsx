import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Menu, MenuItem} from '@blueprintjs/core';
import '@blueprintjs/core/lib/css/blueprint.css';
import '../../packs/blueprint/index.jsx';
import {ForgeThemeBoundary, ForgeThemeProvider} from '../../components/ThemeBoundary.jsx';
import Button from '../../components/Button.jsx';
import Popover from '../../components/Popover.jsx';
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

function App() {
    const [mode, setMode] = useState('light');
    const [draft, setDraft] = useState('');
    const [menuChoice, setMenuChoice] = useState('No action selected');
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
                        <div><h3>Count badge candidate</h3><div className="ds2-library__count-examples"><span>Approvals <span className="ds2-library__count-badge">4</span></span><span>Messages <span className="ds2-library__count-badge">99+</span></span></div><p className="ds2-library__candidate-note">Visual proposal. Shared component pending review.</p></div>
                        <div><h3>Interactive filters</h3><FilterChips aria-label="Example filters" value={currentFilters} options={filterOptions} onChange={setCurrentFilters}/></div>
                    </div>
                </section>
                <section className="ds2-library__family" id="ds2-menu" aria-label="Action menu">
                    <h2>Action menu</h2>
                    <p>Open the menu to inspect item spacing, disabled state, focus, and the overlay surface.</p>
                    <Popover content={<Menu aria-label="Campaign actions">
                        <MenuItem text="Open campaign" onClick={() => setMenuChoice('Open campaign selected')}/>
                        <MenuItem text="Duplicate campaign" onClick={() => setMenuChoice('Duplicate campaign selected')}/>
                        <MenuItem text="Export data" disabled/>
                    </Menu>}><Button variant="secondary">Campaign actions</Button></Popover>
                    <span role="status">{menuChoice}</span>
                </section>
                <section className="ds2-library__family" id="ds2-chat" aria-label="Chat thread">
                    <h2>Chat thread</h2>
                    <p>Forge message and composer primitives shown together. Agently owns their final shell composition.</p>
                    <div className="forge-document-chat ds2-library__conversation">
                        {messages.map((message, index) => <MessageCard key={message.id} msg={message} messageIndex={index}/>)}
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
