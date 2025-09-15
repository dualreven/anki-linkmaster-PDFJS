// Vite config with Babel support (no React)
import { defineConfig } from 'vite'
import babel from 'vite-plugin-babel'
import fs from 'fs'
import path from 'path'

export default defineConfig(async () => {
  // 从日志文件中动态读取HTTP服务器端口，默认8080
  const logFile = path.join(process.cwd(), 'logs', 'http-server-port.txt')
  let httpServerPort = '8080' // 默认端口

  try {
    if (fs.existsSync(logFile)) {
      const portContent = fs.readFileSync(logFile, 'utf8').trim()
      const port = parseInt(portContent, 10)
      if (port > 0 && port < 65536) {
        httpServerPort = port.toString()
        console.log(`[Vite] Read HTTP server port from logs: ${httpServerPort}`)
      } else {
        console.warn(`[Vite] Invalid port in logs file: ${portContent}, using default ${httpServerPort}`)
      }
    } else {
      console.log(`[Vite] HTTP server port log file not found, using default port ${httpServerPort}`)
    }
  } catch (error) {
    console.warn(`[Vite] Failed to read HTTP server port log: ${error.message}, using default port ${httpServerPort}`)
  }

  return {
    root: 'src/frontend',
    server: {
      port: 3000,
      proxy: {
        // 代理PDF文件请求到PyQt HTTP服务器
        '/pdfs': {
          target: `http://localhost:8080`, // 临时固定端口以匹配HTTP服务器实际端口
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
  }
})