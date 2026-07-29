import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [ react(), tailwindcss() ],
  resolve: {
    alias: {
      'monaco-editor/esm/vs/editor/editor.api.js':
        path.resolve(__dirname, 'node_modules/monaco-editor/esm/vs/editor/editor.api.js'),
    },
  },
  optimizeDeps: {
    include: ['monaco-editor'],
  },
})
