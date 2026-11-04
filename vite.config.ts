import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ define: {__BUILD_VERSION__: JSON.stringify('PLAYTEST 0.8.0 · 2026-11-04')}, base: './', plugins: [react()] });
