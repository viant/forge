import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  cacheDir: ".window-editor-cache",
  build: {
    outDir: "dist-window-editor",
    rollupOptions: { input: "window-editor-preview.html" },
  },
});
