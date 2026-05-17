import { describe, expect, it } from 'vitest';

import { resolveWindowLayoutContext } from './WindowLayout.jsx';

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
});
