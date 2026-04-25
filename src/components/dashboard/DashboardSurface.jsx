import React, {useMemo, useState} from "react";
import {useSignalEffect} from "@preact/signals-react";
import {getDashboardFilterSignal, getDashboardSelectionSignal} from "../../core/store/signals.js";
import "./Dashboard.css";

const MODE_LABELS = {
    dashboard: "Dashboard",
    analyze: "Analyze",
    report: "Report",
};

const DEFAULT_REPORT_INCLUDE = {
    narrative: true,
    kpis: true,
    charts: true,
    tables: true,
    audit: false,
};

function normalizeMode(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "analysis") return "analyze";
    if (normalized === "document") return "report";
    return normalized || "dashboard";
}

function normalizeModes(container = {}) {
    const configured = container.toolbar?.modes || container.modes || container.dashboard?.modes;
    const reportEnabled = container.report?.enabled === true;
    const modes = Array.isArray(configured) && configured.length > 0
        ? configured.map(normalizeMode)
        : (reportEnabled ? ["dashboard", "analyze", "report"] : ["dashboard"]);
    const unique = modes.filter((mode, index) => mode && modes.indexOf(mode) === index && (mode !== "report" || reportEnabled));
    if (reportEnabled && !unique.includes("report")) {
        unique.push("report");
    }
    return unique.length ? unique : ["dashboard"];
}

function formatStateValue(value) {
    if (Array.isArray(value)) return value.join(", ");
    if (value && typeof value === "object") {
        const edges = [value.start, value.end].filter(Boolean);
        return edges.length ? edges.join(" to ") : JSON.stringify(value);
    }
    if (value == null || value === "") return "-";
    return String(value);
}

function useDashboardStateSnapshot(dashboardKey) {
    const [snapshot, setSnapshot] = useState({filters: {}, selection: {}});

    useSignalEffect(() => {
        if (!dashboardKey) {
            setSnapshot({filters: {}, selection: {}});
            return;
        }
        setSnapshot({
            filters: getDashboardFilterSignal(dashboardKey).value || {},
            selection: getDashboardSelectionSignal(dashboardKey).value || {},
        });
    });

    return snapshot;
}

function StateChip({label, value, tone = "neutral"}) {
    return (
        <span className={`forge-dashboard-chip forge-dashboard-chip--${tone}`}>
            <strong>{label}</strong>
            {value}
        </span>
    );
}

function DashboardStateStrip({filters = {}, selection = {}}) {
    const chips = [];
    Object.entries(filters || {}).forEach(([key, value]) => {
        if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
            return;
        }
        chips.push(<StateChip key={`filter-${key}`} label="Filter" value={`${key}=${formatStateValue(value)}`} tone="active"/>);
    });

    if (selection?.entityKey != null && selection.entityKey !== "") {
        const value = selection.dimension ? `${selection.dimension}=${selection.entityKey}` : selection.entityKey;
        chips.push(<StateChip key="selection" label="Selection" value={value} tone="success"/>);
    }

    if (chips.length === 0) {
        chips.push(<StateChip key="ready" label="State" value="No active filters" tone="neutral"/>);
    }

    return (
        <div className="forge-dashboard-state-strip">
            <div className="forge-dashboard-state-chips">{chips}</div>
        </div>
    );
}

function ReportToggle({id, label, checked, onChange}) {
    return (
        <button
            type="button"
            className="forge-report-check"
            aria-pressed={checked}
            onClick={() => onChange(id)}
        >
            <span className={checked ? "forge-report-check-box is-on" : "forge-report-check-box"}/>
            {label}
        </button>
    );
}

