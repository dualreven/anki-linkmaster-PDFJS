# 技术栈与开发环境

## 技术栈

### 后端技术栈
- **Python**: 3.9+
- **GUI框架**: PyQt6
- **WebSocket**: 内置WebSocket服务器
- **文件处理**: shutil, os, json
- **异步处理**: 基于信号的异步架构

### 前端技术栈
- **JavaScript**: ES6+ (Vanilla JavaScript)
- **PDF处理**: PDF.js 3.4.120
- **表格组件**: Tabulator Tables 5.4.4
- **构建工具**: Vite 5.0.0
- **包管理**: npm
- **模块化**: ES6模块

### 开发工具
- **代码质量**: ESLint 9.34.0, JSDoc
- **测试框架**: Jest 30.1.1
- **代码转换**: Babel 7.x
- **类型检查**: TypeScript ESLint

## 开发环境设置

### 系统要求
- **操作系统**: Windows 10+/macOS 10.15+/Linux
- **Python**: 3.9 或更高版本
- **Node.js**: 16.0 或更高版本
- **内存**: 至少4GB RAM
- **磁盘空间**: 至少1GB可用空间

### 安装步骤

#### 1. 后端环境
```bash
cd src/backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### 2. 前端环境
```bash
npm install
```

#### 3. 开发服务器
```bash
# 前端开发服务器
npm run dev

# 后端应用
python src/backend/main.py
```

## 构建配置

### Vite配置
- **入口文件**: src/frontend/pdf-home/index.html
- **构建输出**: dist/
- **开发服务器**: http://localhost:3000
- **热重载**: 支持

### Babel配置
- **预设**: @babel/preset-env
- **插件**: 类属性转换插件
- **目标**: 现代浏览器支持

## 代码规范

### JavaScript/TypeScript规范
- **命名约定**: camelCase (变量/函数), PascalCase (类)
- **文件扩展名**: .js (JavaScript), .ts (TypeScript)
- **导入顺序**: 标准库 → 第三方库 → 本地模块
- **注释**: JSDoc格式

### Python规范
- **命名约定**: snake_case (变量/函数), PascalCase (类)
- **文件编码**: UTF-8
- **行长度**: 最大88字符 (Black格式化)
- **导入**: 绝对导入优先

## 测试策略

### 前端测试
- **框架**: Jest
- **环境**: jsdom
- **覆盖率**: 目标80%+
- **测试类型**: 单元测试、集成测试

### 后端测试
- **框架**: pytest
- **覆盖率**: 目标70%+
- **测试类型**: 单元测试、功能测试

## 性能优化

### 前端优化
- **虚拟滚动**: Tabulator表格大数据集处理
- **事件防抖**: 减少频繁操作的性能开销
- **内存管理**: 及时清理事件监听器和DOM引用
- **代码分割**: 按需加载模块

### 后端优化
- **异步处理**: 非阻塞的文件I/O操作
- **连接池**: WebSocket连接管理
- **缓存机制**: 文件元数据缓存
- **内存监控**: 防止内存泄漏

## 部署策略

### 开发环境
- **前端**: Vite开发服务器 + 热重载
- **后端**: Python直接运行 + 自动重载
- **调试**: Chrome DevTools + PyQt调试

### 生产环境
- **前端**: Vite构建静态文件
- **后端**: PyQt6打包为可执行文件
- **分发**: 单文件可执行程序

## 依赖管理

### 前端依赖
- **核心依赖**: pdfjs-dist, tabulator-tables
- **开发依赖**: vite, eslint, jest, babel
- **版本策略**: 锁定主要版本，定期更新次要版本

### 后端依赖
- **核心依赖**: PyQt6, websockets
- **开发依赖**: pytest, black, flake8
- **版本策略**: 稳定版本优先，定期安全更新

## 开发工作流

### 代码质量
- **代码审查**: 所有变更都需要审查
- **自动化测试**: CI/CD流水线集成测试
- **代码格式化**: Pre-commit hooks自动格式化
- **文档更新**: 代码变更时同步更新文档

### 版本控制
- **分支策略**: Git Flow
- **提交规范**: 语义化提交消息
- **标签管理**: 语义化版本标签

## 监控与调试

### 前端调试
- **浏览器调试**: Chrome DevTools
- **事件调试**: EventBus日志
- **性能监控**: 内存使用和渲染性能

### 后端调试
- **日志系统**: 结构化日志输出
- **错误追踪**: 完整的错误堆栈信息
- **性能监控**: 操作耗时统计

## 扩展性考虑

### 插件架构
- **前端插件**: 基于事件总线的插件系统
- **后端插件**: 模块化插件接口
- **配置管理**: JSON配置文件支持

### API设计
- **WebSocket协议**: 自定义消息格式
- **错误处理**: 统一的错误响应格式
- **版本控制**: API版本管理