import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ define: {__BUILD_VERSION__: JSON.stringify('PLAYTEST 0.6.0 · 2026-11-03')}, base: './', plugins: [react()] });
