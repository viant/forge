import assert from 'node:assert/strict';

import { resolveMetadataForTarget } from './metadataResolver.js';

const metadata = {
    namespace: 'Test',
    dataSource: {
        shared: { service: { endpoint: 'app', uri: 'shared' } },
        mobileOnly: {
            target: ['android', 'ios'],
            service: { endpoint: 'app', uri: 'mobile' }
        }
    },
    view: {
        content: {
            containers: [
                { id: 'shared', title: 'Shared' },
                { id: 'androidOnly', target: 'android', title: 'Android' },
                {
                    id: 'chat',
                    title: 'Chat',
                    chat: { showMic: false, showUpload: false },
                    targetOverrides: {
                        web: {
                            chat: { showUpload: true }
                        },
                        android: {
                            chat: { showMic: true }
                        }
                    }
                }
            ]
        }
    }
};

const resolvedWeb = resolveMetadataForTarget(metadata, {
    platform: 'web',
    formFactor: 'desktop',
    capabilities: ['markdown', 'chart']
});

assert.equal(resolvedWeb.namespace, 'Test');
assert.equal(resolvedWeb.dataSource.shared.service.uri, 'shared');
assert.equal(typeof resolvedWeb.dataSource.mobileOnly, 'undefined');
assert.equal(resolvedWeb.view.content.containers.length, 2);
assert.equal(resolvedWeb.view.content.containers[0].id, 'shared');
assert.equal(resolvedWeb.view.content.containers[1].id, 'chat');
assert.equal(resolvedWeb.view.content.containers[1].chat.showMic, false);
assert.equal(resolvedWeb.view.content.containers[1].chat.showUpload, true);

const resolvedAndroid = resolveMetadataForTarget(metadata, {
    platform: 'android',
    formFactor: 'phone',
    capabilities: ['markdown', 'chart', 'upload']
});

assert.equal(resolvedAndroid.dataSource.mobileOnly.service.uri, 'mobile');
assert.equal(resolvedAndroid.view.content.containers.length, 3);
assert.equal(resolvedAndroid.view.content.containers[1].id, 'androidOnly');
assert.equal(resolvedAndroid.view.content.containers[2].chat.showMic, true);
assert.equal(resolvedAndroid.view.content.containers[2].chat.showUpload, false);
