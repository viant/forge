import { describe, expect, it } from 'vitest';

import { formatTimestamp } from './Chart.jsx';

describe('formatTimestamp', () => {
  it('returns empty text for blank timestamps and preserves invalid literal values', () => {
    expect(formatTimestamp('', 'MM/dd')).toBe('');
    expect(formatTimestamp(null, 'MM/dd')).toBe('');
    expect(formatTimestamp('not-a-date', 'MM/dd')).toBe('not-a-date');
  });

  it('formats valid timestamps', () => {
    expect(formatTimestamp('2026-05-14T12:00:00Z', 'MM/dd')).toBe('05/14');
  });
});
