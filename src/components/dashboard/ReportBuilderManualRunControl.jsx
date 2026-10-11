import React from "react";
import { Button } from "@blueprintjs/core";

// Compact manual execution uses the same Run callback and readiness guard as
// the existing desktop toolbar. Frozen/blocked report frames remain read-only.
export default function ReportBuilderManualRunControl({manualRequired, canRun, busy, readOnly, onRun}) {
    if (!manualRequired || readOnly) return null;
    return <Button small intent="primary" icon="play" disabled={!canRun || busy}
        loading={busy} onClick={onRun}>Run</Button>;
}
