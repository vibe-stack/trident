import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createCodexBridgePlugin } from './server/codex-bridge-plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    createCodexBridgePlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@ggez/anim-compiler': path.resolve(__dirname, '../../packages/anim-compiler/src/index.ts'),
      '@ggez/anim-core': path.resolve(__dirname, '../../packages/anim-core/src/index.ts'),
      '@ggez/anim-editor-core': path.resolve(__dirname, '../../packages/anim-editor-core/src/index.ts'),
      '@ggez/anim-exporter': path.resolve(__dirname, '../../packages/anim-exporter/src/index.ts'),
      '@ggez/anim-runtime': path.resolve(__dirname, '../../packages/anim-runtime/src/index.ts'),
      '@ggez/anim-schema': path.resolve(__dirname, '../../packages/anim-schema/src/index.ts'),
      '@ggez/anim-three': path.resolve(__dirname, '../../packages/anim-three/src/index.ts'),
      '@ggez/anim-utils': path.resolve(__dirname, '../../packages/anim-utils/src/index.ts'),
    },
  },
})
