import React from 'react';
import {ProgressBar} from '@blueprintjs/core';
import Button from '../Button.jsx';
import Icon from '../Icon.jsx';
import Typography from '../Typography.jsx';
import {UploadStatus, isUnresolvedUpload} from '../../hooks/useUpload.js';
import './uploadChips.css';

export default function UploadChips({uploads = [], attachments = [], onRemove, onCancel, onRetry, disabled}) {
    const ready = attachments.map((file, index) => ({id: file.uploadId || `attachment-${file.id || file.uri || index}`, name: file.name, status: UploadStatus.DONE, progress: 1, ready: true, index}));
    const readyById = new Map(ready.map(file => [file.id, file]));
    const uploadIds = new Set(uploads.map(upload => upload.id));
    const rows = [...ready.filter(file => !uploadIds.has(file.id)), ...uploads.map(upload => readyById.get(upload.id) || (isUnresolvedUpload(upload) ? upload : null)).filter(Boolean)];
    if (!rows.length) return null;
    return <ul className="forge-upload-chips" data-testid="chat-attachments" aria-label={rows.some(isUnresolvedUpload) ? 'File uploads' : 'Attached files'}>
        {rows.map(upload => {
            const failed = upload.status === UploadStatus.ERROR;
            const progress = upload.progress || 0;
            const status = upload.ready ? 'Ready to send' : failed ? 'Upload failed' : upload.status === UploadStatus.IDLE ? 'Preparing…'
                : progress >= 1 ? 'Finishing upload…' : progress > 0 ? `Uploading ${Math.round(progress * 100)}%` : 'Uploading…';
            return <li key={upload.id} className="forge-upload-chip" data-upload-status={upload.status}>
                <Icon name={failed ? 'lucide:circle-alert' : 'lucide:paperclip'}/>
                <div className="forge-upload-chip__content">
                    <Typography as="span" typeRole="small" className="forge-upload-chip__name">{upload.name}</Typography>
                    <Typography as="span" typeRole="metadata" role={failed ? 'alert' : 'status'}>{status}</Typography>
                    <ProgressBar value={progress > 0 ? progress : undefined} animate={!failed && !upload.ready} stripes={!failed && !upload.ready}
                        aria-hidden={failed || upload.ready || undefined} role={!failed && !upload.ready ? 'progressbar' : undefined} aria-label={`Upload ${upload.name}`} aria-valuetext={status} aria-valuemin={0} aria-valuemax={100}
                        aria-valuenow={progress > 0 ? Math.round(progress * 100) : undefined}/>
                </div>
                {failed && <Button variant="link" size="compact" disabled={disabled || typeof onRetry !== 'function'} onClick={() => onRetry?.(upload)} aria-label={`Retry upload of ${upload.name}`}>Retry</Button>}
                <Button variant="ghost" size="compact" icon="lucide:x" hideLabel disabled={upload.ready && disabled} onClick={() => upload.ready ? onRemove?.(upload.index) : onCancel?.(upload.id)}
                    aria-label={upload.ready ? `Remove ${upload.name}` : failed ? `Remove failed upload ${upload.name}` : `Cancel upload of ${upload.name}`}/>
            </li>;
        })}
    </ul>;
}
