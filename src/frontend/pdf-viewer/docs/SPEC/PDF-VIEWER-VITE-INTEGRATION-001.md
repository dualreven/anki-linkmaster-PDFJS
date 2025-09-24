**规范名称**: Vite开发与调试规范
**规范描述**: 定义Vite开发与调试规范，包括开发服务器配置、sourceMap策略、环境变量约定、热重载行为、QtWebEngine远程调试以及CI/本地调试步骤。
**当前版本**: 1.0
**所属范畴**: 开发工具规范
**适用范围**: PDF查看器Vite开发环境

**详细内容**:
- 开发服务器：正确配置端口、主机和WebSocket代理设置
- sourceMap：启用sourceMap支持便于调试和错误追踪
- 环境变量：定义开发和生产环境的环境变量约定
- 热重载：确保热重载在开发环境中正常工作
- 远程调试：支持在QtWebEngine中启用远程调试并与Vite联动

**验证方法**:
- 检查开发服务器配置是否正确，包括端口、主机和WebSocket代理
- 验证sourceMap是否启用并能正确映射源代码
- 确认环境变量在不同环境下的正确使用
- 测试热重载功能在开发环境中的工作状态
- 验证QtWebEngine远程调试是否能与Vite开发服务器联动

**正向例子**:
```javascript
// 正确的vite.config.js配置
export default {
  server: {
    port: 3000,
    host: 'localhost',
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  build: {
    sourcemap: true // 启用sourceMap
  }
};

// 环境变量使用
const isDevelopment = import.meta.env.MODE === 'development';
const apiUrl = import.meta.env.VITE_API_URL;
```

**反向例子**:
```javascript
// 错误的服务器配置
export default {
  server: {
    // 缺少必要配置
  },
  build: {
    sourcemap: false // 禁用sourceMap，不利于调试
  }
};

// 硬编码环境相关配置
const apiUrl = 'http://localhost:8000'; // 不应硬编码