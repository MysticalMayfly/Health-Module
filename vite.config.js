import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@shared': path.resolve('shared') } },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3001', '/uploads': 'http://localhost:3001' } },
  build: { chunkSizeWarningLimit: 2000 },
});
