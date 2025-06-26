export * from './src/core';
export * from './src/hooks';
export * from './src/components';
export * from './src/actions';
export * from './src/utils';

// Expose runtime registries for external extensions
export * from './src/runtime/widgetRegistry.jsx';
export * from './src/runtime/widgetClassifier.js';
export * from './src/runtime/binding.js';
export * from './src/runtime/wrapperRegistry.js';

// Load widget runtime pack when feature flag is enabled (side-effect import)
// Load blueprint widget pack unconditionally (legacy migration complete)
import './src/packs/blueprint/index.jsx';