// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';
import babel from 'vite-plugin-babel';

export default defineConfig({
  // 关键配置1：指定项目根目录
  // 这告诉Vite，Web服务器的根目录应该是 'src/frontend'。
  // 这样，对 http://localhost:3000/pdf-home/index.html 的请求
  // 会被正确映射到项目中的 src/frontend/pdf-home/index.html 文件。
  root: resolve(__dirname, 'src/frontend'),

  // 关键配置2：配置路径别名
  // 这允许我们使用简短、绝对的别名来代替冗长的相对路径 ../../
  resolve: {
    alias: {
      // 创建一个 '@' 别名，它指向 'src/frontend' 目录
      '@': resolve(__dirname, 'src/frontend')
    }
  },

  // 服务器配置（您可能已经有了）
  server: {
    port: 3000, // 确保端口与您在Qt中加载的端口一致
    strictPort: true, // 如果3000端口被占用，则直接失败而不是尝试新端口
  },

  

  // 插件配置：集成Babel转换ES2022+私有字段语法
  plugins: [
    babel({
      babelConfig: {
        presets: [
          [
            '@babel/preset-env',
            {
              targets: {
                browsers: ['> 0.25%', 'not dead']
              }
            }
          ]
        ],
        plugins: [
          '@babel/plugin-transform-private-methods',
          '@babel/plugin-transform-class-properties'
        ]
      }
    })
  ],

  // 构建配置：为多页面应用做准备
  // 这对于 `npm run build` (生产构建) 至关重要
  build: {
    // 输出目录，相对于项目根目录
    outDir: resolve(__dirname, 'dist'),
    // 清空输出目录
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // 定义你的每一个入口HTML文件
        // 'main' 是一个逻辑名称，值是相对于 `root` 配置的HTML文件路径
        pdfViewer: resolve(__dirname, 'src/frontend/pdf-viewer/index.html'),
        // 如果未来有其他页面，可以在这里添加
        // anotherPage: resolve(__dirname, 'src/frontend/another-page/index.html'),
      }
    }
  }
});