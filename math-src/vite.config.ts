import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  // 部署在域名根路径。
  base: '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // 部署时将 dist/ 内的文件发布到站点根目录。
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'node', // 出题逻辑是纯函数，无需 jsdom
    include: ['tests/**/*.test.ts'],
  },
})
