import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/china-map-selector/' // 设置为GitHub仓库名称以确保资源正确加载
})