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

const metadataWithTargetDatasource = {
    dataSource: {
        target: {},
        dialogSource: { selectionMode: 'multi' }
    }
};

const resolvedTargetDatasource = resolveMetadataForTarget(metadataWithTargetDatasource, {
    platform: 'android',
    formFactor: 'phone'
});

assert.ok(resolvedTargetDatasource.dataSource.target);
assert.equal(resolvedTargetDatasource.dataSource.dialogSource.selectionMode, 'multi');

const broadOverrideMetadata = {
    view: {
        content: {
            layout: { kind: 'base' },
            containers: [{ id: 'base' }],
            targetOverrides: {
                mobile: {
                    layout: { kind: 'mobile' },
                    containers: [{ id: 'mobileTabs' }]
                },
                phone: {
                    layout: { density: 'phone' }
                },
                android: {
                    layout: { platform: 'android' }
                },
                'android:phone': {
                    layout: { kind: 'androidPhone' },
                    containers: [{ id: 'androidPhoneTabs' }]
                },
                androidPhone: {
                    layout: { alias: 'androidPhone' }
                },
                iosTablet: {
                    layout: { alias: 'iosTablet' }
                },
                web: {
                    layout: { kind: 'web' },
                    containers: [{ id: 'webGrid' }]
                }
            }
        }
    }
};

const resolvedAndroidPhone = resolveMetadataForTarget(broadOverrideMetadata, {
    platform: 'android',
    formFactor: 'phone'
});

assert.equal(resolvedAndroidPhone.view.content.layout.kind, 'androidPhone');
assert.equal(resolvedAndroidPhone.view.content.layout.density, 'phone');
assert.equal(resolvedAndroidPhone.view.content.layout.platform, 'android');
assert.equal(resolvedAndroidPhone.view.content.layout.alias, 'androidPhone');
assert.equal(resolvedAndroidPhone.view.content.containers.length, 1);
assert.equal(resolvedAndroidPhone.view.content.containers[0].id, 'androidPhoneTabs');
assert.equal(typeof resolvedAndroidPhone.view.content.targetOverrides, 'undefined');

const resolvedIosTablet = resolveMetadataForTarget(broadOverrideMetadata, {
    platform: 'ios',
    formFactor: 'tablet'
});

assert.equal(resolvedIosTablet.view.content.layout.kind, 'mobile');
assert.equal(resolvedIosTablet.view.content.layout.alias, 'iosTablet');
assert.equal(resolvedIosTablet.view.content.containers[0].id, 'mobileTabs');

const resolvedWebWindow = resolveMetadataForTarget(broadOverrideMetadata, {
    platform: 'web',
    formFactor: 'desktop'
});

assert.equal(resolvedWebWindow.view.content.layout.kind, 'web');
assert.equal(resolvedWebWindow.view.content.containers[0].id, 'webGrid');

const mobileOnlyOverrideMetadata = {
    view: {
        content: {
            id: 'builder',
            title: 'Base',
            layout: { mode: 'desktop' },
            targetOverrides: {
                mobile: {
                    title: 'Mobile',
                    layout: { mode: 'mobile' }
                },
                phone: {
                    layout: { density: 'phone' }
                },
                tablet: {
                    layout: { density: 'tablet' }
                },
                'ios:phone': {
                    title: 'iPhone'
                }
            }
        }
    }
};

const resolvedWebDesktopWithoutOverride = resolveMetadataForTarget(mobileOnlyOverrideMetadata, {
    platform: 'web',
    formFactor: 'desktop',
    surface: 'browser'
});

assert.equal(resolvedWebDesktopWithoutOverride.view.content.title, 'Base');
assert.equal(resolvedWebDesktopWithoutOverride.view.content.layout.mode, 'desktop');
assert.equal(typeof resolvedWebDesktopWithoutOverride.view.content.layout.density, 'undefined');
assert.equal(typeof resolvedWebDesktopWithoutOverride.view.content.targetOverrides, 'undefined');

