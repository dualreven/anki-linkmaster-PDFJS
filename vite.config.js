// Vite config with Babel support (no React)
import { defineConfig } from 'vite'
import babel from 'vite-plugin-babel'

export default defineConfig({
  root: 'src/frontend',
  server: {
    port: 3000,
    proxy: {
      // 代理PDF文件请求到PyQt HTTP服务器
      '/pdfs': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        ws: false,
        // 保持原始请求路径到后端（后端期望接收 /pdfs/{filename}）
        rewrite: (path) => path.replace(/^\/pdfs/, '/pdfs')
      },
      // 代理API请求到WebSocket服务器（如果需要）
      '/api': {
        target: 'http://localhost:8765',
        changeOrigin: true
      }
    }
  },
  plugins: [
    babel({
      babelConfig: {
        configFile: './babel.config.js'
      }
    })
  ],
  build: {
    rollupOptions: {
      external: [
        /__tests__/,
        /\.test\.js$/,
        /\.spec\.js$/,
        'pdfjs-dist'  // ✅ 关键修复：阻止 Vite 打包 PDF.js
      ]
    }
  }
})