import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'src/components/table/basic/Toolbar.crossSource.render.test.jsx',
      'src/components/readerWorkbench/ReaderWorkbenchPanel.render.test.jsx',
      'src/components/ResourceWindow.scope.render.test.jsx',
      'src/packs/blueprint/selectCloseFocus.render.test.jsx',
      'src/components/primitives/ResultPreview.render.test.jsx',
      'src/components/ViewDialog.closeContract.render.test.jsx',
      'src/components/primitives/WorkspaceSummary.render.test.jsx',
      'src/components/primitives/DataStateBoundary.runtime.test.jsx',
      'src/components/ThemeBoundary.portal.test.jsx',
      'src/runtime/optionsFetch.render.test.jsx',
      'src/components/table/Basic.timeZoneBinding.render.test.jsx',
      'src/components/table/FilterDialog.visibility.test.jsx',
      'src/packs/blueprint/dateRangePresetDraft.render.test.jsx',
      'src/components/optionsFetchOwnership.test.jsx',
      'src/components/Editor.formBinding.render.test.jsx',
      'src/components/WindowContent.fetchQueue.test.jsx',
      'src/components/WindowContent.lazyOptions.render.test.jsx',
      'src/components/DataSource.spread.render.test.jsx',
      'src/components/DataSource.aggregateOffset.render.test.jsx',
      'src/components/primitives/EditableCollection.readiness.render.test.jsx',
      'src/components/primitives/StatusWorkflow.switch.render.test.jsx',
    ],
    setupFiles: ['./scripts/react-runtime-test-setup.js'],
    maxWorkers: 2,
    server: {deps: {inline: [/@preact\/signals/, /@phosphor-icons\/react/]}},
  },
});
