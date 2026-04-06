import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRootCss = path.resolve(__dirname, '../backend/Lighthouse.Web/wwwroot/css')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@webrootcss': webRootCss,
    },
  },
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
    proxy: {
      '/api': { target: 'http://localhost:5182' },
      '/Account': { target: 'http://localhost:5182' },
      '/Donor': { target: 'http://localhost:5182' },
      '/Admin': { target: 'http://localhost:5182' },
    },
  },
})
