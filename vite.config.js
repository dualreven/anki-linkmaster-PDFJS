import { defineConfig } from 'vite';
import babel from 'vite-plugin-babel';

export default defineConfig({
  root: 'src/frontend/pdf-home', // 设置根目录为 pdf-home
  plugins: [
    babel()
  ],
  build: {
    rollupOptions: {
      // 配置以支持 CommonJS 模块，如 PDF.js
      output: {
        format: 'es' // 使用 ES 模块格式
      }
    }
  }
});