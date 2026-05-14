import React, { useState } from 'react';

const PAGE_SIZE = 10;

function renderStatusIcon(status = '') {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'completed' || normalized === 'done') return '✓';
  if (normalized === 'in_progress' || normalized === 'running') return '▶';
  if (normalized) return '○';
  return '';
}

function statusClassName(prefix = '', status = '') {
  const normalized = String(status || 'pending').trim().toLowerCase() || 'pending';
  return `${prefix}-status status-${normalized}`;
}

function hasRenderableValue(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return String(value).trim() !== '';
}

function flattenDisplayRoot(data = null) {
  if (!data || typeof data !== 'object') return data;
  const root = data?.data || {};
  if (root && typeof root === 'object' && !Array.isArray(root) && root.output && typeof root.output === 'object' && !Array.isArray(root.output)) {
    return root.output;
  }
  return root;
}

function FeedScalar({ value, label, classNamePrefix }) {
  return (
    <div className={`${classNamePrefix}-step`}>
      {label ? <span style={{ fontWeight: 500 }}>{label}: </span> : null}
      <span>{String(value).slice(0, 200)}</span>
    </div>
  );
}

function resolvePathValue(value = {}) {
  if (!value || typeof value !== 'object') return '';
  return String(value.path || value.Path || value.uri || value.URI || '').trim();
}

function FeedObject({ value, depth, classNamePrefix, onPathActivate }) {
  const keys = Object.keys(value || {});
  const statusField = value.status || value.Status;
  const titleField = value.step || value.title || value.name || value.Name
    || value.path || value.Path || value.uri || value.URI;

  if (titleField) {
    const status = String(statusField || '').trim().toLowerCase();
    const icon = renderStatusIcon(status);
    const secondary = value.Matches || value.matches || value.hits || value.size || value.count;
    const pathValue = resolvePathValue(value);
    const clickable = typeof onPathActivate === 'function' && !!pathValue;
    return (
      <div className={`${classNamePrefix}-step`}>
        {icon ? <span className={statusClassName(classNamePrefix, status)}>{icon}</span> : null}
        {clickable ? (
          <button
            type="button"
            className={`${classNamePrefix}-pathButton`}
            onClick={() => onPathActivate(value)}
            title={String(titleField)}
            style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', background: 'none', border: 'none', padding: 0, color: '#2b6cb0', cursor: 'pointer' }}
          >
            {String(titleField)}
          </button>
        ) : (
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {String(titleField)}
          </span>
        )}
        {secondary != null ? <span style={{ color: '#6b7280', fontSize: 11, flexShrink: 0 }}>{secondary}</span> : null}
      </div>
    );
  }

  const arrayKeys = keys.filter((key) => Array.isArray(value[key]) && value[key].length > 0);
  if (arrayKeys.length > 0 && depth < 2) {
    return (
      <>
        {arrayKeys.map((key) => (
          <FeedValue
            key={key}
            value={value[key]}
            depth={depth + 1}
            label={arrayKeys.length > 1 ? key : undefined}
            classNamePrefix={classNamePrefix}
            onPathActivate={onPathActivate}
          />
        ))}
      </>
    );
  }

  return (
    <div className={`${classNamePrefix}-step`}>
      <span style={{ color: '#6b7280', fontSize: 11 }}>
        {keys.slice(0, 8).map((key) => {
          const itemValue = value[key];
          const display = Array.isArray(itemValue)
            ? `${itemValue.length} items`
            : typeof itemValue === 'object'
              ? '{…}'
              : String(itemValue).slice(0, 50);
          return `${key}: ${display}`;
        }).join(' · ')}
      </span>
    </div>
  );
}

function PaginatedList({ items, depth, label, classNamePrefix, onPathActivate }) {
  const [page, setPage] = useState(0);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const needsPagination = total > PAGE_SIZE;
  const start = page * PAGE_SIZE;
  const slice = needsPagination ? items.slice(start, start + PAGE_SIZE) : items;

  return (
    <div>
      {label ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0', marginBottom: 2 }}>
          <span style={{ fontWeight: 600, fontSize: 12, color: '#4a5568' }}>{label} ({total})</span>
          {needsPagination ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}>
              <button className={`${classNamePrefix}-page-btn`} disabled={page <= 0} onClick={() => setPage(page - 1)}>‹</button>
              {page + 1}/{totalPages}
              <button className={`${classNamePrefix}-page-btn`} disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>›</button>
            </span>
          ) : null}
        </div>
      ) : needsPagination ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '2px 0', marginBottom: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}>
            {total} items
            <button className={`${classNamePrefix}-page-btn`} disabled={page <= 0} onClick={() => setPage(page - 1)}>‹</button>
            {page + 1}/{totalPages}
            <button className={`${classNamePrefix}-page-btn`} disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>›</button>
          </span>
        </div>
      ) : null}
      {slice.map((item, index) => (
        <FeedValue
          key={start + index}
          value={item}
          depth={depth + 1}
          classNamePrefix={classNamePrefix}
          onPathActivate={onPathActivate}
        />
      ))}
    </div>
  );
}

function FeedValue({ value, depth = 0, label, classNamePrefix = 'forge-feed-list', onPathActivate }) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return <PaginatedList items={value} depth={depth} label={label} classNamePrefix={classNamePrefix} onPathActivate={onPathActivate} />;
  }
  if (typeof value === 'object') {
    return <FeedObject value={value} depth={depth} classNamePrefix={classNamePrefix} onPathActivate={onPathActivate} />;
  }
  return <FeedScalar value={value} label={label} classNamePrefix={classNamePrefix} />;
}

export default function CompactFeedList({ data = null, classNamePrefix = 'forge-feed-list', onPathActivate = null }) {
  const display = flattenDisplayRoot(data);
  if (!hasRenderableValue(display)) return null;
  return <FeedValue value={display} depth={0} classNamePrefix={classNamePrefix} onPathActivate={onPathActivate} />;
}
