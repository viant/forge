import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'src/components/ThemeBoundary.portal.test.jsx',
      'src/components/MediaPreviewPopover.render.test.jsx',
      'src/runtime/optionsFetch.render.test.jsx',
      'src/components/table/Basic.timeZoneBinding.render.test.jsx',
      'src/components/table/FilterDialog.visibility.test.jsx',
      'src/packs/blueprint/dateRangePresetDraft.render.test.jsx',
      'src/packs/blueprint/fileClear.render.test.jsx',
      'src/packs/blueprint/fileMultiple.render.test.jsx',
      'src/packs/blueprint/blur.render.test.jsx',
      'src/components/primitives/ArrayFields.render.test.jsx',
      'src/components/optionsFetchOwnership.test.jsx',
      'src/components/WindowContent.fetchQueue.test.jsx',
      'src/components/WindowContent.lazyOptions.render.test.jsx',
    ],
    setupFiles: ['./scripts/react-runtime-test-setup.js'],
    maxWorkers: 2,
    server: {deps: {inline: [/@preact\/signals/, /@phosphor-icons\/react/]}},
  },
});
