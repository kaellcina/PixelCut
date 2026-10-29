import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    watch: {
      ignored: ['**/release/**', '**/android/**'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // The AudioWorklet must stay a real file; the CSP blocks data: modules.
    assetsInlineLimit: (file) => (file.endsWith('voice-worklet.js') ? false : undefined),
  },
});
