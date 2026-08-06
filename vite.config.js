import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures relative path asset bundling for Vercel static deployment
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  },
  server: {
    port: 3000,
    open: false
  }
});
