// Vite config with Babel support (no React)
import { defineConfig } from 'vite'
import babel from 'vite-plugin-babel'

export default defineConfig({
  root: 'src/frontend',
  server: {
    port: 3000
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