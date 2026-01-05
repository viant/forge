import React, { useEffect, useRef, useState } from 'react';

// Lazy-load EasyMDE from CDN at runtime to avoid bundling dependency.
// Falls back to a basic <textarea> if loading fails.
const EASYMDE_JS = 'https://unpkg.com/easymde/dist/easymde.min.js';
const EASYMDE_CSS = 'https://unpkg.com/easymde/dist/easymde.min.css';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => {
      s.dataset.loaded = 'true';
      resolve();
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function ensureCss(href) {
  const existing = document.querySelector(`link[href="${href}"]`);
  if (existing) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = href;
  document.head.appendChild(l);
}

async function ensureEasyMDE() {
  ensureCss(EASYMDE_CSS);
  if (window.EasyMDE) return window.EasyMDE;
  await loadScript(EASYMDE_JS);
  return window.EasyMDE;
}

export default function MarkdownEditor({
  value = '',
  onChange,
  readOnly,
  disabled,
  className = '',
  style = {},
  options = {},
  ...rest
}) {
  const textareaRef = useRef(null);
  const mdeRef = useRef(null);
  const [loadError, setLoadError] = useState(false);

  // Instantiate EasyMDE on mount
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const EasyMDE = await ensureEasyMDE();
        if (disposed || !textareaRef.current || !EasyMDE) return;

        const mde = new EasyMDE({
          element: textareaRef.current,
          initialValue: String(value ?? ''),
          autoDownloadFontAwesome: false,
          spellChecker: false,
          status: false,
          ...options,
        });

        // Apply readOnly/disabled state
        const ro = !!(readOnly || disabled);
        mde.codemirror.setOption('readOnly', ro);
        if (ro) {
          const bar = mde.editor?.toolbar || mde.gui?.toolbar || mde?.toolbar;
          if (bar && bar.style) bar.style.display = 'none';
        }

        // Wire change events
        mde.codemirror.on('change', () => {
          try {
            const next = mde.value();
            onChange?.(next);
          } catch (e) {
            // no-op
          }
        });

        mdeRef.current = mde;
      } catch (e) {
        console.warn('EasyMDE failed to load, falling back to <textarea>', e);
        setLoadError(true);
      }
    })();
    return () => {
      disposed = true;
      try {
        if (mdeRef.current) {
          mdeRef.current.toTextArea();
          mdeRef.current = null;
        }
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep editor value in sync if external value changes
  useEffect(() => {
    const mde = mdeRef.current;
    if (!mde) return;
    const current = mde.value();
    const next = String(value ?? '');
    if (current !== next) {
      mde.value(next);
    }
  }, [value]);

  // React to readOnly/disabled changes
  useEffect(() => {
    const mde = mdeRef.current;
    if (!mde) return;
    const ro = !!(readOnly || disabled);
    mde.codemirror.setOption('readOnly', ro);
    try {
      const bar = mde.editor?.toolbar || mde.gui?.toolbar || mde?.toolbar;
      if (bar && bar.style) bar.style.display = ro ? 'none' : '';
    } catch {}
  }, [readOnly, disabled]);

  // Fallback <textarea> if EasyMDE not available
  if (loadError) {
    return (
      <textarea
        ref={textareaRef}
        className={className}
        style={style}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        disabled={disabled}
        {...rest}
      />
    );
  }

  // When EasyMDE is loading, render the underlying <textarea> placeholder.
  return (
    <textarea
      ref={textareaRef}
      className={className}
      style={style}
      defaultValue={value ?? ''}
      readOnly={readOnly}
      disabled={disabled}
      {...rest}
    />
  );
}

