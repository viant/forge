import React, { useMemo } from "react";
import ReportRuntime from "./ReportRuntime.jsx";
import { buildSelectedBlockPreview } from "./reportBuilderBlockPreview.js";

export default function ReportBuilderBlockPreview({ document, reportSpec, reportFill, blockId, draft, invalid = false, locale, unavailableMessage }) {
    const preview = useMemo(() => {
        if (invalid) return null;
        try { return buildSelectedBlockPreview({ document, reportSpec, reportFill, blockId, draft }); }
        catch { return null; }
    }, [document, reportSpec, reportFill, blockId, draft, invalid]);
    return <section className="forge-report-builder__block-preview" aria-label="Selected block preview">
        <strong>Block preview</strong>
        <p className="forge-report-builder__block-preview-hint">Uses the current report results. Draft changes appear here before you apply them.</p>
        {preview ? <ReportRuntime reportSpec={preview.reportSpec} reportFill={preview.reportFill} locale={locale}
            presentationMode="preview" showContextSummary={false} />
            : <p role="status">{invalid ? "Complete the required fields to preview this block." : unavailableMessage || "Run the report to load data for this preview."}</p>}
    </section>;
}
