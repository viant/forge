import { describe, expect, it } from 'vitest';

import {
  AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
  isNearBottom,
  shouldAutoScrollFeed,
} from './MessageFeed.jsx';

describe('MessageFeed auto-scroll helpers', () => {
  it('treats the feed as near-bottom when the remaining gap is within threshold', () => {
    expect(isNearBottom({
      scrollHeight: 1200,
      scrollTop: 752,
      clientHeight: 400,
    }, AUTO_SCROLL_BOTTOM_THRESHOLD_PX)).toBe(true);
  });

  it('treats the feed as not near-bottom when the user has scrolled well above the end', () => {
    expect(isNearBottom({
      scrollHeight: 1200,
      scrollTop: 640,
      clientHeight: 400,
    }, AUTO_SCROLL_BOTTOM_THRESHOLD_PX)).toBe(false);
  });

  it('auto-scrolls only while the user is still following the bottom', () => {
    expect(shouldAutoScrollFeed({ isFollowingBottom: true, hasMessages: true })).toBe(true);
    expect(shouldAutoScrollFeed({ isFollowingBottom: false, hasMessages: true })).toBe(false);
    expect(shouldAutoScrollFeed({ isFollowingBottom: true, hasMessages: false })).toBe(false);
  });
});
