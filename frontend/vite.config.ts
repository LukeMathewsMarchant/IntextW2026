import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRootCss = path.resolve(__dirname, '../wwwroot/css')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@webrootcss': webRootCss,
    },
  },
  base: '/app/',
  build: {
    outDir: '../wwwroot/app',
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
      '/api': { target: 'https://localhost:7120', secure: false },
      '/Account': { target: 'https://localhost:7120', secure: false },
      '/Donor': { target: 'https://localhost:7120', secure: false },
      '/Admin': { target: 'https://localhost:7120', secure: false },
    },
  },
})
