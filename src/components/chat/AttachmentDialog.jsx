import React, { useEffect, useState } from 'react';
import { Dialog, DialogBody, DialogFooter, FileInput, ProgressBar } from '@blueprintjs/core';
import Button from '../Button.jsx';
import Icon from '../Icon.jsx';
import Typography, {typographyProps} from '../Typography.jsx';
import useFileDrop from './useFileDrop.js';
import './AttachmentDialog.css';
import { UploadStatus } from '../../hooks/useUpload.js';

export default function AttachmentDialog({ isOpen, onClose, onSelect, uploads = [] }) {
  const [localFiles, setLocalFiles] = useState([]);

  // Reset selection every time dialog opens to avoid stale state
  useEffect(() => {
    if (isOpen) setLocalFiles([]);
  }, [isOpen]);

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

  const addFiles = (files) => {
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
  };

  const {fileDrag, dropHandlers} = useFileDrop(addFiles, isOpen);

  const handleInput = (e) => {
    addFiles(e.target.files);
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

  return (
    <Dialog isOpen={isOpen} onClose={onClose}
      className="forge-foundation-overlay forge-attachment-dialog"
      title={<Typography typeRole="section">Attach files</Typography>}
      onOpened={node => node.querySelector('input[type="file"]')?.focus()}>
      <DialogBody {...dropHandlers} className={fileDrag ? 'is-file-dragging' : undefined}>
        <FileInput fill {...typographyProps('body')}
          inputProps={{ multiple: true, 'aria-label': 'Choose files' }}
          hasSelection={localFiles.length > 0}
          buttonText="Browse files"
          text={<>
            <Icon name="lucide:paperclip"/>
            <Typography typeRole="body" aria-live="polite">{fileDrag ? 'Release to add files' : localFiles.length ? 'Drop more files here' : 'Drop files here'}</Typography>
          </>}
          onInputChange={handleInput}
        />
        {localFiles.length > 0 && <>
          <Typography as="p" typeRole="metadata" className="forge-attachment-dialog__count" aria-live="polite">{localFiles.length} {localFiles.length === 1 ? 'file' : 'files'} selected</Typography>
          <ul className="forge-attachment-dialog__files" aria-label="Selected files">
            {localFiles.map((f, i) => {
              const u = uploads.find(x => x.name === f.name && x.size === f.size);
              return (
                <li key={i} className="forge-attachment-dialog__file">
                  <Typography typeRole="body" className="forge-attachment-dialog__name">{f.name}</Typography>
                  <Typography typeRole="metadata" className="forge-attachment-dialog__size" aria-label={`Size: ${formatBytes(f.size)}`}>{formatBytes(f.size)}</Typography>
                  <Button variant="ghost" size="compact" icon="lucide:x" hideLabel onClick={() => handleRemove(i)} aria-label={`Remove ${f.name}`} />
                  {u && <div className="forge-attachment-dialog__progress" data-upload-status={u.status}>
                    <ProgressBar value={u.progress || 0} animate stripes intent={u.status === UploadStatus.ERROR ? 'danger' : undefined}
                      role="progressbar" aria-label={`Upload ${f.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((u.progress || 0) * 100)} />
                    <Typography typeRole="metadata" role={u.status === UploadStatus.ERROR ? 'alert' : 'status'}>
                      {u.status === UploadStatus.ERROR ? u.error?.message || 'Upload failed'
                        : u.status === UploadStatus.DONE ? 'Uploaded'
                        : u.status === UploadStatus.ABORTED ? 'Upload canceled'
                        : `${Math.round((u.progress || 0) * 100)}%`}
                    </Typography>
                  </div>}
                </li>
              );
            })}
          </ul>
        </>}
      </DialogBody>
      <DialogFooter actions={<>
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button variant="primary" onClick={handleUpload} disabled={localFiles.length === 0}>Upload</Button>
      </>} />
    </Dialog>
  );
}
