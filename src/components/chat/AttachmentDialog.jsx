import React, { useEffect, useState } from 'react';
import { Button, Dialog, DialogBody, DialogFooter, FileInput, ProgressBar } from '@blueprintjs/core';
import { UploadStatus } from '../../hooks/useUpload.js';

export default function AttachmentDialog({ isOpen, onClose, onSelect, uploads = [] }) {
  const [localFiles, setLocalFiles] = useState([]);

  // Reset selection every time dialog opens to avoid stale state
  useEffect(() => {
    if (isOpen) setLocalFiles([]);
  }, [isOpen]);

  const ellipsizeFileName = (name, max = 60) => {
    if (!name || name.length <= max) return name;
    const dot = name.lastIndexOf('.')
    const ext = dot > 0 ? name.slice(dot) : ''
    const base = dot > 0 ? name.slice(0, dot) : name
    const keep = Math.max(5, max - 1 - ext.length) // budget for base, minus ellipsis and ext
    const head = Math.ceil(keep * 0.6)
    const tail = keep - head
    return base.slice(0, head) + '…' + base.slice(-tail) + ext
  };

  const formatBytes = (bytes) => {
    if (bytes == null) return '';
    const thresh = 1024;
    if (bytes < thresh) return `${bytes} B`;
    const units = ['KB','MB','GB','TB'];
    let u = -1;
    let b = bytes;
    do { b /= thresh; ++u; } while (b >= thresh && u < units.length - 1);
    return `${b.toFixed(1)} ${units[u]}`;
  };

  const handleInput = (e) => {
    const { files } = e.target;
    if (!files || files.length === 0) return;
    const picked = Array.from(files);
    // Append to selection with simple de-dup (name+size+mtime)
    setLocalFiles(prev => {
      const seen = new Set(prev.map(f => `${f.name}:${f.size}:${f.lastModified}`));
      const merged = [...prev];
      for (const f of picked) {
        const key = `${f.name}:${f.size}:${f.lastModified}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(f);
        }
      }
      return merged;
    });
    // Reset input so selecting the same file again works if reopened later
    if (e.target) e.target.value = '';
  };

  const handleUpload = () => {
    if (localFiles.length === 0) return;
    onSelect?.(localFiles);
  };

  const handleRemove = (idx) => {
    setLocalFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const anyInProgress = uploads.some(u => u.status === UploadStatus.UPLOADING || u.status === UploadStatus.IDLE);

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Attach files" style={{ width: 840, maxWidth: '95vw' }}>
      <DialogBody>
        <div className="space-y-3">
          <div>
            <FileInput
              inputProps={{ multiple: true }}
              text={localFiles.length ? `${localFiles.length} file(s) selected` : 'Choose files…'}
              onInputChange={handleInput}
            />
          </div>

          {localFiles.length > 0 && (
            <table style={{ width: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '48px' }} />
                <col />
                <col style={{ width: '110px' }} />
                <col style={{ width: '280px' }} />
              </colgroup>
              <thead>
                <tr style={{ color: '#6B7280' /* gray-500 */ }}>
                  <th style={{ padding: '4px 0' }}></th>
                  <th style={{ textAlign: 'left', fontWeight: 600, padding: '4px 0' }}>Name</th>
                  <th style={{ textAlign: 'right', fontWeight: 600, padding: '4px 0' }}>Size</th>
                  <th style={{ textAlign: 'left', fontWeight: 600, padding: '4px 0' }}>Progress</th>
                </tr>
              </thead>
              <tbody>
                {localFiles.map((f, i) => {
                  const u = uploads.find(x => x.name === f.name && x.size === f.size);
                  return (
                    <tr key={i}>
                      <td style={{ padding: '6px 0' }}>
                        <Button minimal small icon="cross" onClick={() => handleRemove(i)} aria-label={`Remove ${f.name}`} />
                      </td>
                      <td style={{ padding: '6px 0' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ellipsizeFileName(f.name, 60)}
                        </div>
                      </td>
                      <td style={{ padding: '6px 0', textAlign: 'right' }}>{formatBytes(f.size)}</td>
                      <td style={{ padding: '6px 0' }}>
                        {u && (
                          <ProgressBar value={u.progress || 0} animate stripes intent={u.status === UploadStatus.ERROR ? 'danger' : undefined} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Users can select multiple files in one pick; no separate 'Add more' */}

          {/* Progress bars are shown inline with the selected files above */}
        </div>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button onClick={onClose} minimal>Close</Button>
            <Button intent="primary" onClick={handleUpload} disabled={localFiles.length === 0}>
              Upload
            </Button>
          </>
        }
      />
    </Dialog>
  );
}
