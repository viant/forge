import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import CompactFeedList from './CompactFeedList.jsx';

describe('CompactFeedList', () => {
  it('renders step-like rows from object arrays', () => {
    const html = renderToStaticMarkup(
      React.createElement(CompactFeedList, {
        data: {
          data: {
            output: {
              plan: [
                { step: 'Read recovery.md', status: 'completed' },
                { step: 'Assess clarity', status: 'running' },
              ],
            },
          },
        },
        classNamePrefix: 'test-feed',
      })
    );

    expect(html).toContain('Read recovery.md');
    expect(html).toContain('Assess clarity');
    expect(html).toContain('test-feed-step');
    expect(html).toContain('test-feed-status');
  });

  it('renders scalar/object summaries without requiring a feed-specific schema', () => {
    const html = renderToStaticMarkup(
      React.createElement(CompactFeedList, {
        data: {
          data: {
            output: {
              changes: [
                { path: '/tmp/demo.go', count: 3 },
              ],
            },
          },
        },
        classNamePrefix: 'test-feed',
      })
    );

    expect(html).toContain('/tmp/demo.go');
    expect(html).toContain('3');
  });

  it('renders path-like rows as clickable buttons when onPathActivate is supplied', () => {
    const html = renderToStaticMarkup(
      React.createElement(CompactFeedList, {
        data: {
          data: {
            output: [
              { path: '/tmp/recovery.md' },
              { path: '/tmp/go.mod' },
            ],
          },
        },
        classNamePrefix: 'test-feed',
        onPathActivate: () => {},
      })
    );

    expect(html).toContain('test-feed-pathButton');
    expect(html).toContain('/tmp/recovery.md');
    expect(html).toContain('/tmp/go.mod');
  });
});
