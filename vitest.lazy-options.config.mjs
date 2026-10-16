import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'src/runtime/optionsFetch.render.test.jsx',
      'src/components/optionsFetchOwnership.test.jsx',
      'src/components/WindowContent.lazyOptions.render.test.jsx',
    ],
    setupFiles: ['./scripts/lazy-options-test-setup.js'],
    maxWorkers: 2,
    server: {deps: {inline: [/@preact\/signals/, /@phosphor-icons\/react/]}},
  },
});
