import { useRef, useState, useCallback } from 'react';
import { useSetting } from '../core';

// Simple status enum
const IDLE = 'idle';
const UPLOADING = 'uploading';
const DONE = 'done';
const ERROR = 'error';
const ABORTED = 'aborted';

// Resolve upload URL from config and global endpoints
function resolveUploadUrl(uploadConfig = {}, endpoints = {}) {
  const { endpoint, uri } = uploadConfig || {};
  if (endpoint && endpoints[endpoint]?.baseURL) {
    const base = endpoints[endpoint].baseURL.replace(/\/+$/, '');
    const path = (uploadConfig.path || 'upload').replace(/^\/+/, '');
    return `${base}/${path}${uri ? `?uri=${encodeURIComponent(uri)}` : ''}`;
  }
  // Fallback absolute URL supplied directly
  if (uploadConfig?.url) return uploadConfig.url;
  return '/upload';
}

export default function useUpload(uploadConfig = {}) {
  const { endpoints } = useSetting();
  const url = resolveUploadUrl(uploadConfig, endpoints);

  const [items, setItems] = useState([]);
  const xhrsRef = useRef({});

  const start = useCallback((files, extraFields = {}) => {
    if (!files || files.length === 0) return;
    const selected = Array.from(files).map((file, idx) => ({
      id: `${Date.now()}_${idx}_${file.name}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      status: IDLE,
      response: null,
      error: null,
    }));
    setItems(prev => [...prev, ...selected]);

    selected.forEach((item) => {
      const form = new FormData();
      // Use single-file field name for simpler server logic
      form.append('file', item.file, item.name);
      Object.entries(extraFields || {}).forEach(([k, v]) => form.append(k, v));

      const xhr = new XMLHttpRequest();
      xhrsRef.current[item.id] = xhr;

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = e.total ? e.loaded / e.total : 0;
        setItems(prev => prev.map(x => x.id === item.id ? { ...x, progress: pct, status: UPLOADING } : x));
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) return;
        const isAbort = xhr.status === 0;
        if (isAbort) {
          setItems(prev => prev.map(x => x.id === item.id ? { ...x, status: ABORTED } : x));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          let resp = null;
          try { resp = JSON.parse(xhr.responseText || 'null'); } catch (_) {}
          setItems(prev => prev.map(x => x.id === item.id ? { ...x, progress: 1, status: DONE, response: resp } : x));
        } else {
          setItems(prev => prev.map(x => x.id === item.id ? { ...x, status: ERROR, error: new Error(xhr.statusText || 'Upload failed') } : x));
        }
        delete xhrsRef.current[item.id];
      };

      xhr.open('POST', url, true);
      xhr.send(form);
    });
    return selected.map(s => s.id);
  }, [url]);

  const abort = useCallback((id) => {
    const xhr = xhrsRef.current[id];
    if (xhr) {
      xhr.abort();
      delete xhrsRef.current[id];
      setItems(prev => prev.map(x => x.id === id ? { ...x, status: ABORTED } : x));
    }
  }, []);

  const reset = useCallback(() => {
    Object.values(xhrsRef.current).forEach((xhr) => xhr.abort());
    xhrsRef.current = {};
    setItems([]);
  }, []);

  return { items, start, abort, reset };
}

export const UploadStatus = { IDLE, UPLOADING, DONE, ERROR, ABORTED };
