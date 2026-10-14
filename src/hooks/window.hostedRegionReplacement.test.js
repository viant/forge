import assert from 'node:assert/strict';

import {activeWindows, selectedTabId, selectedWindowId} from '../core/store/signals.js';
import {useWindowHandlers} from './window.js';

const originalWindows = activeWindows.peek();
const originalSelectedWindowId = selectedWindowId.peek();
const originalSelectedTabId = selectedTabId.peek();

try {
  const hosted = (windowId, windowKey) => ({
    windowId,
    windowKey,
    windowTitle: windowKey,
    parentKey: 'chat/new',
    conversationId: 'conversation-1',
    presentation: 'hosted',
    region: 'chat.top',
    inTab: true,
    parameters: {},
  });
  activeWindows.value = [
    hosted('report-window', 'report'),
    hosted('campaign-list-window', 'campaigns'),
  ];
  selectedWindowId.value = 'campaign-list-window';
  selectedTabId.value = 'campaign-list-window';

  useWindowHandlers('campaign-list-window').openTarget({
    target: {
      kind: 'window',
      windowKey: 'campaign',
      windowTitle: 'Campaign 563637',
      parameters: {CampaignId: [563637]},
    },
  });

  const windows = activeWindows.peek();
  assert.ok(windows.some((entry) => entry.windowId === 'report-window'), 'unrelated report remains mounted');
  assert.ok(windows.some((entry) => entry.windowKey === 'campaign'), 'campaign detail opens');
  assert.ok(!windows.some((entry) => entry.windowId === 'campaign-list-window'), 'only the source window is replaced');
} finally {
  activeWindows.value = originalWindows;
  selectedWindowId.value = originalSelectedWindowId;
  selectedTabId.value = originalSelectedTabId;
}
