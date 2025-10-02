// Vite config with Babel support (no React)
import { defineConfig } from 'vite'
import babel from 'vite-plugin-babel'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ESM-safe equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom plugin to log all file requests
const viteRequestLogger = () => ({
  name: 'vite-request-logger',
  load(id) {
    console.log(`[Vite Load] Loading file: ${id}`);
    return null; // Fallback to default loader
  },
  transform(code, id) {
    // Log when specific key files are being transformed
    if (id.includes('main.js') || id.includes('app-bootstrap.js')) {
        console.log(`[Vite Transform] Transforming file: ${id}`);
    }
    return null; // Fallback to default transform
  }
});

export default defineConfig(async () => {
  // 从环境变量获取模块名称（为兼容旧脚本保留日志，但不再用于 root 切换）
  const module = process.env.VITE_MODULE || 'pdf-home'
  console.log(`[Vite] Loading module (compat log): ${module}`)

  // 从runtime-ports.json动态读取PDF文件服务器端口，默认8080
  const runtimePortsFile = path.join(__dirname, 'logs', 'runtime-ports.json')
  let httpServerPort = '8080' // 默认端口

  try {
    if (fs.existsSync(runtimePortsFile)) {
      const portsContent = fs.readFileSync(runtimePortsFile, 'utf8').trim()
      const portsData = JSON.parse(portsContent)
      const port = portsData.pdfFile_port
      if (port && port > 0 && port < 65536) {
        httpServerPort = port.toString()
        console.log(`[Vite] Read PDF file server port from runtime-ports.json: ${httpServerPort}`)
      } else {
        console.warn(`[Vite] Invalid pdfFile_port in runtime-ports.json: ${port}, using default ${httpServerPort}`)
      }
    } else {
      console.log(`[Vite] runtime-ports.json not found, using default port ${httpServerPort}`)
    }
  } catch (error) {
    console.warn(`[Vite] Failed to read PDF file server port from runtime-ports.json: ${error.message}, using default port ${httpServerPort}`)
  }

  // 读取ai-launcher指定的端口配置
  const vitePort = process.env.VITE_PORT ? parseInt(process.env.VITE_PORT, 10) : 3000
  const strictPort = process.env.VITE_STRICT_PORT === 'true'

  console.log(`[Vite] Using port: ${vitePort}, strict mode: ${strictPort}`)

  return {
    // 统一根目录，单 Vite 服务器同时服务 /pdf-home/ 与 /pdf-viewer/
    root: `src/frontend`,
    // 显式指定静态资源目录为仓库根目录下的 public（确保 /js/qwebchannel.js 可被 dev server 提供）
    resolve: {
      alias: {
        // 简化PDF.js资源路径访问
        '@pdfjs': path.resolve(__dirname, 'node_modules/pdfjs-dist')
      }
    },
    server: {
      port: vitePort,
      strictPort: strictPort, // 如果端口被占用则直接失败，不自动选择其他端口
      proxy: {
        // 代理PDF文件请求到PyQt HTTP服务器
        '/pdfs': {
          target: `http://localhost:${httpServerPort}`, // 动态读取PDF服务器端口
          changeOrigin: true,
          secure: false,
          ws: false,
          // 保持原始请求路径到后端（后端期望接收 /pdfs/{filename}）
          rewrite: (path) => path.replace(/^\/pdfs/, '/pdfs')
        },
        // 代理PDF文件请求（新路径）
        '/pdf-files': {
          target: `http://localhost:${httpServerPort}`,
          changeOrigin: true,
          secure: false,
          ws: false,
          rewrite: (path) => path.replace(/^\/pdf-files/, '/pdfs')
        },
        // 代理API请求到WebSocket服务器（如果需要）
        '/api': {
          target: 'http://localhost:8765',
          changeOrigin: true
        }
      }
    },
    plugins: [
      viteRequestLogger(),
      babel({
        babelConfig: {
          // Resolve config file explicitly from project root to avoid cwd issues
          configFile: path.resolve(__dirname, 'babel.config.js')
        },
        // Exclude node_modules and public directories from Babel processing
        exclude: [
          'node_modules/**',
          'public/**'
        ],
      })
    ],
    build: {
      rollupOptions: {
        // 单页面构建：只构建 pdf-home
        input: {
          'pdf-home': path.resolve(__dirname, 'src/frontend/pdf-home/index.html')
        },
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
