import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: '/Users/awitas/go/src/github.com/viant/forge',
  base: './',
  plugins: [react()],
  build: {
    outDir: '/Users/awitas/go/src/github.com/viant/forge/output/report-builder-preview-static',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        reportBuilderPreview: '/Users/awitas/go/src/github.com/viant/forge/report-builder-preview.html',
      },
    },
  },
});
