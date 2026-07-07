import React, { useEffect, useRef, useState } from 'react';

// Lazy-load EasyMDE from CDN at runtime to avoid bundling dependency.
// Falls back to a basic <textarea> if loading fails.
const EASYMDE_JS = 'https://unpkg.com/easymde/dist/easymde.min.js';
const EASYMDE_CSS = 'https://unpkg.com/easymde/dist/easymde.min.css';

function buildTextToolbar(EasyMDE, toolbar = []) {
  const actionMap = {
    bold: EasyMDE.toggleBold,
    italic: EasyMDE.toggleItalic,
    heading: EasyMDE.toggleHeadingSmaller,
    quote: EasyMDE.toggleBlockquote,
    'unordered-list': EasyMDE.toggleUnorderedList,
    'ordered-list': EasyMDE.toggleOrderedList,
    link: EasyMDE.drawLink,
    preview: EasyMDE.togglePreview,
  };
  const textMap = {
    bold: 'B',
    italic: 'I',
    heading: 'H',
    quote: '"',
    'unordered-list': '• List',
    'ordered-list': '1. List',
    link: 'Link',
    preview: 'Preview',
  };
  const titleMap = {
    bold: 'Bold',
    italic: 'Italic',
    heading: 'Heading',
    quote: 'Quote',
    'unordered-list': 'Bulleted list',
    'ordered-list': 'Numbered list',
    link: 'Insert link',
    preview: 'Toggle preview',
  };
  return (Array.isArray(toolbar) ? toolbar : []).map((item) => {
    if (item === '|') {
      return '|';
    }
    if (typeof item !== 'string' || !actionMap[item]) {
      return item;
    }
    return {
      name: item,
      action: actionMap[item],
      className: '',
      title: titleMap[item] || item,
      text: textMap[item] || item,
    };
  });
}

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
  const useLocalTextToolbar = options?.textToolbar === true;

  function updateSelection(nextValue, selectionStart, selectionEnd) {
    onChange?.(nextValue);
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
        textareaRef.current.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  }

  function applyToolbarAction(action = '') {
    const textarea = textareaRef.current;
    const currentValue = String(value ?? '');
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart ?? currentValue.length;
    const end = textarea.selectionEnd ?? currentValue.length;
    const selectedText = currentValue.slice(start, end);
    const before = currentValue.slice(0, start);
    const after = currentValue.slice(end);
    const withLinePrefix = (prefix) => {
      const target = selectedText || 'List item';
      const lines = target.split('\n');
      const nextBlock = lines.map((line, index) => `${prefix(index)}${line}`).join('\n');
      const nextValue = `${before}${nextBlock}${after}`;
      updateSelection(nextValue, start, start + nextBlock.length);
    };
    if (action === 'bold') {
      const insertion = `**${selectedText || 'Bold text'}**`;
      const nextValue = `${before}${insertion}${after}`;
      const innerStart = start + 2;
      const innerEnd = innerStart + (selectedText || 'Bold text').length;
      updateSelection(nextValue, innerStart, innerEnd);
      return;
    }
    if (action === 'italic') {
      const insertion = `*${selectedText || 'Italic text'}*`;
      const nextValue = `${before}${insertion}${after}`;
      const innerStart = start + 1;
      const innerEnd = innerStart + (selectedText || 'Italic text').length;
      updateSelection(nextValue, innerStart, innerEnd);
      return;
    }
    if (action === 'heading') {
      const insertion = `## ${selectedText || 'Section heading'}`;
      const nextValue = `${before}${insertion}${after}`;
      updateSelection(nextValue, start + 3, start + insertion.length);
      return;
    }
    if (action === 'quote') {
      withLinePrefix(() => '> ');
      return;
    }
    if (action === 'unordered-list') {
      withLinePrefix(() => '- ');
      return;
    }
    if (action === 'ordered-list') {
      withLinePrefix((index) => `${index + 1}. `);
      return;
    }
    if (action === 'link') {
      const linkText = selectedText || 'Link text';
      const insertion = `[${linkText}](https://example.com)`;
      const nextValue = `${before}${insertion}${after}`;
      updateSelection(nextValue, start + 1, start + 1 + linkText.length);
    }
  }

  // Instantiate EasyMDE on mount
  useEffect(() => {
    if (useLocalTextToolbar) {
      return undefined;
    }
    let disposed = false;
    (async () => {
      try {
        const EasyMDE = await ensureEasyMDE();
        if (disposed || !textareaRef.current || !EasyMDE) return;

        const resolvedOptions = { ...(options || {}) };
        if (resolvedOptions.textToolbar === true) {
          resolvedOptions.toolbar = buildTextToolbar(EasyMDE, resolvedOptions.toolbar);
          delete resolvedOptions.textToolbar;
        }

        const mde = new EasyMDE({
          element: textareaRef.current,
          initialValue: String(value ?? ''),
          autoDownloadFontAwesome: false,
          spellChecker: false,
          status: false,
          ...resolvedOptions,
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
  }, [options, useLocalTextToolbar]);

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
  if (useLocalTextToolbar || loadError) {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { id: 'bold', label: 'B', title: 'Bold' },
            { id: 'italic', label: 'I', title: 'Italic' },
            { id: 'heading', label: 'H', title: 'Heading' },
            { id: 'quote', label: '"', title: 'Quote' },
            { id: 'unordered-list', label: '• List', title: 'Bulleted list' },
            { id: 'ordered-list', label: '1. List', title: 'Numbered list' },
            { id: 'link', label: 'Link', title: 'Insert link' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => applyToolbarAction(item.id)}
              disabled={readOnly || disabled}
              title={item.title}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                background: '#f8fbff',
                color: '#314e69',
                fontWeight: 700,
                fontSize: 12,
                lineHeight: 1,
                padding: '8px 10px',
                cursor: readOnly || disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
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
      </div>
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
