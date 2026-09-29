import React, {useEffect, useState} from 'react';

export default function ReportLoadingProgress({progress, fallback}) {
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        if (!progress?.total) return undefined;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [progress?.total,progress?.startedAt]);
    if (!progress?.total) return fallback;
    const startedAt = Number(progress.startedAt);
    const elapsed = Number.isFinite(startedAt) ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
    const queued = Math.max(0, progress.total - progress.completed - progress.running);
    return <span><span role="status">
        {progress.completed} of {progress.total} data requests completed.
        {' '}{progress.running} running{queued ? `, ${queued} queued` : ''}.
        {progress.failed ? ` ${progress.failed} failed.` : ''}
    </span><span aria-live="off">{' '}Elapsed {elapsed}s.</span>
        {' '}You can use other workspaces while this report runs.
    </span>;
}
