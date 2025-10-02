import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDataSourceState } from "../hooks/useDataSourceState.js";
import './Terminal.css';
import { Dialog, DialogBody, Icon, Button } from '@blueprintjs/core';

/**
 * Terminal – scrollable render of shell command entries.
 *
 * Props
 *  - context: Forge context to bind a DataSource (optional)
 *  - entries: Array<{ input: string, output?: string, stderr?: string, stderro?: string, code?: number, status?: number }>
 *  - height: CSS size (e.g., '320px', '50vh') – default '320px'
 *  - autoScroll: boolean – auto scroll to bottom on update (default true)
 *  - prompt: string – displayed before input (default '$')
 *  - showDividers: boolean – separate entries with lines (default false)
 *  - className: additional class names for outer container
 *  - truncateLongOutput: boolean – truncate long outputs (default false)
 *  - truncateLength: number – length threshold for truncation (default 150)
 */
const Terminal = ({
  context,
  entries,
  height = '320px',
  autoScroll = true,
  prompt = '$',
  showDividers = false,
  className = '',
  truncateLongOutput = true,
  truncateLength = 150,
}) => {
  const scrollRef = useRef(null);
  const [expanded, setExpanded] = useState(null); // { title, content }
  const externalEntriesProvided = typeof entries !== 'undefined';

  // When context is provided and entries are not overridden, subscribe to DS
  let dsCollection = [];
  if (context && !externalEntriesProvided) {
    try {
      const { collection } = useDataSourceState(context);
      dsCollection = collection || [];
    } catch (_) {
      // ignore – context absent or invalid
    }
  }

  // Resolve effective entries
  const effectiveEntries = externalEntriesProvided ? (entries || []) : dsCollection;

  // Default fetch when bound to DataSource and empty
  useEffect(() => {
    if (!context || externalEntriesProvided) return;
    const handlers = context?.handlers?.dataSource;
    const hasData = Array.isArray(handlers?.getCollection?.()) && handlers.getCollection().length > 0;
    if (!hasData) {
      handlers?.fetchCollection?.();
    }
    // run once on mount for DS-mode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalized = useMemo(() => {
    return (effectiveEntries || []).map((e, idx) => {
      const stderr = e.stderr ?? e.stderro ?? '';
      const status = typeof e.code === 'number' ? e.code : (typeof e.status === 'number' ? e.status : 0);
      const isError = !!stderr || (status !== 0);
      return { key: idx, input: e.input || '', output: e.output || '', stderr, status, isError };
    });
  }, [effectiveEntries]);

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [normalized, autoScroll]);

  const renderMaybeTruncated = (text, label) => {
    if (!truncateLongOutput || !text || text.length <= truncateLength) {
      return <pre className="term-output">{text}</pre>;
    }
    const short = text.slice(0, truncateLength) + '…';
    return (
      <div className="term-block-with-expand">
        <pre className="term-output">{short}</pre>
        <Icon
          icon="maximize"
          size={12}
          onClick={() => setExpanded({ title: label, content: text })}
          className="term-expand"
          title="Show full content"
        />
      </div>
    );
  };

  return (
    <div
      ref={scrollRef}
      className={`terminal-container ${className}`}
      style={{ height }}
      data-testid="terminal"
    >
      <div className="terminal-inner">
        {normalized.map((e, i) => (
          <div key={e.key} className={`term-entry${e.isError ? ' error' : ''}`}>
            <div className="term-command">
              <span className="term-prompt">{prompt}</span>{' '}
              <span className="term-input-text">{e.input}</span>
              <span className={`term-status ${e.isError ? 'err' : 'ok'}`}>
                {e.isError ? `exit ${e.status}` : 'ok'}
              </span>
            </div>
            {e.output ? (
              truncateLongOutput
                ? renderMaybeTruncated(e.output, 'Command Output')
                : <pre className="term-output">{e.output}</pre>
            ) : null}
            {e.stderr ? (
              !truncateLongOutput || e.stderr.length <= truncateLength ? (
                <pre className="term-stderr">{e.stderr}</pre>
              ) : (
                <div className="term-block-with-expand">
                  <pre className="term-stderr">{e.stderr.slice(0, truncateLength) + '…'}</pre>
                  <Icon
                    icon="maximize"
                    size={12}
                    onClick={() => setExpanded({ title: 'Command Error', content: e.stderr })}
                    className="term-expand"
                    title="Show full error"
                  />
                </div>
              )
            ) : null}
            {showDividers && i < normalized.length - 1 ? (
              <hr className="term-divider" />
            ) : null}
          </div>
        ))}
      </div>

      {expanded ? (
        <Dialog
          isOpen={!!expanded}
          onClose={() => setExpanded(null)}
          title={expanded.title || 'Output'}
          isCloseButtonShown={true}
          style={{ width: '60vw' }}
        >
          <DialogBody>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <Button
                icon="clipboard"
                small
                minimal
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(expanded.content || '');
                  } catch (e) {
                    console.warn('Copy failed', e);
                  }
                }}
                title="Copy full content"
              />
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '70vh', overflowY: 'auto' }}>
              {expanded.content}
            </pre>
          </DialogBody>
        </Dialog>
      ) : null}
    </div>
  );
};

export default Terminal;
