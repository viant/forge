import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: root,
  base: './',
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('./output/report-builder-preview-static', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        reportBuilderPreview: fileURLToPath(new URL('./report-builder-preview.html', import.meta.url)),
      },
    },
  },
});
