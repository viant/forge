import React, { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, DialogBody, DialogFooter, InputGroup } from '@blueprintjs/core';

const normalizeString = (value) => String(value || '').trim();

export default function BundlesDialog({
  isOpen,
  onClose,
  bundles = [],
  selectedBundleIDs = [],
  onChange,
  disabled = false,
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  const selected = useMemo(() => new Set((Array.isArray(selectedBundleIDs) ? selectedBundleIDs : []).map(normalizeString).filter(Boolean)), [selectedBundleIDs]);

  const filtered = useMemo(() => {
    const q = normalizeString(query).toLowerCase();
    const all = Array.isArray(bundles) ? bundles : [];
    if (!q) return all;
    return all.filter(b => {
      const id = normalizeString(b?.id).toLowerCase();
      const label = normalizeString(b?.label).toLowerCase();
      return id.includes(q) || label.includes(q);
    });
  }, [bundles, query]);

  const toggle = (bundleID) => {
    const id = normalizeString(bundleID);
    if (!id) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange?.(Array.from(next));
  };

  return (
    <Dialog isOpen={!!isOpen} onClose={onClose} title="Toolsets" style={{ width: 980, maxWidth: '95vw' }}>
      <DialogBody>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
          <InputGroup
            leftIcon="search"
            placeholder="Search toolsets…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="bundle-dialog-grid" data-testid="bundle-dialog-grid">
          {filtered.map((b) => {
            const id = normalizeString(b?.id);
            if (!id) return null;
            const label = normalizeString(b?.label) || id;
            const iconText = normalizeString(b?.iconText) || label.charAt(0).toUpperCase();
            const toolCount = Array.isArray(b?.tools) ? b.tools.length : 0;
            const isSelected = selected.has(id);
            return (
              <div
                key={id}
                className={`bundle-tile ${isSelected ? 'selected' : ''}`}
                data-testid={`bundle-tile-${id}`}
              >
                <div className="bundle-tile-left">
                  <div className="bundle-tile-icon" aria-hidden="true">{iconText}</div>
                  <div className="bundle-tile-text">
                    <div className="bundle-tile-title">{label}</div>
                    <div className="bundle-tile-sub">{toolCount} tool{toolCount === 1 ? '' : 's'}</div>
                  </div>
                </div>
                <Button
                  minimal
                  small
                  disabled={disabled}
                  icon={isSelected ? 'tick' : 'plus'}
                  intent={isSelected ? 'success' : undefined}
                  aria-label={isSelected ? `Remove ${label}` : `Add ${label}`}
                  onClick={() => toggle(id)}
                />
              </div>
            );
          })}
        </div>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button onClick={onClose} minimal>Close</Button>
          </>
        }
      />
    </Dialog>
  );
}
