import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Set VITE_BASE=/your-repo-name/ when deploying to a GitHub Pages project site.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
});