const foldableOverrideMetadata = {
    view: {
        content: {
            layout: { kind: 'base' },
            targetOverrides: {
                mobile: {
                    layout: { kind: 'mobile' }
                },
                foldable: {
                    layout: { density: 'foldable' }
                },
                'mobile:foldable': {
                    layout: { mode: 'hingeAware' }
                }
            }
        }
    }
};

const resolvedFoldable = resolveMetadataForTarget(foldableOverrideMetadata, {
    formFactor: 'foldable'
});

assert.equal(resolvedFoldable.view.content.layout.kind, 'mobile');
assert.equal(resolvedFoldable.view.content.layout.density, 'foldable');
assert.equal(resolvedFoldable.view.content.layout.mode, 'hingeAware');

const normalizedTargetMetadata = {
    view: {
        content: {
            containers: [
                {
                    id: 'normalized',
                    target: {
                        platforms: [' android '],
                        formFactors: [' phone '],
                        capabilities: [' lookup ']
                    }
                },
                {
                    id: 'excluded',
                    target: {
                        excludePlatforms: [' android ']
                    }
                }
            ]
        }
    }
};

const resolvedNormalizedTarget = resolveMetadataForTarget(normalizedTargetMetadata, {
    platform: ' android ',
    formFactor: ' phone ',
    capabilities: [' lookup ']
});

assert.deepEqual(
    resolvedNormalizedTarget.view.content.containers.map((container) => container.id),
    ['normalized']
);

const layeredMobileOverrideMetadata = {
    view: {
        content: {
            id: 'reportBuilder',
            reportBuilder: {
                filterPresentation: 'inline',
                density: 'desktop',
                controls: {
                    placement: 'toolbar',
                    summary: 'full'
                }
            },
            targetOverrides: {
                mobile: {
                    reportBuilder: {
                        filterPresentation: 'drawer-left',
                        density: 'mobile',
                        controls: {
                            summary: 'compact'
                        }
                    }
                },
                phone: {
                    reportBuilder: {
                        density: 'phone'
                    }
                },
                'mobile.phone': {
                    reportBuilder: {
                        controls: {
                            placement: 'bottom-sheet'
                        }
                    }
                },
                ios: {
                    reportBuilder: {
                        platformChrome: 'cupertino'
                    }
                },
                'ios.phone': {
                    reportBuilder: {
                        filterPresentation: 'sheet'
                    }
                },
                'ios:phone': {
                    reportBuilder: {
                        controls: {
                            summary: 'ios-phone'
                        }
                    }
                },
                web: {
                    reportBuilder: {
                        controls: {
                            placement: 'web-toolbar'
                        }
                    }
                }
            }
        }
    }
};

const resolvedIosPhoneLayeredOverride = resolveMetadataForTarget(layeredMobileOverrideMetadata, {
    platform: 'ios',
    formFactor: 'phone'
});

assert.equal(resolvedIosPhoneLayeredOverride.view.content.reportBuilder.filterPresentation, 'sheet');
assert.equal(resolvedIosPhoneLayeredOverride.view.content.reportBuilder.density, 'phone');
assert.equal(resolvedIosPhoneLayeredOverride.view.content.reportBuilder.platformChrome, 'cupertino');
assert.equal(resolvedIosPhoneLayeredOverride.view.content.reportBuilder.controls.placement, 'bottom-sheet');
assert.equal(resolvedIosPhoneLayeredOverride.view.content.reportBuilder.controls.summary, 'ios-phone');
assert.equal(typeof resolvedIosPhoneLayeredOverride.view.content.targetOverrides, 'undefined');

const resolvedWebLayeredOverride = resolveMetadataForTarget(layeredMobileOverrideMetadata, {
    platform: 'web',
    formFactor: 'desktop'
});

assert.equal(resolvedWebLayeredOverride.view.content.reportBuilder.filterPresentation, 'inline');
assert.equal(resolvedWebLayeredOverride.view.content.reportBuilder.density, 'desktop');
assert.equal(resolvedWebLayeredOverride.view.content.reportBuilder.controls.placement, 'web-toolbar');
assert.equal(resolvedWebLayeredOverride.view.content.reportBuilder.controls.summary, 'full');
