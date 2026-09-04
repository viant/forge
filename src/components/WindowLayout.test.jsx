import { describe, expect, it } from 'vitest';

import { resolveWindowLayoutContext, resolveWindowLayoutOverflow } from './WindowLayout.jsx';

describe('resolveWindowLayoutContext', () => {
  it('promotes a raw window context to its default datasource context', () => {
    const scoped = { identity: { dataSourceRef: 'perf' }, signals: { message: {} } };
    const windowContext = {
      identity: { dataSourceRef: 'perf' },
      Context(ref) {
        expect(ref).toBe('perf');
        return scoped;
      },
    };

    expect(resolveWindowLayoutContext(windowContext)).toBe(scoped);
  });

  it('preserves an already-scoped datasource context', () => {
    const scoped = { identity: { dataSourceRef: 'perf' }, signals: { message: {} } };
    expect(resolveWindowLayoutContext(scoped)).toBe(scoped);
  });

  it('allows metadata to opt a fill-parent window into root scrolling', () => {
    expect(resolveWindowLayoutOverflow({scrollMode: 'self'}, true)).toBe('auto');
    expect(resolveWindowLayoutOverflow({containers: [{id: 'summary'}, {id: 'orders'}]}, true)).toBe('auto');
    expect(resolveWindowLayoutOverflow({dashboard: {}, containers: [{id: 'a'}, {id: 'b'}]}, true)).toBe('hidden');
    expect(resolveWindowLayoutOverflow({}, true)).toBe('hidden');
    expect(resolveWindowLayoutOverflow({scrollMode: 'self'}, false)).toBe('visible');
  });
});
