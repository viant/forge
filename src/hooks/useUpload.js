import { useRef, useState, useCallback, useEffect } from 'react';
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

export const isUnresolvedUpload = item => [IDLE, UPLOADING, ERROR].includes(item.status);

export default function useUpload(uploadConfig = {}) {
  const { endpoints } = useSetting();
  const url = resolveUploadUrl(uploadConfig, endpoints);
  const [items, setItems] = useState([]);
  const xhrsRef = useRef({});
  const nextId = useRef(0);

  const start = useCallback((files, extraFields = {}) => {
    if (!files || files.length === 0) return;
    const selected = Array.from(files).map(file => ({
      id: `${Date.now()}_${nextId.current++}_${file.name}`,
      file, name: file.name, size: file.size, type: file.type,
      progress: 0, status: IDLE, response: null, error: null,
    }));
    selected.forEach(item => {xhrsRef.current[item.id] = null;});
    setItems(prev => [...prev, ...selected]);

    const send = async () => {
      let fields;
      try {fields = typeof extraFields === 'function' ? await extraFields() : extraFields;}
      catch (error) {
        const active = new Set(selected.filter(item => Object.hasOwn(xhrsRef.current, item.id)).map(item => item.id));
        if (!active.size) return;
        active.forEach(id => {delete xhrsRef.current[id];});
        setItems(prev => prev.map(item => active.has(item.id) ? {...item, status: ERROR, error} : item));
        return;
      }
      selected.forEach(item => {
        if (!Object.hasOwn(xhrsRef.current, item.id)) return;
        try {
          const form = new FormData();
          form.append('file', item.file, item.name);
          form.append('name', item.name);
          if (item.type) form.append('contentType', item.type);
          Object.entries(fields || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null) form.append(key, value);
          });
          const xhr = new XMLHttpRequest();
          xhrsRef.current[item.id] = xhr;
          xhr.upload.onprogress = event => {
            if (xhrsRef.current[item.id] !== xhr || !event.lengthComputable) return;
            setItems(prev => prev.map(current => current.id === item.id ? {...current, progress: event.total ? event.loaded / event.total : 0} : current));
          };
          xhr.onreadystatechange = () => {
            if (xhr.readyState !== 4 || xhrsRef.current[item.id] !== xhr) return;
            delete xhrsRef.current[item.id];
            try {
              if (xhr.status < 200 || xhr.status >= 300) throw new Error(xhr.statusText || 'Upload failed');
              const response = JSON.parse(xhr.responseText || 'null');
              const uri = response?.uri || response?.url || response?.item?.uri;
              if (typeof uri !== 'string' || !uri.trim()) throw new Error('Upload did not return a file');
              setItems(prev => prev.map(current => current.id === item.id ? {...current, progress: 1, status: DONE, response} : current));
            } catch (error) {
              setItems(prev => prev.map(current => current.id === item.id ? {...current, status: ERROR, error} : current));
            }
          };
          xhr.open('POST', url, true);
          setItems(prev => prev.map(current => current.id === item.id ? {...current, status: UPLOADING} : current));
          xhr.send(form);
        } catch (error) {
          delete xhrsRef.current[item.id];
          setItems(prev => prev.map(current => current.id === item.id ? {...current, status: ERROR, error} : current));
        }
      });
    };
    void send();
    return selected.map(item => item.id);
  }, [url]);

  const abort = useCallback(id => {
    const xhr = xhrsRef.current[id];
    delete xhrsRef.current[id];
    xhr?.abort();
    setItems(prev => prev.map(item => item.id === id && item.status !== DONE ? {...item, status: ABORTED} : item));
  }, []);

  const reset = useCallback(() => {
    const active = xhrsRef.current;
    xhrsRef.current = {};
    Object.values(active).forEach(xhr => xhr?.abort());
    setItems([]);
  }, []);

  useEffect(() => () => {
    const active = xhrsRef.current;
    xhrsRef.current = {};
    Object.values(active).forEach(xhr => xhr?.abort());
  }, []);

  return {items, start, abort, reset};
}

export const UploadStatus = {IDLE, UPLOADING, DONE, ERROR, ABORTED};