function classifyBlocks(containers = []) {
    const visible = (containers || []).filter(Boolean);
    return {
        narrative: visible.filter((block) => block.kind === "dashboard.report"),
        kpis: visible.filter((block) => [
            "dashboard.summary",
            "dashboard.compare",
            "dashboard.kpiTable",
            "dashboard.badges",
        ].includes(block.kind)),
        charts: visible.filter((block) => [
            "dashboard.timeline",
            "dashboard.composition",
            "dashboard.dimensions",
            "dashboard.detail",
        ].includes(block.kind)),
        tables: visible.filter((block) => [
            "dashboard.table",
            "dashboard.status",
            "dashboard.messages",
        ].includes(block.kind)),
        audit: visible.filter((block) => block.kind === "dashboard.feed"),
    };
}

function ReportBlockList({blocks, renderBlock, emptyText}) {
    if (!blocks.length) {
        return <div className="forge-report-empty">{emptyText}</div>;
    }
    return blocks.map((block) => (
        <div className="forge-report-block" key={`report-${block.id || block.kind}`}>
            {renderBlock(block)}
        </div>
    ));
}

function DashboardReportMode({container, context, renderBlock, include, onIncludeChange}) {
    const groups = useMemo(() => classifyBlocks(container.containers || []), [container.containers]);
    const generatedAt = container.report?.generatedAt || new Date().toLocaleString();
    const exportFormats = container.report?.export || ["html"];

    return (
        <div className="forge-report-shell">
            <aside className="forge-report-nav">
                <h2>Report Options</h2>
                <div className="forge-report-toc" aria-label="Report sections">
                    <span className="forge-report-toc-item is-active"><b>1</b>Executive Summary</span>
                    <span className="forge-report-toc-item"><b>2</b>Key Metrics</span>
                    <span className="forge-report-toc-item"><b>3</b>Charts</span>
                    <span className="forge-report-toc-item"><b>4</b>Tables</span>
                    <span className="forge-report-toc-item"><b>5</b>Compatibility</span>
                </div>
                <div className="forge-report-nav-section">
                    <h3>Included Content</h3>
                    <ReportToggle id="narrative" label="Narrative summary" checked={include.narrative} onChange={onIncludeChange}/>
                    <ReportToggle id="kpis" label="KPI snapshot" checked={include.kpis} onChange={onIncludeChange}/>
                    <ReportToggle id="charts" label="Charts" checked={include.charts} onChange={onIncludeChange}/>
                    <ReportToggle id="tables" label="Tables" checked={include.tables} onChange={onIncludeChange}/>
                    <ReportToggle id="audit" label="Raw audit events" checked={include.audit} onChange={onIncludeChange}/>
                </div>
                <div className="forge-report-nav-section">
                    <h3>Output</h3>
                    <div className="forge-report-export-list">
                        {["html", "pdf", "markdown"].map((format) => (
                            <div key={format} className="forge-report-export-row">
                                <strong>{format.toUpperCase()}</strong>
                                <span>{exportFormats.includes(format) ? "ready" : "future"}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="forge-report-nav-section">
                    <h3>Compatibility</h3>
                    <pre>{`report:\n  enabled: true\n  mode: ${container.report?.mode || "document"}\n  include: [summary, charts, tables]\n  export: [${exportFormats.join(", ")}]`}</pre>
                </div>
            </aside>
            <main className="forge-report-page">
                <header className="forge-report-header">
                    <div>
                        <h2>{container.report?.title || container.title || "Dashboard Report"}</h2>
                        <p>{container.report?.subtitle || container.subtitle || "Generated from the same dashboard blocks used in the interactive dashboard view."}</p>
                    </div>
                    <dl>
                        <div><dt>Generated</dt><dd>{generatedAt}</dd></div>
                        <div><dt>Mode</dt><dd>{container.report?.mode || "document"}</dd></div>
                        <div><dt>Dashboard</dt><dd>{context?.dashboardKey || container.id || "dashboard"}</dd></div>
                    </dl>
                </header>

                {include.narrative ? (
                    <section className="forge-report-section">
                        <h3>Executive Summary</h3>
                        <ReportBlockList blocks={groups.narrative} renderBlock={renderBlock} emptyText="No report narrative block is configured."/>
                    </section>
                ) : null}

                {include.kpis ? (
                    <section className="forge-report-section">
                        <h3>Key Metrics</h3>
                        <div className="forge-report-section-grid">
                            <ReportBlockList blocks={groups.kpis} renderBlock={renderBlock} emptyText="No KPI blocks are configured."/>
                        </div>
                    </section>
                ) : null}

                {include.charts ? (
                    <section className="forge-report-section">
                        <h3>Chart Evidence</h3>
                        <div className="forge-report-section-grid">
                            <ReportBlockList blocks={groups.charts} renderBlock={renderBlock} emptyText="No chart blocks are configured."/>
                        </div>
                    </section>
                ) : null}

                {include.tables ? (
                    <section className="forge-report-section">
                        <h3>Tables and Actions</h3>
                        <div className="forge-report-section-grid">
                            <ReportBlockList blocks={groups.tables} renderBlock={renderBlock} emptyText="No table/action blocks are configured."/>
                        </div>
                    </section>
                ) : null}

                {include.audit ? (
                    <section className="forge-report-section">
                        <h3>Audit Trail</h3>
                        <div className="forge-report-section-grid">
                            <ReportBlockList blocks={groups.audit} renderBlock={renderBlock} emptyText="No audit blocks are configured."/>
                        </div>
                    </section>
                ) : null}

                <section className="forge-report-section forge-report-compat">
                    <h3>Compatibility Contract</h3>
                    <p>Existing dashboards continue to render as interactive dashboards. Report mode only changes presentation and export composition when report configuration is present.</p>
                </section>
            </main>
        </div>
    );
}

export default function DashboardSurface({container, context, toolbar = null, children, renderBlock}) {
    const modes = useMemo(() => normalizeModes(container), [container]);
    const [mode, setMode] = useState(() => {
        const initial = normalizeMode(container.report?.defaultMode || container.defaultMode || modes[0]);
        return modes.includes(initial) ? initial : modes[0];
    });
    const [include, setInclude] = useState(() => ({
        ...DEFAULT_REPORT_INCLUDE,
        ...(container.report?.includeState || {}),
    }));
    const {filters, selection} = useDashboardStateSnapshot(context?.dashboardKey);
    const activeMode = modes.includes(mode) ? mode : modes[0];

    const toggleInclude = (id) => {
        setInclude((prev) => ({...prev, [id]: !prev[id]}));
    };

    return (
        <section className="forge-dashboard-shell" data-dashboard-mode={activeMode}>
            <header className="forge-dashboard-topbar">
                <div className="forge-dashboard-title">
                    <h1>{container.title || "Dashboard"}</h1>
                    {container.subtitle ? <p>{container.subtitle}</p> : null}
                </div>
                <div className="forge-dashboard-actions">
                    {modes.length > 1 ? (
                        <div className="forge-dashboard-mode-toggle" role="tablist" aria-label="Dashboard mode">
                            {modes.map((candidate) => (
                                <button
                                    key={candidate}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeMode === candidate}
                                    className={activeMode === candidate ? "is-active" : ""}
                                    onClick={() => setMode(candidate)}
                                >
                                    {MODE_LABELS[candidate] || candidate}
                                </button>
                            ))}
                        </div>
                    ) : null}
                    {toolbar ? <div className="forge-dashboard-toolbar">{toolbar}</div> : null}
                </div>
            </header>

            {activeMode !== "report" ? <DashboardStateStrip filters={filters} selection={selection}/> : null}

            {activeMode === "report" ? (
                <DashboardReportMode
                    container={container}
                    context={context}
                    renderBlock={renderBlock}
                    include={include}
                    onIncludeChange={toggleInclude}
                />
            ) : (
                <div className={activeMode === "analyze" ? "forge-dashboard-content is-analyze" : "forge-dashboard-content"}>
                    {children}
                </div>
            )}
        </section>
    );
}
