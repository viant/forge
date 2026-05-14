import { describe, expect, it } from 'vitest';

import { mergeWindowFormValues } from './dataSource.js';

describe('mergeWindowFormValues', () => {
  it('preserves seeded window parameters while applying defaults', () => {
    expect(
      mergeWindowFormValues(
        { AdOrderId: [2637048], periodView: 'today' },
        { periodView: '30d', granularity: 'day' },
      ),
    ).toEqual({
      AdOrderId: [2637048],
      periodView: '30d',
      granularity: 'day',
    });
  });

  it('accepts empty existing state', () => {
    expect(mergeWindowFormValues(null, { granularity: 'hour' })).toEqual({
      granularity: 'hour',
    });
  });
});
