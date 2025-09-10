import { defineConfig } from 'vite';
import babel from 'vite-plugin-babel';
import commonjs from '@rollup/plugin-commonjs';

export default defineConfig({
  root: 'src/frontend/pdf-home', // 设置根目录为 pdf-home
  plugins: [
    babel(),
    commonjs({
      // 配置transformMixedEsModules选项以处理混合ES模块和CommonJS模块
      transformMixedEsModules: true
    }) // 添加 CommonJS 支持插件
  ],
  build: {
    rollupOptions: {
      // 配置以支持 CommonJS 模块，如 PDF.js
      output: {
        format: 'es', // 使用 ES 模块格式
        // 支持动态导入
        dynamicImportInCjs: true
      }
    },
    // 启用源码映射以便于调试
    sourcemap: true,
    // 优化构建性能
    chunkSizeWarningLimit: 1000
  },
  // 开发服务器配置
  server: {
    port: 3000,
    open: true
  },
  // 优化预构建依赖
  optimizeDeps: {
    include: ['pdfjs-dist', 'tabulator-tables']
  }
});