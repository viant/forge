import React from 'react';
import { Button, Card, Elevation, ProgressBar, Tag } from '@blueprintjs/core';
import { UploadStatus } from '../../hooks/useUpload.js';

export default function UploadPanel({ uploads = [], onAbort, onClose }) {
  if (!uploads || uploads.length === 0) return null;

  const allDone = uploads.every(u => u.status === UploadStatus.DONE || u.status === UploadStatus.ERROR || u.status === UploadStatus.ABORTED);

  return (
    <Card elevation={Elevation.ONE} className="mt-2">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">Uploading files</div>
        <div className="flex items-center gap-2">
          {onClose && (
            <Button small minimal icon="cross" onClick={onClose} title="Close" />
          )}
        </div>
      </div>

      <div className="space-y-2">
        {uploads.map(u => (
          <div key={u.id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="truncate" title={u.name}>{u.name}</div>
                <div className="text-xs text-gray-500">{Math.round((u.progress || 0) * 100)}%</div>
              </div>
              <ProgressBar animate stripes value={u.progress || 0} intent={u.status === UploadStatus.ERROR ? 'danger' : undefined} />
              <div className="mt-1 text-xs text-gray-500">
                {u.status === UploadStatus.ERROR && (<span className="text-red-600">Upload failed</span>)}
                {u.status === UploadStatus.ABORTED && (<span>Aborted</span>)}
                {u.status === UploadStatus.DONE && (<span>Completed</span>)}
              </div>
            </div>

            {(u.status === UploadStatus.IDLE || u.status === UploadStatus.UPLOADING) && (
              <Button minimal icon="stop" intent="danger" onClick={() => onAbort?.(u.id)} title="Cancel" />
            )}
            {(u.status === UploadStatus.ERROR) && (
              <Tag minimal intent="danger">Error</Tag>
            )}
          </div>
        ))}
      </div>

      {allDone && (
        <div className="mt-2 text-xs text-gray-500">All uploads finished.</div>
      )}
    </Card>
  );
}

